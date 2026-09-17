# WhatsApp Web Clone (Separate Frontend & Backend) 👋

A modern, full-stack WhatsApp Web clone built with a separated **Frontend** (Vite + Vanilla JS/CSS + Clerk Browser SDK) and **Backend** (Express + Socket.IO + Clerk Backend JWT Verification).

---

## 📁 Project Architecture

```
socketchat/
├── package.json              # Monorepo root orchestration scripts (concurrently)
├── README.md                 # Project documentation
│
├── backend/                  # 🛡️ Real-Time API & WebSocket Server
│   ├── package.json          # Express, Socket.IO, @clerk/backend, cors, dotenv
│   ├── server.js             # API routes & Socket.IO handlers with CORS
│   ├── .env.example          # Backend environment variables template
│   └── .env                  # Backend environment variables
│
└── frontend/                 # 💻 Client Web Application
    ├── package.json          # Vite dev server & build tooling
    ├── index.html            # WhatsApp Web UI + Clerk Auth Portal
    ├── style.css             # WhatsApp Web Dark Theme
    └── script.js             # Frontend real-time logic, sound synthesis, & Clerk auth
```

---

## ⚡ Key Features

- 🔐 **Clerk Authentication**: Sign in via Google, Email, GitHub, SMS, and OAuth providers.
- 🛡️ **JWT Session Verification**: Socket.IO connection protected by backend Clerk JWT verification middleware.
- 💬 **Real-Time Messaging**: Broadcast channels, private group rooms, and direct 1-to-1 chats.
- 🌐 **Clean Frontend / Backend Separation**:
  - Independent `package.json` for backend and frontend.
  - Express CORS enabled for cross-origin API calls (`/api/auth/config`).
  - Dynamic `BACKEND_URL` resolution for flexible deployment.
- 🎨 **WhatsApp Web UI**: Sleek dark mode design, sound synthesis, reaction ribbons, typing indicators, image attachments, and call simulator.

---

## 🚀 Quick Start Guide

### 1. Install All Dependencies
From the repository root, install dependencies for the root orchestrator, backend, and frontend:
```bash
npm run install:all
```

### 2. Configure Clerk Keys
Copy `.env.example` in `backend/`:
```bash
cp backend/.env.example backend/.env
```

Add your keys from the [Clerk Dashboard](https://dashboard.clerk.com):
```env
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
PORT=4000
```
*(Note: If you run without keys, the app provides an in-app setup modal as well as a one-click Guest/Demo mode).*

### 3. Run Both Services Concurrently
```bash
npm run dev
```
- **Backend API & Socket.IO**: [http://localhost:4000](http://localhost:4000)
- **Frontend Web App**: [http://localhost:3000](http://localhost:3000)

---

## 🛠️ Individual Service Commands

### Backend Only (`backend/`)
```bash
# Run backend development server (with --watch)
npm run dev:backend

# Or directly from backend folder:
cd backend
npm run dev
```

### Frontend Only (`frontend/`)
```bash
# Run frontend development server (Vite on port 3000)
npm run dev:frontend

# Build frontend for production
npm run build:frontend

# Or directly from frontend folder:
cd frontend
npm run dev
```

---

## 🔐 Authentication & Real-Time Flow

1. **Frontend (`frontend/index.html` & `frontend/script.js`)**:
   - Queries `GET http://localhost:4000/api/auth/config` to dynamically retrieve the Clerk Publishable Key.
   - Initializes Clerk JS Browser SDK.
   - Upon sign-in, obtains the JWT session token (`Clerk.session.getToken()`).
   - Connects to Socket.IO server: `io(BACKEND_URL, { auth: { token, user } })`.

2. **Backend (`backend/server.js`)**:
   - Handles CORS for cross-origin frontend requests.
   - Uses `@clerk/backend` to verify session JWT tokens in Socket.IO middleware.
   - Associates authenticated user details (`name`, `avatar`, `email`, `clerkId`) with the socket.
   - Broadcasts real-time events across rooms and direct channels.
