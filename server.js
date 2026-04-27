const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const next = require('next');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
// const { MongoMemoryServer } = require('mongodb-memory-server');
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');

// ============================================================
// CONFIGURATION
// ============================================================
const JWT_SECRET = process.env.JWT_SECRET || 'romantic-chat-secret-key-2024';
const PORT = parseInt(process.env.PORT || '3000', 10);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI;
const ALLOWED_USERS = [
  { username: 'soulmate', password: 'love2024' },
  { username: 'girl', password: 'love2024' },
  { username: 'boss', password: 'boss2024' }, // Add boss user
];
const UPLOAD_DIR = path.join(__dirname, 'upload');
const DB_FILE = path.join(__dirname, 'database.json');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Initialize OpenAI (only if API key is available)
let openai = null;
if (OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
  });
} else {
  console.log('[AI] OpenAI API key not configured - AI features will be disabled');
}

function matchesQuery(item, query) {
  return Object.keys(query).every((key) => {
    const value = query[key];
    const itemValue = item[key];

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if ('$lt' in value) {
        return new Date(itemValue) < new Date(value.$lt);
      }
      if ('$ne' in value) {
        return itemValue !== value.$ne;
      }
      if ('$regex' in value) {
        const regex = new RegExp(value.$regex, value.$options || '');
        return typeof itemValue === 'string' && regex.test(itemValue);
      }
      return false;
    }

    return itemValue === value;
  });
}

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ============================================================
// IN-MEMORY DATABASE MODELS
// ============================================================
class InMemoryUser {
  constructor(data) {
    this.username = data.username;
    this.email = data.email || null;
    this.password = data.password;
    this.gender = data.gender; // 'soulmate' or 'girl'
    this.lastSeen = data.lastSeen || null;
    this.isOnline = data.isOnline || false;
    this.pendingFriendRequests = data.pendingFriendRequests || [];
    this.friends = data.friends || [];
  }
}

class InMemoryMessage {
  constructor(data) {
    this._id = data._id || uuidv4();
    this.sender = data.sender;
    this.content = data.content || '';
    this.fileType = data.fileType || null;
    this.fileName = data.fileName || null;
    this.filePath = data.filePath || null;
    this.timestamp = data.timestamp || new Date();
    this.read = data.read || false;
  }
}

class InMemoryDB {
  constructor() {
    this.users = [];
    this.messages = [];
    this.loadFromFile();
  }

  loadFromFile() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        this.users = data.users || [];
        this.messages = data.messages || [];
        console.log('[DB] Loaded data from file');
      }
    } catch (error) {
      console.error('[DB] Error loading from file:', error);
    }
  }

  saveToFile() {
    try {
      const data = {
        users: this.users,
        messages: this.messages
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[DB] Error saving to file:', error);
    }
  }

  async findOne(model, query) {
    const collection = this[model.toLowerCase() + 's'];
    return collection.find((item) => matchesQuery(item, query)) || null;
  }

  async create(model, data) {
    const collection = this[model.toLowerCase() + 's'];
    const item = new (model === 'User' ? InMemoryUser : InMemoryMessage)(data);
    collection.push(item);
    this.saveToFile();
    return item;
  }

  async find(model, query = {}) {
    const collection = this[model.toLowerCase() + 's'];
    return collection.filter((item) => matchesQuery(item, query));
  }

  async updateOne(model, query, update) {
    const collection = this[model.toLowerCase() + 's'];
    const item = collection.find(item => {
      return Object.keys(query).every(key => item[key] === query[key]);
    });
    if (item) {
      Object.assign(item, update.$set || update);
      this.saveToFile();
      return { acknowledged: true, modifiedCount: 1 };
    }
    return { acknowledged: true, modifiedCount: 0 };
  }

  async updateMany(model, query, update) {
    const collection = this[model.toLowerCase() + 's'];
    let modifiedCount = 0;
    collection.forEach((item) => {
      if (matchesQuery(item, query)) {
        Object.assign(item, update.$set || update);
        modifiedCount += 1;
      }
    });
    if (modifiedCount > 0) {
      this.saveToFile();
    }
    return { acknowledged: true, modifiedCount };
  }

  async deleteMany(model, query) {
    const collection = this[model.toLowerCase() + 's'];
    const initialLength = collection.length;
    this[model.toLowerCase() + 's'] = collection.filter((item) => !matchesQuery(item, query));
    this.saveToFile();
    return { acknowledged: true, deletedCount: initialLength - collection.length };
  }
}

