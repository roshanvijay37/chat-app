const BASE = "http://localhost:3000";

async function test() {
  // Test health
  let res = await fetch(`${BASE}/health`);
  console.log("Health:", await res.json());

  // Test signup user 1
  res = await fetch(`${BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "vijayroshan63@gmail.com",
      password: "Test1234!",
      displayName: "User One",
    }),
  });
  const signup1 = await res.json();
  console.log("Signup User1:", signup1.error || "OK");

  // Test signup user 2
  res = await fetch(`${BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "roshanvijayshetty@gmail.com",
      password: "Test1234!",
      displayName: "User Two",
    }),
  });
  const signup2 = await res.json();
  console.log("Signup User2:", signup2.error || "OK");

  // Login user 1
  res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "vijayroshan63@gmail.com", password: "Test1234!" }),
  });
  const login1 = await res.json();
  console.log("Login User1:", login1.error || "OK");

  // Login user 2
  res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "roshanvijayshetty@gmail.com", password: "Test1234!" }),
  });
  const login2 = await res.json();
  console.log("Login User2:", login2.error || "OK");

  if (!login1.session || !login2.session) {
    console.log("Login failed, cannot test chat routes");
    return;
  }

  const token1 = login1.session.access_token;
  const token2 = login2.session.access_token;

  // Start a conversation (user1 -> user2)
  res = await fetch(`${BASE}/chat/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token1}` },
    body: JSON.stringify({ userId: login2.user.id }),
  });
  const conv = await res.json();
  console.log("Create Conversation:", conv);

  const convId = conv.conversation?.id;
  if (!convId) {
    console.log("No conversation created, stopping");
    return;
  }

  // User1 sends a message
  res = await fetch(`${BASE}/chat/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token1}` },
    body: JSON.stringify({ conversationId: convId, content: "Hey! How are you?" }),
  });
  console.log("User1 sends msg:", await res.json());

  // User2 sends a message
  res = await fetch(`${BASE}/chat/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token2}` },
    body: JSON.stringify({ conversationId: convId, content: "Good! You?" }),
  });
  console.log("User2 sends msg:", await res.json());

  // Get message history (user1)
  res = await fetch(`${BASE}/chat/messages/${convId}`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  console.log("Message history:", await res.json());

  // List conversations (user1)
  res = await fetch(`${BASE}/chat/conversations`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  console.log("User1 conversations:", await res.json());

  // Try creating same conversation again (should return existing)
  res = await fetch(`${BASE}/chat/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token1}` },
    body: JSON.stringify({ userId: login2.user.id }),
  });
  console.log("Duplicate conversation check:", await res.json());
}

test().catch(console.error);
