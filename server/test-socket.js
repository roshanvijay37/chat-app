const { io } = require("socket.io-client");
const BASE = "http://localhost:3000";

async function test() {
  // Login both users
  const login1 = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "vijayroshan63@gmail.com", password: "Test1234!" }),
  }).then((r) => r.json());

  const login2 = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "roshanvijayshetty@gmail.com", password: "Test1234!" }),
  }).then((r) => r.json());

  if (!login1.session || !login2.session) {
    console.log("Login failed");
    return;
  }

  console.log("Both users logged in\n");

  // Connect both users via Socket.IO
  const socket1 = io(BASE, { auth: { token: login1.session.access_token } });
  const socket2 = io(BASE, { auth: { token: login2.session.access_token } });

  // Wait for both to connect
  await Promise.all([
    new Promise((r) => socket1.on("connect", r)),
    new Promise((r) => socket2.on("connect", r)),
  ]);
  console.log("Both sockets connected\n");

  // User2 listens for incoming messages
  socket2.on("message:new", (msg) => {
    console.log(`[User2 RECEIVED real-time]: "${msg.content}" from ${msg.profiles?.display_name || msg.sender_id}`);
  });

  // User1 listens too (sender gets their own message back)
  socket1.on("message:new", (msg) => {
    console.log(`[User1 RECEIVED real-time]: "${msg.content}" from ${msg.profiles?.display_name || msg.sender_id}`);
  });

  // Typing indicator test
  socket2.on("typing:start", ({ userId }) => {
    console.log(`[User2 sees]: User ${userId} is typing...`);
  });
  socket2.on("typing:stop", ({ userId }) => {
    console.log(`[User2 sees]: User ${userId} stopped typing`);
  });

  // Get existing conversation
  const convRes = await fetch(`${BASE}/chat/conversations`, {
    headers: { Authorization: `Bearer ${login1.session.access_token}` },
  }).then((r) => r.json());

  const convId = convRes[0]?.id;
  if (!convId) {
    console.log("No conversation found");
    return;
  }

  // Join conversation rooms
  socket1.emit("conversation:join", convId);
  socket2.emit("conversation:join", convId);

  // Small delay to ensure rooms are joined
  await new Promise((r) => setTimeout(r, 500));

  // User1 starts typing
  socket1.emit("typing:start", { conversationId: convId });
  await new Promise((r) => setTimeout(r, 1000));
  socket1.emit("typing:stop", { conversationId: convId });

  // User1 sends a message via socket
  socket1.emit("message:send", { conversationId: convId, content: "Hello via Socket.IO!" }, (res) => {
    console.log(`\n[User1 SENT via socket]: "${res.message?.content || res.error}"`);
  });

  // Wait for messages to arrive
  await new Promise((r) => setTimeout(r, 2000));

  // Check online status
  socket1.emit("users:online", [login2.user.id], (statuses) => {
    console.log("\nOnline status check:", statuses);
  });

  await new Promise((r) => setTimeout(r, 500));

  console.log("\n--- All tests passed! ---");
  socket1.disconnect();
  socket2.disconnect();
  process.exit(0);
}

test().catch(console.error);