let db = null;
let User = null;
let Message = null;
let databaseMode = 'unknown';

async function initializeDatabase() {
  if (MONGODB_URI && MONGODB_URI.trim()) {
    try {
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
      });

      const userSchema = new mongoose.Schema({
        username: { type: String, required: true, unique: true, trim: true },
        email: { type: String, default: null, trim: true, lowercase: true, index: true },
        password: { type: String, required: true },
        gender: { type: String, enum: ['soulmate', 'girl'], required: true },
        lastSeen: { type: Date, default: null },
        isOnline: { type: Boolean, default: false },
        pendingFriendRequests: { type: [String], default: [] },
        friends: { type: [String], default: [] },
      }, { timestamps: true });

      const messageSchema = new mongoose.Schema({
        sender: { type: String, required: true },
        content: { type: String, default: '' },
        fileType: { type: String, enum: ['image', 'pdf', null], default: null },
        fileName: { type: String, default: null },
        filePath: { type: String, default: null },
        timestamp: { type: Date, default: Date.now, index: true },
        read: { type: Boolean, default: false },
      }, { timestamps: false });

      User = mongoose.models.User || mongoose.model('User', userSchema);
      Message = mongoose.models.Message || mongoose.model('Message', messageSchema);
      databaseMode = 'mongodb';
      console.log('[DB] Connected to MongoDB');
      return;
    } catch (error) {
      console.error('[DB] MongoDB connection failed, falling back to local JSON storage:', error.message);
    }
  }

  db = new InMemoryDB();
  User = {
    findOne: (query) => db.findOne('User', query),
    create: (data) => db.create('User', data),
    find: (query) => db.find('User', query),
    updateOne: (query, update) => db.updateOne('User', query, update),
  };

  Message = {
    find: (query) => db.find('Message', query),
    findById: (id) => ({ lean: async () => db.findOne('Message', { _id: id }) }),
    create: (data) => db.create('Message', data),
    updateOne: (query, update) => db.updateOne('Message', query, update),
    updateMany: (query, update) => db.updateMany('Message', query, update),
    deleteMany: (query) => db.deleteMany('Message', query),
  };
  databaseMode = 'json-file';
  console.log('[DB] Using local JSON file storage');
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ============================================================
// AI ASSISTANT FUNCTIONS
// ============================================================

// Generate AI response for love and romance
async function generateLoveResponse(message, context = 'general') {
  if (!openai) {
    return 'AI service not available - please configure OPENAI_API_KEY in .env file';
  }

  try {
    let systemPrompt = '';

    if (context === 'love') {
      systemPrompt = `You are Gorsa Jaalalaa, a warm, wise, and romantic AI Assistant integrated into a private chat between two lovers.

Your Mission:
- Romantic Advice: Offer sweet and wise relationship advice when asked.
- Poetic Expressions: Generate beautiful and romantic Afan Oromo quotes, poems, and messages to help them express their feelings.
- Cultural Values: Infuse your advice with 'Safuu' and 'Namusa Oromummaa' (Oromo cultural ethics), emphasizing respect, patience, and deep loyalty.
- Language: Communicate primarily in Afan Oromo (with a touch of English if needed). Use a poetic, respectful, and encouraging tone.
- Proactive Sweetness: Occasionally suggest small romantic gestures or sweet words they can say to each other to keep the love fresh.

Keep responses brief (1-2 sentences) and natural for chat conversations. Be the wise romantic guide they need.`;
    } else {
      systemPrompt = `You are Gorsa Jaalalaa, a warm, wise, and romantic AI Assistant.

Provide helpful, loving guidance in Afan Oromo with some English when needed. Emphasize Oromo cultural values of respect, patience, and loyalty. Keep responses brief and encouraging.`;
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: 200, // Allow for poetic responses
      temperature: 0.8, // Creative for romantic/poetic content
    });

    return completion.choices[0].message.content || '💕';
  } catch (error) {
    console.error('[AI] Error generating response:', error);
    return '💕'; // Fallback to just a heart emoji
  }
}

