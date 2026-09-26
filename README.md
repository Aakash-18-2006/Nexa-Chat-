# NEXA — Full-Stack Real-Time Messaging Platform

NEXA is a modern, production-grade real-time chat application built with **React**, **Node.js**, **Express**, **Socket.IO**, and **MongoDB**. It features real-time 1-to-1 and group messaging, ephemeral code-based temporary rooms, voice notes, media & file sharing, message reactions, editing, pinning, and an integrated AI assistant (conversation summarization, smart reply suggestions, and contextual chat Q&A).

---

## 🏗️ Architecture

```
NEXA/
├── frontend/                     # React 19 + Vite + Tailwind CSS v4
│   ├── src/
│   │   ├── api/                 # Axios HTTP client and centralized API endpoints
│   │   ├── components/
│   │   │   ├── auth/            # AuthModal (Login & Registration)
│   │   │   ├── chat/            # Sidebar, ChatWindow, MessageList, MessageItem, Composer, RightPanel
│   │   │   ├── groups/          # CreateGroupModal, AddMembersModal
│   │   │   ├── tempRooms/       # TempRoomModal, TempRoomWindow
│   │   │   ├── ai/              # AIAssistantModal, AISuggestionsBar
│   │   │   ├── search/          # GlobalSearchModal
│   │   │   ├── settings/        # SettingsModal
│   │   │   ├── landing/         # LandingPage
│   │   │   └── ui/              # Avatar, Modal
│   │   ├── context/             # AuthContext, SocketContext, ChatContext, ThemeContext
│   │   ├── utils/               # Formatters & Web Audio API synthesizer
│   │   ├── App.jsx              # Main dashboard orchestration
│   │   └── index.css            # Design tokens, glassmorphism, scrollbars
│   ├── vercel.json              # Vercel deployment configuration
│   └── package.json
│
├── backend/                      # Node.js + Express + Socket.IO + Mongoose
│   ├── src/
│   │   ├── config/              # db.js (MongoDB connection)
│   │   ├── controllers/         # Auth, User, Conversation, Message, Group, TempRoom, AI, Search, Notification
│   │   ├── middleware/          # authMiddleware (JWT), upload (Multer with security filters)
│   │   ├── models/              # User, Group, Conversation, Message, TemporaryRoom, Notification
│   │   ├── routes/              # RESTful API route definitions
│   │   ├── services/            # aiService.js (Gemini / Heuristic engine), storageService.js
│   │   ├── sockets/             # socketHandlers.js (presence, typing, read receipts, reactions)
│   │   └── server.js            # Express & HTTP server bootstrap
│   ├── Procfile                 # Production process file (Render / Railway / Heroku)
│   └── package.json
│
├── scratch/                      # Automated test scripts
│   ├── test_api.js              # REST API automated suite
│   ├── multi_user_socket_test.js# Dual-client real-time Socket.IO test
│   └── test_persistence_after_restart.js # MongoDB persistence verification
│
├── render.yaml                   # Infrastructure-as-code deployment blueprint
├── .env.example                  # Environment configuration template
└── package.json                  # Root monorepo orchestration scripts
```

---

## ✨ Core Features

### 1. Real Authentication & Security
- **JWT Authentication**: Signed JWT tokens, persistent session, and authenticated Socket.IO handshakes.
- **Bcrypt Password Hashing**: Passwords hashed with salted bcrypt rounds before saving to MongoDB.
- **Route Authorization**: Users can only access conversations they are authorized participants of.

### 2. 1-to-1 & Group Messaging
- **Instant WebSockets**: Real-time message propagation via authenticated Socket.IO connections.
- **Presence & Online Status**: Real-time online/offline tracking with last-seen timestamps.
- **Live Typing Indicators**: Live typing indicator with auto-stop timer.
- **Message Interactions**:
  - Reply with context preview
  - Rich emoji reactions (`👍`, `❤️`, `🔥`, `😂`, `🎉`, `😮`)
  - Pinning with quick jump
  - Message editing with `(edited)` indicator
  - Soft deletion
  - Delivery and read receipts checkmarks
- **Media & Files**:
  - Image preview with lightbox
  - Voice recording with live timer and audio player
  - Documents (PDF, docx, zip) with download links and file sizes
- **Group Governance**: Create groups, assign/demote admins, add/remove members, and leave groups.

