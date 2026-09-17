# WhatsApp Web Clone with Clerk Authentication & Socket.IO 👋

A modern, high-fidelity WhatsApp Web clone powered by **Clerk Authentication** and real-time **Socket.IO** messaging.

---

## ⚡ Key Features

- 🔐 **Clerk Authentication**: Secure sign-in with Google, Email, GitHub, SMS, and OAuth providers.
- 🛡️ **JWT Session Verification**: Socket.IO handshake protected by Clerk token verification middleware.
- 💬 **Real-Time Messaging**: Broadcast channels, private groups, and 1-on-1 direct messages.
- 👤 **Clerk Profile & User Management**: Synced name, avatar, email, and Clerk User Button.
- ⚙️ **In-App API Key Configuration**: Easily configure your Clerk API keys through the UI or `.env`.
- 🎨 **WhatsApp Web Aesthetics**: Sleek dark mode design, sound synthesis, reaction ribbons, typing indicators, image attachments, and call simulator.

---

## 🚀 How to Run the Application

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Clerk Keys
Create a `.env` file (or copy `.env.example`):
```bash
cp .env.example .env
```

Add your keys from the [Clerk Dashboard](https://dashboard.clerk.com):
```env
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
PORT=4000
```
*(Note: If you run without keys, the app provides an in-app setup modal as well as a one-click Guest/Demo mode).*

### 3. Start the Server
```bash
npm start
```
or with auto-reload:
```bash
npm run dev
```

### 4. Open the App
Visit [http://localhost:4000](http://localhost:4000) in your browser.

---

## 🏗️ Architecture & Authentication Flow

1. **Frontend Authentication (`public/index.html` & `public/script.js`)**:
   - Loads the `@clerk/clerk-js` SDK.
   - Signs in the user via Clerk Modal or embedded sign-in.
   - Retrieves a fresh JWT session token via `Clerk.session.getToken()`.
   - Passes the token in the Socket.IO connection handshake: `io({ auth: { token } })`.

2. **Backend Verification (`server.js`)**:
   - Uses `@clerk/backend` to verify the session JWT in `io.use()` middleware.
   - Fetches authenticated Clerk user metadata (`clerkClient.users.getUser()`).
   - Associates authenticated identity with active real-time socket connections.

---

## 📁 Project Structure

```
socketio-demo/
├── .env.example         # Template for Clerk API keys
├── .env                 # Local environment variables
├── package.json         # Node.js dependencies (@clerk/backend, socket.io, express, dotenv)
├── server.js            # Express server with Clerk JWT Socket.IO middleware
└── public/
    ├── index.html       # WhatsApp Web UI + Clerk Auth Portal
    ├── style.css        # WhatsApp Web Dark Theme & Clerk styling
    └── script.js        # Frontend real-time logic, sound synthesis, & Clerk auth
```