// Generate romantic quote in Afan Oromo
async function generateRomanticQuote() {
  if (!openai) {
    return '💕 Jaalala kee nagaan itti fufadhu! (May your love continue peacefully!)';
  }

  try {
    const systemPrompt = `You are Gorsa Jaalalaa, a poetic romantic guide. Generate a short, poetic, and heartwarming romantic quote in pure Afan Oromo.

Focus: True love, loyalty (amanamtummaa), and deep connection.
Style: Use metaphors related to nature (flowers, sunshine, rivers, stars, etc.).
Length: Keep it under 3 lines.
Tone: Gentle, romantic, and inspiring.

Examples:
- "Jaalala kee yoo ta'e, biiftuu fi bishaan waliin kan badu." (If your love is true, it grows like a flower with water.)
- "Amanamtummaa kee yoo ta'e, gaaddisaafi kan badu." (If your loyalty is true, it grows like a river.)

Always respond with only the quote in Afan Oromo.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate a romantic quote about true love and loyalty.' }
      ],
      max_tokens: 100,
      temperature: 0.9, // High creativity for poetic content
    });

    return completion.choices[0].message.content || '💕 Jaalala kee nagaan itti fufadhu!';
  } catch (error) {
    console.error('[AI] Error generating romantic quote:', error);
    return '💕 Jaalala kee nagaan itti fufadhu! (May your love continue peacefully!)';
  }
}

// Check if message contains AI command
function isAICommand(message) {
  const aiCommands = ['/ai', '@ai', '!ai', 'ai:', 'አይ', '/quote', '/romantic'];
  return aiCommands.some(cmd => message.toLowerCase().startsWith(cmd));
}

// Check if message is a romantic quote request
function isRomanticQuoteCommand(message) {
  const quoteCommands = ['/quote', '/romantic'];
  return quoteCommands.some(cmd => message.toLowerCase().startsWith(cmd));
}

// Extract message content after AI command
function extractAIMessage(message) {
  const aiCommands = ['/ai', '@ai', '!ai', 'ai:', 'አይ'];
  for (const cmd of aiCommands) {
    if (message.toLowerCase().startsWith(cmd)) {
      return message.slice(cmd.length).trim();
    }
  }
  return message;
}

// ============================================================
// AUTH UTILITIES
// ============================================================
function generateToken(username) {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  req.user = decoded;
  next();
}

// ============================================================
// MULTER CONFIGURATION (for file uploads)
// ============================================================
const multer = require('multer');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only images (JPG, PNG, GIF, WebP) and PDFs are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

// ============================================================
// NEXT.JS SETUP
// ============================================================
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// ============================================================
// ONLINE USERS TRACKER
// ============================================================
const onlineUsers = new Map(); // username -> socketId

// ============================================================
// MAIN SERVER SETUP
// ============================================================
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();

    // Prepare Next.js
    await app.prepare();
    console.log('[Next.js] Prepared');

    // Create Express app
    const server = express();

    // Middleware
    server.use(cookieParser());
    server.use(cors({
      origin: true,
      credentials: true,
    }));
    server.use(express.json());

    // Serve uploaded files statically
    server.use('/uploads', express.static(UPLOAD_DIR));

    // ============================================================
    // API ROUTES
    // ============================================================

    // --- Auth Routes ---
    server.post('/api/auth/register', async (req, res) => {
      try {
        const { email, password, gender } = req.body;
        const normalizedEmail = normalizeEmail(email);

        if (!normalizedEmail || !password || !gender) {
          return res.status(400).json({ error: 'Email, password, and gender are required' });
        }

        if (!isValidEmail(normalizedEmail)) {
          return res.status(400).json({ error: 'Please enter a valid email address' });
        }

        if (!['soulmate', 'girl'].includes(gender)) {
          return res.status(400).json({ error: 'Gender must be soulmate or girl' });
        }

        // Check if email already exists
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
          return res.status(409).json({ error: 'Email already registered' });
        }

        // Hash password and create user
        const hashedPassword = await bcrypt.hash(password, 12);
        const newUser = await User.create({
          username: normalizedEmail,
          email: normalizedEmail,
          password: hashedPassword,
          gender,
          pendingFriendRequests: [],
          friends: [],
        });

        // Generate token
        const token = generateToken(newUser.username);

        // Set httpOnly cookie
        res.cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        res.status(201).json({ username: newUser.username, token, gender: newUser.gender });
      } catch (error) {
        console.error('[Auth] Register error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    server.post('/api/auth/login', async (req, res) => {
      try {
        const { email, password } = req.body;
        const normalizedEmail = normalizeEmail(email);

        if (!normalizedEmail || !password) {
          return res.status(400).json({ error: 'Email and password are required' });
        }

        if (!isValidEmail(normalizedEmail)) {
          return res.status(400).json({ error: 'Please enter a valid email address' });
        }

        // Find user in DB
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate token
        const token = generateToken(user.username);

        // Set httpOnly cookie
        res.cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        // Update last seen and online status
        await User.updateOne({ username: user.username }, { lastSeen: new Date(), isOnline: true });
        onlineUsers.set(user.username, null); // Will be set when socket connects

        res.json({ username: user.username, token });
      } catch (error) {
        console.error('[Auth] Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    server.get('/api/auth/me', authMiddleware, async (req, res) => {
      try {
        const user = await User.findOne({ username: req.user.username });
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
        res.json({ username: user.username, isOnline: user.isOnline, lastSeen: user.lastSeen });
      } catch (error) {
        console.error('[Auth] Me error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    server.post('/api/auth/logout', authMiddleware, async (req, res) => {
      try {
        await User.updateOne(
          { username: req.user.username },
          { isOnline: false, lastSeen: new Date() }
        );
        onlineUsers.delete(req.user.username);
        res.clearCookie('token');
        res.json({ success: true });
      } catch (error) {
        console.error('[Auth] Logout error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // --- Message Routes ---
    server.get('/api/messages', authMiddleware, async (req, res) => {
      try {
        const limit = parseInt(String(req.query.limit)) || 100;
        const before = req.query.before ? String(req.query.before) : undefined;

        let query = {};
        if (before) {
          query.timestamp = { $lt: new Date(before) };
        }

        let messages = await Message.find(query);
        messages = messages
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
          .slice(0, limit);

        res.json(messages);
      } catch (error) {
        console.error('[Messages] Get error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    server.get('/api/messages/search', authMiddleware, async (req, res) => {
      try {
        const q = req.query.q ? String(req.query.q) : '';
        if (!q || q.trim().length === 0) {
          return res.json([]);
        }

        let messages = await Message.find({
          content: { $regex: q.trim(), $options: 'i' },
        });
        messages = messages
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, 50);

        res.json(messages);
      } catch (error) {
        console.error('[Messages] Search error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // --- File Upload Route ---
    server.post('/api/upload', authMiddleware, async (req, res) => {
      upload.single('file')(req, res, async (err) => {
        if (err) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File size must be under 10MB.' });
          }
          return res.status(400).json({ error: err.message });
        }

        const currentUsername = req.user.username;
        const partnerUsername = ALLOWED_USERS.find(u => u.username !== currentUsername)?.username;
        const currentUser = await User.findOne({ username: currentUsername });

        const file = req.file;
        if (!file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        try {
          const fileType = file.mimetype.startsWith('image/') ? 'image' : 'pdf';
          const filePath = `/uploads/${file.filename}`;
          const fileName = file.originalname;

          // Create a message with the file
          const message = await Message.create({
            sender: req.user.username,
            content: '',
            fileType,
            fileName,
            filePath,
            timestamp: new Date(),
            read: false,
          });

          const populatedMessage = message;

          // Broadcast the file message via Socket.io
          io.to('private-chat').emit('new_message', populatedMessage);

          res.json(populatedMessage);
        } catch (error) {
          console.error('[Upload] Error:', error);
          res.status(500).json({ error: 'Internal server error' });
        }
      });
    });

    // --- Partner Request Routes ---
    server.post('/api/partner/request', authMiddleware, async (req, res) => {
      try {
        const currentUsername = req.user.username;
        const partnerUsername = ALLOWED_USERS.find(u => u.username !== currentUsername)?.username;
        if (!partnerUsername) {
          return res.status(404).json({ error: 'Partner not found' });
        }

        const currentUser = await User.findOne({ username: currentUsername });
        const partner = await User.findOne({ username: partnerUsername });

        if (!partner) {
          return res.status(404).json({ error: 'Partner not registered yet' });
        }

        if (currentUser?.friends?.includes(partnerUsername)) {
          return res.json({ success: true, isFriend: true });
        }

        if (partner.pendingFriendRequests?.includes(currentUsername)) {
          return res.json({ success: true, requestSent: true });
        }

        partner.pendingFriendRequests = partner.pendingFriendRequests || [];
        partner.pendingFriendRequests.push(currentUsername);
        await User.updateOne({ username: partnerUsername }, { pendingFriendRequests: partner.pendingFriendRequests });

        res.json({ success: true, requestSent: true });
      } catch (error) {
        console.error('[Partner] Request error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    server.post('/api/partner/accept', authMiddleware, async (req, res) => {
      try {
        const currentUsername = req.user.username;
        const partnerUsername = ALLOWED_USERS.find(u => u.username !== currentUsername)?.username;
        if (!partnerUsername) {
          return res.status(404).json({ error: 'Partner not found' });
        }

        const currentUser = await User.findOne({ username: currentUsername });
        const partner = await User.findOne({ username: partnerUsername });

        if (!partner || !currentUser) {
          return res.status(404).json({ error: 'User not found' });
        }

        const hasRequest = currentUser.pendingFriendRequests?.includes(partnerUsername);
        if (!hasRequest) {
          return res.status(400).json({ error: 'No friend request to accept' });
        }

        currentUser.pendingFriendRequests = currentUser.pendingFriendRequests.filter((u) => u !== partnerUsername);
        currentUser.friends = Array.from(new Set([...(currentUser.friends || []), partnerUsername]));
        partner.friends = Array.from(new Set([...(partner.friends || []), currentUsername]));

        await User.updateOne({ username: currentUsername }, {
          pendingFriendRequests: currentUser.pendingFriendRequests,
          friends: currentUser.friends,
        });
        await User.updateOne({ username: partnerUsername }, {
          friends: partner.friends,
        });

        res.json({ success: true, isFriend: true });
      } catch (error) {
        console.error('[Partner] Accept error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // --- Partner Status Route ---
    server.get('/api/partner/status', authMiddleware, async (req, res) => {
      try {
        const currentUsername = req.user.username;
        const partnerUsername = ALLOWED_USERS.find(u => u.username !== currentUsername)?.username;
        if (!partnerUsername) {
          return res.json({ username: 'Unknown', isOnline: false, lastSeen: null, isFriend: false, requestSent: false, requestReceived: false });
        }

        const currentUser = await User.findOne({ username: currentUsername });
        const partner = await User.findOne({ username: partnerUsername });
        const isOnline = onlineUsers.has(partnerUsername);

        const isFriend = currentUser?.friends?.includes(partnerUsername) || false;
        const requestSent = partner?.pendingFriendRequests?.includes(currentUsername) || false;
        const requestReceived = currentUser?.pendingFriendRequests?.includes(partnerUsername) || false;

        res.json({
          username: partnerUsername,
          gender: partner?.gender || null,
          isOnline,
          lastSeen: partner?.lastSeen || null,
          isFriend,
          requestSent,
          requestReceived,
        });
      } catch (error) {
        console.error('[Partner] Status error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // ============================================================
    // NEXT.JS HANDLER (must be last - catches all other routes)
    // ============================================================
    server.get('/', (req, res) => {
      return handle(req, res);
    });

    server.use((req, res) => {
      return handle(req, res);
    });

    // ============================================================
    // HTTP SERVER & SOCKET.IO
    // ============================================================
    const httpServer = http.createServer(server);

    const io = new Server(httpServer, {
      path: '/socket.io/',
      cors: {
        origin: true,
        credentials: true,
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
      pingInterval: 25000,
      pingTimeout: 20000,
    });

    // Socket.io Authentication Middleware
    io.use((socket, next) => {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        return next(new Error('Authentication error: Invalid token'));
      }

      socket.data.user = decoded;
      next();
    });

    // Socket.io Connection Handler
    io.on('connection', (socket) => {
      const username = socket.data.user.username;
      console.log(`[Socket] ${username} connected (${socket.id})`);

      // Track online user
      onlineUsers.set(username, socket.id);

      // Update DB status
      User.updateOne({ username }, { isOnline: true, lastSeen: new Date() }).catch(console.error);

      // Join private chat room
      socket.join('private-chat');

      // Notify others about online status
      socket.to('private-chat').emit('user_online', { username });
      io.to('private-chat').emit('online_users', Array.from(onlineUsers.keys()));

      // Handle send_message
      socket.on('send_message', async (data) => {
        try {
          const { content } = data;
          if (!content || !content.trim()) return;

          const trimmedContent = content.trim();

          // Create and send the original message
          const message = await Message.create({
            sender: username,
            content: trimmedContent,
            timestamp: new Date(),
            read: false,
          });

          const populatedMessage = message;

          // Broadcast to all in the room
          io.to('private-chat').emit('new_message', populatedMessage);

          // Always generate AI response for romantic communication
          try {
            // Determine context based on message content
            const isLoveMessage = trimmedContent.toLowerCase().includes('love') ||
                                 trimmedContent.toLowerCase().includes('romance') ||
                                 trimmedContent.toLowerCase().includes('relationship') ||
                                 trimmedContent.toLowerCase().includes('heart') ||
                                 trimmedContent.toLowerCase().includes('kiss') ||
                                 trimmedContent.toLowerCase().includes('hug') ||
                                 trimmedContent.toLowerCase().includes('miss') ||
                                 trimmedContent.toLowerCase().includes('beautiful') ||
                                 trimmedContent.toLowerCase().includes('sweet') ||
                                 trimmedContent.toLowerCase().includes('darling') ||
                                 trimmedContent.toLowerCase().includes('dear');

            const context = isLoveMessage ? 'love' : 'general';

            // Create a prompt that encourages romantic communication
            let aiPrompt;
            if (isLoveMessage) {
              aiPrompt = `Respond romantically to this message in a conversation between soulmates: "${trimmedContent}". Make it loving, supportive, and enhance the romantic connection.`;
            } else {
              aiPrompt = `Respond helpfully to this message in a romantic conversation: "${trimmedContent}". Keep it warm, loving, and encourage deeper connection.`;
            }

            // Generate AI response for love and romance
            const aiResponse = await generateLoveResponse(aiPrompt, context);

            // Create AI message with a romantic sender name
            const aiMessage = await Message.create({
              sender: 'Gorsa Jaalalaa',
              content: aiResponse,
              timestamp: new Date(),
              read: false,
            });

            // Broadcast AI response after a short delay to make it feel natural
            setTimeout(() => {
              io.to('private-chat').emit('new_message', aiMessage);
            }, 1000 + Math.random() * 2000); // Random delay between 1-3 seconds

          } catch (aiError) {
            console.error('[AI] Error generating automatic response:', aiError);
            // Don't fail the message sending if AI fails
          }

          // Check if this is an explicit AI command (for additional responses)
          if (isAICommand(trimmedContent)) {
            let aiResponse;

            // Handle romantic quote commands specially
            if (isRomanticQuoteCommand(trimmedContent)) {
              aiResponse = await generateRomanticQuote();
            } else {
              const aiPrompt = extractAIMessage(trimmedContent);

              // Determine context (love or general)
              const isLoveMessage = aiPrompt.toLowerCase().includes('love') ||
                                   aiPrompt.toLowerCase().includes('romance') ||
                                   aiPrompt.toLowerCase().includes('relationship') ||
                                   aiPrompt.toLowerCase().includes('heart') ||
                                   aiPrompt.toLowerCase().includes('kiss') ||
                                   aiPrompt.toLowerCase().includes('hug');

              const context = isLoveMessage ? 'love' : 'general';

              // Generate AI response for love and romance
              aiResponse = await generateLoveResponse(aiPrompt, context);
            }

            // Create AI message
            const aiMessage = await Message.create({
              sender: 'Gorsa Jaalalaa',
              content: aiResponse,
              timestamp: new Date(),
              read: false,
            });

            // Broadcast AI response
            io.to('private-chat').emit('new_message', aiMessage);
          }
        } catch (error) {
          console.error('[Socket] send_message error:', error);
          socket.emit('error_message', { error: 'Failed to send message' });
        }
      });

      // Handle typing
      let typingTimeout = null;
      socket.on('typing', () => {
        if (typingTimeout) clearTimeout(typingTimeout);
        socket.to('private-chat').emit('partner_typing', { username });
        typingTimeout = setTimeout(() => {
          socket.to('private-chat').emit('partner_stop_typing', { username });
        }, 3000);
      });

      // Handle stop_typing
      socket.on('stop_typing', () => {
        if (typingTimeout) clearTimeout(typingTimeout);
        socket.to('private-chat').emit('partner_stop_typing', { username });
      });

      // Handle message_read
      socket.on('message_read', async () => {
        try {
          // Mark all unread messages not from this user as read
          await Message.updateMany(
            { sender: { $ne: username }, read: false },
            { read: true }
          );
          socket.to('private-chat').emit('messages_read', { by: username });
        } catch (error) {
          console.error('[Socket] message_read error:', error);
        }
      });

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        console.log(`[Socket] ${username} disconnected (${reason})`);
        onlineUsers.delete(username);

        // Update DB status
        User.updateOne(
          { username },
          { isOnline: false, lastSeen: new Date() }
        ).catch(console.error);

        // Notify others
        socket.to('private-chat').emit('user_offline', {
          username,
          lastSeen: new Date().toISOString(),
        });

        // Update online users list
        io.to('private-chat').emit('online_users', Array.from(onlineUsers.keys()));
      });
    });

    // ============================================================
    // START HTTP SERVER
    // ============================================================
    httpServer.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║     💕  Soulmate Chat Server  💕                         ║
║                                                          ║
║     Server:  http://localhost:${PORT}                      ║
║     Database: ${databaseMode.padEnd(42, ' ')}║
║     Socket:  /socket.io/                                 ║
║                                                          ║
║     Registration: Email based                            ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('[Server] SIGTERM received, shutting down...');
      httpServer.close();
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
      }
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('[Server] SIGINT received, shutting down...');
      httpServer.close();
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
      }
      process.exit(0);
    });

  } catch (error) {
    console.error('[Server] Fatal error:', error);
    process.exit(1);
  }
}

startServer();
