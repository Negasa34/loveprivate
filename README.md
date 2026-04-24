# 💕 Soulmate Chat

A beautiful, real-time soulmate chat application with AI assistant support. Built with Next.js, Socket.io, and Tailwind CSS.

## ✨ Features

- 💬 Real-time messaging with Socket.io
- 🔐 JWT authentication
- 🤖 **Gorsa Jaalalaa** - AI romantic guide with Oromo wisdom and poetry
- ⚡ **AI Generate Button** - Quick access to romantic quotes and advice
- 📁 File uploads (images & PDFs)
- 💖 Romantic UI design
- 📱 Responsive design
- 🔍 Message search functionality
- 👥 Online status indicators

## 🤖 Gorsa Jaalalaa - Your Romantic Guide

**Gorsa Jaalalaa** (Love Advisor) is a warm, wise, and romantic AI Assistant integrated into your private chat:

- **Romantic Advice**: Offers sweet and wise relationship guidance
- **Poetic Expressions**: Generates beautiful Afan Oromo quotes, poems, and messages
- **Romantic Quotes**: Short, poetic quotes about true love, loyalty, and deep connection using nature metaphors
- **Cultural Wisdom**: Infuses advice with Oromo values of 'Safuu' (respect) and 'Namusa Oromummaa' (cultural ethics)
- **Language**: Communicates primarily in Afan Oromo with English when needed
- **Proactive Sweetness**: Suggests romantic gestures and loving words

The AI automatically participates in all conversations to enhance your romantic connection!

## 🚀 Quick Start

### Local Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

## 📦 Deployment

### Railway (Recommended)

1. **Fork/Clone this repository to GitHub**

2. **Connect to Railway:**
   - Go to [Railway.app](https://railway.app)
   - Sign up/Login with GitHub
   - Click "New Project" → "Deploy from GitHub repo"
   - Select this repository

3. **Configure Environment Variables:**
   In Railway dashboard, go to your project → Variables:
   ```
   JWT_SECRET=your-secure-random-jwt-secret
   OPENAI_API_KEY=your-openai-api-key (optional)
   PORT=3000
   ```

4. **Deploy:**
   - Railway will automatically detect the Dockerfile and deploy
   - Your app will be live at `https://your-project-name.up.railway.app`

### Alternative Deployment Options

#### Vercel
```bash
npm i -g vercel
vercel --prod
```

#### Render
1. Connect GitHub repo to Render
2. Choose "Web Service"
3. Set build command: `npm run build`
4. Set start command: `npm run start`

#### Heroku
```bash
heroku create your-app-name
git push heroku main
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `JWT_SECRET` | Secret key for JWT tokens | Yes |
| `OPENAI_API_KEY` | OpenAI API key for AI features | No |
| `PORT` | Server port (default: 3000) | No |

### User Accounts

Default accounts:
- `soulmate` / `love2024`
- `girl` / `love2024`
- `boss` / `boss2024` (admin access)

## 🤖 Gorsa Jaalalaa Features

**Gorsa Jaalalaa** participates automatically in all conversations and also responds to manual commands:

- **Automatic Guidance**: Provides romantic advice and poetic expressions in Afan Oromo
- **Cultural Wisdom**: Shares Oromo cultural values of respect, patience, and loyalty
- **Romantic Suggestions**: Offers sweet gestures and loving words to keep love fresh
- **Romantic Quotes**: Generate beautiful Afan Oromo quotes about true love and loyalty using nature metaphors
- **AI Generate Button**: Quick purple sparkle button (✨) in chat input for instant romantic content

**Manual Commands** for specific requests:
- `/ai [message]` - Direct romantic guidance
- `@ai [message]` - Love advice and poetry
- `!ai [message]` - Relationship wisdom
- `ai: [message]` - Cultural romantic expressions
- `/quote` or `/romantic` - Generate poetic Afan Oromo romantic quotes

Gorsa Jaalalaa appears as your loving companion in every conversation! 💕

## 🛠️ Tech Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS v4
- **Backend:** Node.js, Express, Socket.io
- **Database:** JSON file storage (persistent)
- **AI:** OpenAI GPT-4o-mini
- **Deployment:** Docker, Railway

## 📁 Project Structure

```
├── src/
│   ├── app/          # Next.js app router
│   ├── components/   # React components
│   └── types/        # TypeScript types
├── server.js         # Express server with Socket.io
├── database.json     # Persistent data storage
├── Dockerfile        # Docker configuration
└── railway.json      # Railway deployment config
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

MIT License - feel free to use this project for your own romantic chat app!

## 💕 About

Built with love for soulmate conversations. Features a beautiful, romantic design perfect for couples or private messaging.