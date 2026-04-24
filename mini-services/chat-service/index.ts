import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = 'romantic-chat-secret-key-2024';
const PORT = 3003;

const ALLOWED_USERS = [
  { username: 'soulmate1', password: 'love2024' },
  { username: 'soulmate2', password: 'love2024' }
];

// MongoDB Schemas
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  lastSeen: { type: Date, default: Date.now },
  isOnline: { type: Boolean, default: false }
});

const messageSchema = new mongoose.Schema({
  sender: { type: String, required: true },
  content: { type: String, default: '' },
  fileType: { type: String, enum: ['image', 'pdf', null], default: null },
  fileName: { type: String, default: null },
  filePath: { type: String, default: null },
  timestamp: { type: Date, default: Date.now },
  read: { type: Boolean, default: false }
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

// Express App
const app = express();

// CORS - allow all origins for development
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
}));

app.use(express.json());
app.use(cookieParser());

// Serve uploaded files statically
const uploadDir = '/home/z/my-project/upload';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const fileFilter = (_req: express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and PDFs are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Auth middleware
interface JwtPayload {
  username: string;
  iat?: number;
  exp?: number;
}

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    (req as any).user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
}

// API Routes

// Login
app.post('/api/auth/login', async (req: express.Request, res: express.Response) => {
  try {
    const { username, password } = req.body;
    
    const allowedUser = ALLOWED_USERS.find(u => u.username === username);
    if (!allowedUser) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    if (password !== allowedUser.password) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Update or create user in DB
    let user = await User.findOne({ username });
    if (!user) {
      const hashedPassword = await bcrypt.hash(password, 10);
      user = new User({ username, password: hashedPassword });
      await user.save();
    }

    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
    
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'lax',
    });

    res.json({ username, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user
app.get('/api/auth/me', async (req: express.Request, res: express.Response) => {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    const user = await User.findOne({ username: decoded.username });
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    res.json({ username: user.username, isOnline: user.isOnline, lastSeen: user.lastSeen });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Logout
app.post('/api/auth/logout', authMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const { username } = (req as any).user;
    await User.updateOne({ username }, { isOnline: false, lastSeen: new Date() });
    res.clearCookie('token');
    res.json({ message: 'Logged out' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get messages (paginated)
app.get('/api/messages', authMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const before = req.query.before as string;
    
    let query: any = {};
    if (before) {
      query.timestamp = { $lt: new Date(before) };
    }
    
    const messages = await Message.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
    
    // Mark unread messages as read
    const { username } = (req as any).user;
    await Message.updateMany(
      { read: false, sender: { $ne: username } },
      { read: true }
    );
    
    res.json(messages.reverse());
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Search messages
app.get('/api/messages/search', authMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const q = req.query.q as string;
    if (!q || q.trim().length === 0) {
      res.json([]);
      return;
    }
    
    const messages = await Message.find({
      content: { $regex: q, $options: 'i' }
    })
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();
    
    res.json(messages);
  } catch (error) {
    console.error('Search messages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Upload file
app.post('/api/upload', authMiddleware, upload.single('file'), async (req: express.Request, res: express.Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    
    const { username } = (req as any).user;
    const file = req.file;
    
    let fileType: 'image' | 'pdf' | null = null;
    if (file.mimetype.startsWith('image/')) {
      fileType = 'image';
    } else if (file.mimetype === 'application/pdf') {
      fileType = 'pdf';
    }
    
    const message = new Message({
      sender: username,
      content: '',
      fileType,
      fileName: file.originalname,
      filePath: `/uploads/${file.filename}`,
      timestamp: new Date(),
      read: false
    });
    
    await message.save();
    
    const messageObj = message.toObject();
    
    // Emit to all connected clients in the room
    io.to('private-chat').emit('new_message', messageObj);
    
    res.json(messageObj);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get partner status
app.get('/api/partner/status', authMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const { username } = (req as any).user;
    const partner = ALLOWED_USERS.find(u => u.username !== username);
    if (!partner) {
      res.status(404).json({ error: 'Partner not found' });
      return;
    }
    
    const partnerUser = await User.findOne({ username: partner.username });
    res.json({
      username: partner.username,
      isOnline: partnerUser?.isOnline || false,
      lastSeen: partnerUser?.lastSeen || null
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get unread count
app.get('/api/messages/unread', authMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const { username } = (req as any).user;
    const count = await Message.countDocuments({ read: false, sender: { $ne: username } });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Health check
app.get('/api/health', (_req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// HTTP Server
const httpServer = http.createServer(app);

// Socket.io - use /socket.io/ path to avoid conflict with Express API routes
const io = new Server(httpServer, {
  path: '/socket.io/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Track online users by socket
const onlineUsers = new Map<string, { username: string; socketId: string }>();

io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) {
    next(new Error('Authentication required'));
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    (socket as any).user = decoded;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', async (socket) => {
  const user = (socket as any).user as JwtPayload;
  if (!user) {
    socket.disconnect();
    return;
  }

  console.log(`User connected: ${user.username} (${socket.id})`);

  // Join the private chat room
  socket.join('private-chat');

  // Track online status
  onlineUsers.set(user.username, { username: user.username, socketId: socket.id });

  // Update online status in DB
  await User.updateOne(
    { username: user.username },
    { isOnline: true, lastSeen: new Date() },
    { upsert: true }
  );

  // Notify others in the room
  socket.to('private-chat').emit('user_online', { username: user.username });
  io.to('private-chat').emit('online_users', Array.from(onlineUsers.keys()));

  // Handle send_message
  socket.on('send_message', async (data: { content: string }) => {
    try {
      if (!data.content || data.content.trim().length === 0) return;
      
      const message = new Message({
        sender: user.username,
        content: data.content.trim(),
        timestamp: new Date(),
        read: false
      });

      await message.save();
      
      const messageObj = message.toObject();
      io.to('private-chat').emit('new_message', messageObj);
    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error_message', { error: 'Failed to send message' });
    }
  });

  // Handle typing
  let typingTimeout: ReturnType<typeof setTimeout> | null = null;
  
  socket.on('typing', () => {
    if (typingTimeout) clearTimeout(typingTimeout);
    socket.to('private-chat').emit('partner_typing', { username: user.username });
    typingTimeout = setTimeout(() => {
      socket.to('private-chat').emit('partner_stop_typing', { username: user.username });
    }, 3000);
  });

  socket.on('stop_typing', () => {
    if (typingTimeout) clearTimeout(typingTimeout);
    socket.to('private-chat').emit('partner_stop_typing', { username: user.username });
  });

  // Handle message_read
  socket.on('message_read', async () => {
    try {
      await Message.updateMany(
        { read: false, sender: { $ne: user.username } },
        { read: true }
      );
      socket.to('private-chat').emit('messages_read', { by: user.username });
    } catch (error) {
      console.error('Message read error:', error);
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${user.username} (${socket.id})`);
    
    onlineUsers.delete(user.username);
    
    await User.updateOne(
      { username: user.username },
      { isOnline: false, lastSeen: new Date() }
    );

    socket.to('private-chat').emit('user_offline', { 
      username: user.username, 
      lastSeen: new Date() 
    });
    io.to('private-chat').emit('online_users', Array.from(onlineUsers.keys()));
  });

  socket.on('error', (error) => {
    console.error(`Socket error (${socket.id}):`, error);
  });
});

// Initialize MongoDB and start server
async function startServer() {
  try {
    console.log('Starting MongoDB Memory Server...');
    const mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    console.log(`MongoDB Memory Server started at: ${mongoUri}`);

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Seed allowed users
    for (const allowedUser of ALLOWED_USERS) {
      const existingUser = await User.findOne({ username: allowedUser.username });
      if (!existingUser) {
        const hashedPassword = await bcrypt.hash(allowedUser.password, 10);
        await new User({ username: allowedUser.username, password: hashedPassword }).save();
        console.log(`Seeded user: ${allowedUser.username}`);
      }
    }

    httpServer.listen(PORT, () => {
      console.log(`Chat service running on port ${PORT}`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('Shutting down chat service...');
      io.close();
      httpServer.close();
      await mongoose.disconnect();
      await mongoServer.stop();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
