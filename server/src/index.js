const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");
const { setupSocket } = require("./socket");

const app = express();
app.use(cors({
  origin: process.env.CLIENT_URL || "*",
  methods: ["GET", "POST"],
  credentials: true,
}));
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/chat", chatRoutes);

app.get("/health", (_, res) => res.json({ status: "ok" }));

// Serve client build
const clientPath = path.join(__dirname, "../../client/dist");
app.use(express.static(clientPath));
app.get("{*path}", (req, res) => {
  res.sendFile(path.join(clientPath, "index.html"));
});

const server = http.createServer(app);
const io = setupSocket(server);

// Make io accessible in routes if needed
app.set("io", io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