### 3. Ephemeral Temporary Chat Rooms
- **Instant Code Generation**: Generate unique 6-character room codes (e.g., `X7K92P`).
- **Join-by-Code**: Quick entry without prior contact addition.
- **Live Expiration Countdown**: Configurable duration (15m, 1h, 6h, 24h) with MongoDB TTL automatic cleanup.

### 4. Contextual AI Assistant
- **AI Smart Replies**: 3 clickable quick-reply options generated from recent conversation context.
- **Chat Summarization**: Synthesizes recent conversation into structured bullet points with action items.
- **Translator**: Multilingual real-time translation with one-click insertion into the chat message composer.
- **Dual Engine**: Calls Google Gemini / OpenAI API if configured in `.env`, with a built-in intelligent contextual heuristic engine fallback.

### 5. Unified Global Search
- Real-time debounced search querying MongoDB across **Users**, **Groups**, and **Message Contents**.
- Clicking a message result automatically opens the conversation and scrolls directly to that message.

---

## 🛠️ Getting Started Locally

### Prerequisites
- Node.js (v18+)
- MongoDB (Running locally on `mongodb://127.0.0.1:27017` or a MongoDB Atlas URI)

### Installation

1. **Install Root, Backend, and Frontend Dependencies**:
```bash
# In project root:
cd backend && npm install
cd ../frontend && npm install
```

2. **Configure Environment Variables**:
Copy `.env.example` into `backend/.env`:
```bash
cp .env.example backend/.env
```

3. **Start Development Servers**:
```bash
# Option A: Run concurrently from root
npm run dev:backend
npm run dev:frontend

# Option B: In separate terminals
# Terminal 1:
cd backend && npm run dev

# Terminal 2:
cd frontend && npm run dev
```

4. Open **http://localhost:5173/** in your browser.

---

## 🧪 Automated Test Verification Suite

NEXA includes 3 comprehensive automated test suites:

### 1. REST API Integration Suite
Tests user registration, login, user search, 1-to-1 chat, group creation, AI replies, AI summary, AI ask, and temporary room generation:
```bash
node scratch/test_api.js
```

### 2. Multi-User Dual-Socket Real-Time Test
Spawns 2 concurrent Socket.IO clients with distinct JWT credentials. Verifies typing indicators, instant messaging, bidirectional replies, delivery receipts, read receipts, emoji reactions, message updates, and disconnect presence:
```bash
node scratch/multi_user_socket_test.js
```

### 3. Data Persistence Across Server Restarts
Restarts the backend and frontend processes, logs in with pre-existing credentials, and asserts that all conversations, messages, reactions, and edit flags remain intact in MongoDB:
```bash
node scratch/test_persistence_after_restart.js
```

---

## 🚀 Production Deployment

### Frontend (Vercel)
1. Push this repository to GitHub.
2. Import the project in [Vercel](https://vercel.com).
3. Set **Root Directory** to `frontend`.
4. Add Environment Variable:
   - `VITE_API_URL`: URL of your deployed backend (e.g. `https://nexa-backend.onrender.com`).
5. Deploy. `vercel.json` will automatically handle client-side routing.

### Backend (Render / Railway)
1. In [Render](https://render.com) or [Railway](https://railway.app), create a new **Web Service**.
2. Point to the repository with **Root Directory** set to `backend` (or use the root `render.yaml` blueprint).
3. Set Build Command: `npm install`
4. Set Start Command: `npm start`
5. Configure Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `5000` (or host provided)
   - `MONGODB_URI`: Your MongoDB Atlas connection string (`mongodb+srv://...`)
   - `JWT_SECRET`: A secure random 32+ character string
   - `CLIENT_URL`: URL of your deployed frontend (e.g. `https://nexa-chat.vercel.app`)
   - `GEMINI_API_KEY`: *(Optional)* Google Gemini API key for advanced AI features

---

## 🔒 Security Summary
- Passwords salted and hashed with bcrypt.
- JWT verification on every private API route and Socket.IO handshake.
- Role-based authorization for group management (only admins can add/remove members).
- File upload sanitization: Executable scripts (`.exe`, `.sh`, `.bat`) blocked; file sizes capped.
- Protection against unauthorized chat access: Users can only query messages from conversations they are members of.
