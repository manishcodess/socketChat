# WhatsApp Web Clone (Full-Stack Architecture) 🚀

A production-ready, full-stack WhatsApp Web clone built with **Vite**, **Express**, **Socket.IO**, **MongoDB Atlas**, **ImageKit CDN**, and **Clerk Authentication**. Ready for 1-click **Docker** and **Render** deployment.

---

## 🚀 Easy Render Deployment Guide (Docker)

You can deploy the entire application (Frontend + Backend + WebSockets) to **Render** using Docker in 3 simple steps:

### Step 1: Push Your Code to GitHub
Ensure all your files (including `Dockerfile`, `render.yaml`, and `.dockerignore`) are pushed to your GitHub repository:
```bash
git add .
git commit -m "Add Docker and Render deployment configuration"
git push
```

### Step 2: Create a New Web Service on Render
1. Open [dashboard.render.com](https://dashboard.render.com) and click **New +** &rarr; **Web Service**.
2. Connect your GitHub repository: `manishcodess/socketChat` (or your repository name).
3. Set the following settings:
   - **Name**: `socketchat` (or any name you like)
   - **Language**: `Docker`
   - **Branch**: `main`
   - **Region**: Choose the closest region (e.g. `Singapore` or `Oregon`)
   - **Instance Type**: `Free` (or higher)

### Step 3: Add Environment Variables in Render Dashboard
Under the **Environment Variables** section on Render, add:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | `mongodb+srv://algoforge-user:algoforge-user@cluster0.hkz31gd.mongodb.net/algoforge` |
| `CLERK_PUBLISHABLE_KEY` | `pk_test_Ym9sZC1lbGVwaGFudC01ODgyLmNsZXJrLmFjY291bnRzLmRldiQ` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_Ym9sZC1lbGVwaGFudC01ODgyLmNsZXJrLmFjY291bnRzLmRldiQ` |
| `CLERK_SECRET_KEY` | `sk_test_PC3BfpKk10Q0vmvti5j4FEi4CDKigUJWY91ltWmd20` |
| `IMAGEKIT_PUBLIC_KEY` | `public_3NSKOeGZwb3WHqX39YYRP0shRa4=` |
| `IMAGEKIT_PRIVATE_KEY` | `private_oduvld3ueON3ypiQqFevvDirKe4=` |
| `IMAGEKIT_URL_ENDPOINT` | `https://ik.imagekit.io/manishcodess` |

Click **Deploy Web Service**! Render will build the Docker container and provide a live URL (e.g. `https://socketchat.onrender.com`).

---

## 🐳 Running Locally with Docker

### Using Docker Compose
```bash
docker-compose up --build
```
Open [http://localhost:4000](http://localhost:4000) in your browser.

### Using Docker CLI
```bash
# Build the Docker image
docker build -t socketchat-app .

# Run the container
docker run -p 4000:10000 --env-file backend/.env socketchat-app
```

---

## 💻 Running in Local Development (Without Docker)

### 1. Install Dependencies
```bash
npm run install:all
```

### 2. Start Both Services Concurrently
```bash
npm run dev
```
- **Frontend Web App (Vite with Hot Reload)**: [http://localhost:3000](http://localhost:3000)
- **Backend API & Socket.IO Server**: [http://localhost:4000](http://localhost:4000)

---

## 📁 Modular Project Architecture

```
socketchat/
├── Dockerfile                # Multi-stage Docker build (Vite + Express)
├── .dockerignore             # Production Docker ignore rules
├── docker-compose.yml        # Local container orchestration
├── render.yaml               # Render Blueprint deployment config
├── package.json              # Monorepo runner (concurrently scripts)
├── README.md                 # Fullstack documentation
│
├── backend/                  # 🛡️ Real-Time API, Database & WebSocket Server (Port 4000)
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js         # MongoDB connection via Mongoose
│   │   │   ├── clerk.js      # Clerk Backend client
│   │   │   └── imagekit.js   # ImageKit SDK client
│   │   ├── models/
│   │   │   ├── User.js       # User Model (clerkId, name, avatar, email, isOnline, lastSeen)
│   │   │   └── Message.js    # Message Model (msgId, chatId, text, attachment, reactions, timestamp)
│   │   ├── controllers/
│   │   │   ├── authController.js    # Auth config & user list API
│   │   │   ├── messageController.js # MongoDB Chat history API
│   │   │   └── uploadController.js  # ImageKit image upload & auth parameters
│   │   ├── routes/
│   │   │   ├── authRoutes.js        # /api/auth
│   │   │   ├── messageRoutes.js     # /api/messages
│   │   │   └── uploadRoutes.js      # /api/upload
│   │   └── sockets/
│   │       ├── socketAuth.js        # Socket.IO Clerk JWT & Guest middleware
│   │       └── chatSocket.js        # Real-time message persistence & presence events
│   ├── server.js             # Modular server entry point (serves static build in prod)
│   ├── package.json          # Dependencies (mongoose, imagekit, multer, socket.io, @clerk/backend)
│   └── .env                  # Backend credentials (MongoDB, Clerk, ImageKit)
│
└── frontend/                 # 💻 Client Web Application (Port 3000)
    ├── package.json          # Vite dev server & build tooling
    ├── index.html            # WhatsApp Web UI + Clerk Auth Portal
    ├── style.css             # WhatsApp Web Dark Theme
    └── script.js             # Real-time chat logic, ImageKit upload & MongoDB history sync
```
