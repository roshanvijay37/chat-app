const express = require("express");
const { supabaseAdmin } = require("../config/supabase");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// POST /chat/conversations - Start a 1-on-1 conversation
router.post("/conversations", authMiddleware, async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId required" });
  if (userId === req.user.id)
    return res.status(400).json({ error: "Cannot chat with yourself" });

  // Check if conversation already exists between these two users
  const { data: existing } = await supabaseAdmin.rpc("find_direct_conversation", {
    user_a: req.user.id,
    user_b: userId,
  });

  if (existing && existing.length > 0) {
    return res.json({ conversation: { id: existing[0].conversation_id } });
  }

  // Create new conversation
  const { data: conv, error: convErr } = await supabaseAdmin
    .from("conversations")
    .insert({ type: "direct" })
    .select()
    .single();

  if (convErr) return res.status(500).json({ error: convErr.message });

  // Add both users as members
  const { error: memErr } = await supabaseAdmin
    .from("conversation_members")
    .insert([
      { conversation_id: conv.id, user_id: req.user.id },
      { conversation_id: conv.id, user_id: userId },
    ]);

  if (memErr) return res.status(500).json({ error: memErr.message });

  res.status(201).json({ conversation: conv });
});

// GET /chat/conversations - List user's conversations
router.get("/conversations", authMiddleware, async (req, res) => {
  const { data: memberships, error: memErr } = await supabaseAdmin
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", req.user.id);

  if (memErr) return res.status(500).json({ error: memErr.message });

  const convIds = memberships.map((m) => m.conversation_id);
  if (convIds.length === 0) return res.json([]);

  // Get conversations with the other member's profile
  const conversations = [];
  for (const convId of convIds) {
    const { data: members } = await supabaseAdmin
      .from("conversation_members")
      .select("user_id, profiles(id, display_name, email, avatar_url)")
      .eq("conversation_id", convId)
      .neq("user_id", req.user.id);

    // Get last message
    const { data: lastMsg } = await supabaseAdmin
      .from("messages")
      .select("id, content, created_at, sender_id, deleted_at")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Get unread count
    const { count: unreadCount } = await supabaseAdmin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", convId)
      .neq("sender_id", req.user.id)
      .is("read_at", null);

    conversations.push({
      id: convId,
      participant: members?.[0]?.profiles || null,
      lastMessage: lastMsg || null,
      unreadCount: unreadCount || 0,
    });
  }

  // Sort by last message time
  conversations.sort((a, b) => {
    const timeA = a.lastMessage?.created_at || "0";
    const timeB = b.lastMessage?.created_at || "0";
    return timeB.localeCompare(timeA);
  });

  res.json(conversations);
});

// POST /chat/messages - Send a message
router.post("/messages", authMiddleware, async (req, res) => {
  const { conversationId, content } = req.body;
  if (!conversationId || !content)
    return res.status(400).json({ error: "conversationId and content required" });

  // Verify user is a member
  const { data: member } = await supabaseAdmin
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", req.user.id)
    .single();

  if (!member) return res.status(403).json({ error: "Not a member of this conversation" });

  const { data: message, error } = await supabaseAdmin
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: req.user.id,
      content,
      type: "text",
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Emit via Socket.IO for real-time delivery
  const io = req.app.get("io");
  if (io) io.to(conversationId).emit("message:new", message);

  res.status(201).json(message);
});

// GET /chat/find-user - Find a user by email or username
router.get("/find-user", authMiddleware, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Search query required" });

  const isEmail = q.includes("@");
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, display_name, email")
    .ilike(isEmail ? "email" : "display_name", isEmail ? q : q)
    .single();

  if (error || !data) return res.status(404).json({ error: "User not found" });
  if (data.id === req.user.id) return res.status(400).json({ error: "That's you!" });

  res.json(data);
});

// GET /chat/messages/:conversationId - Get message history
router.get("/messages/:conversationId", authMiddleware, async (req, res) => {
  const { conversationId } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  const before = req.query.before; // cursor for pagination

  // Verify membership
  const { data: member } = await supabaseAdmin
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", req.user.id)
    .single();

  if (!member) return res.status(403).json({ error: "Not a member of this conversation" });

  let query = supabaseAdmin
    .from("messages")
    .select("*, profiles:sender_id(display_name, avatar_url)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (before) query = query.lt("created_at", before);

  const { data: messages, error } = await query;

  if (error) return res.status(500).json({ error: error.message });

  res.json(messages);
});

module.exports = router;
