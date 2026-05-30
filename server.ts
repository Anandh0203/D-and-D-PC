import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

interface SignalMessage {
  id: string;
  sender: "duckie" | "dobby";
  type: string;
  payload: any;
  timestamp: number;
}

interface ChatMessage {
  id: string;
  sender: "duckie" | "dobby";
  text: string;
  timestamp: number;
  isOffline?: boolean;
}

interface MediaState {
  url: string;
  playing: boolean;
  currentTime: number;
  sender: "duckie" | "dobby";
  timestamp: number;
}

// In-Memory signaling queues
const signalQueues = {
  duckie: [] as SignalMessage[],
  dobby: [] as SignalMessage[],
};

// In-memory Room State
let mediaState: MediaState = {
  url: "",
  playing: false,
  currentTime: 0,
  sender: "dobby",
  timestamp: Date.now(),
};

let chatMessages: ChatMessage[] = [
  {
    id: "system-welcome",
    sender: "duckie",
    text: "Welcome to our Private Theater Palace, my Dobby! ❤️🍿 Ready to watch movies?",
    timestamp: Date.now(),
  },
];

let presence = {
  lastSeenDuckie: 0,
  lastSeenDobby: 0,
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // HEALTH CHECK
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // GET ROOM STATE
  app.get("/api/theater/state", (req, res) => {
    const now = Date.now();
    res.json({
      media: mediaState,
      chats: chatMessages,
      presence: {
        duckieOnline: now - presence.lastSeenDuckie < 6000,
        dobbyOnline: now - presence.lastSeenDobby < 6000,
        lastSeenDuckie: presence.lastSeenDuckie,
        lastSeenDobby: presence.lastSeenDobby,
      },
      serverTime: now,
    });
  });

  // PRESENCE HEARTBEAT
  app.post("/api/theater/heartbeat", (req, res) => {
    const { role } = req.body;
    const now = Date.now();
    if (role === "duckie") {
      presence.lastSeenDuckie = now;
    } else if (role === "dobby") {
      presence.lastSeenDobby = now;
    }
    const otherOnline = role === "duckie" 
      ? now - presence.lastSeenDobby < 6000 
      : now - presence.lastSeenDuckie < 6000;

    res.json({ success: true, otherOnline, serverTime: now });
  });

  // SEND MEDIA STATE SYNC
  app.post("/api/theater/media-sync", (req, res) => {
    const { url, playing, currentTime, sender } = req.body;
    mediaState = {
      url: url ?? mediaState.url,
      playing: playing ?? false,
      currentTime: typeof currentTime === "number" ? currentTime : mediaState.currentTime,
      sender: sender || mediaState.sender,
      timestamp: Date.now(),
    };
    res.json({ success: true, media: mediaState });
  });

  // POST SIGNAL (PEER SIGNALS FOR WEBRTC CONNS)
  app.post("/api/theater/signal", (req, res) => {
    const { sender, type, payload } = req.body;
    if (!sender || !type) {
      return res.status(400).json({ error: "Missing sender or type" });
    }

    const signal: SignalMessage = {
      id: Math.random().toString(36).substr(2, 9),
      sender,
      type,
      payload,
      timestamp: Date.now(),
    };

    // Signals from Duckie are queued for Dobby to receive, and vice-versa
    const target: "duckie" | "dobby" = sender === "duckie" ? "dobby" : "duckie";
    signalQueues[target].push(signal);

    res.json({ success: true });
  });

  // POLL SIGNALS
  app.get("/api/theater/signal/poll", (req, res) => {
    const { role } = req.query as { role?: "duckie" | "dobby" };
    if (!role || (role !== "duckie" && role !== "dobby")) {
      return res.status(400).json({ error: "Valid role is required" });
    }

    // Capture and empty queue for this role
    const signals = [...signalQueues[role]];
    signalQueues[role] = [];

    // Keep queue lengths in check
    if (signalQueues.duckie.length > 50) signalQueues.duckie.shift();
    if (signalQueues.dobby.length > 50) signalQueues.dobby.shift();

    res.json({ signals });
  });

  // PUSH CHAT MESSAGE
  app.post("/api/theater/chat", (req, res) => {
    const { sender, text, id } = req.body;
    if (!sender || !text) {
      return res.status(400).json({ error: "Missing sender or text" });
    }

    const newChat: ChatMessage = {
      id: id || Math.random().toString(36).substr(2, 9),
      sender,
      text,
      timestamp: Date.now(),
    };

    // Deduplicate if already present (e.g., from retry)
    if (!chatMessages.some((c) => c.id === newChat.id)) {
      chatMessages.push(newChat);
    }

    // Keep message history to 200 items max
    if (chatMessages.length > 200) {
      chatMessages.shift();
    }

    res.json({ success: true, chat: newChat });
  });

  // OFFLINE INTEGRITY SYNCER
  app.post("/api/theater/offline-sync", (req, res) => {
    const { messages } = req.body as { messages: ChatMessage[] };
    if (Array.isArray(messages)) {
      messages.forEach((msg) => {
        if (!chatMessages.some((c) => c.id === msg.id)) {
          chatMessages.push({
            id: msg.id,
            sender: msg.sender,
            text: msg.text,
            timestamp: msg.timestamp,
          });
        }
      });
    }

    // Sort clean
    chatMessages.sort((a, b) => a.timestamp - b.timestamp);
    if (chatMessages.length > 200) {
      chatMessages = chatMessages.slice(chatMessages.length - 200);
    }

    res.json({ success: true, chats: chatMessages, media: mediaState });
  });

  // RESTORE THEATER CHAT
  app.post("/api/theater/clear", (req, res) => {
    chatMessages = [
      {
        id: "system-reset",
        sender: "dobby",
        text: "The screen has been cleared. Cinema stage reset! 🍿🎬",
        timestamp: Date.now(),
      },
    ];
    mediaState = {
      url: "",
      playing: false,
      currentTime: 0,
      sender: "dobby",
      timestamp: Date.now(),
    };
    res.json({ success: true });
  });

  // VITE SERVER INTERACTION
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`D & D Cinema Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
