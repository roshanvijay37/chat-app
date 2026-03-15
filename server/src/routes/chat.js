const express = require("express");
const multer = require("multer");
const { supabaseAdmin } = require("../config/supabase");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv",
  "application/zip",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_, file, cb) => {
    if (ALLOWED_TYPES.has(file.mimetype)) cb(null, true);
    else cb(new Error("File type not allowed"));
  },
});

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

// POST /chat/groups - Create a group conversation
router.post("/groups", authMiddleware, async (req, res) => {
  const { name, memberIds } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Group name required" });
  if (!Array.isArray(memberIds) || memberIds.length < 1)
    return res.status(400).json({ error: "At least 1 other member required" });

  const uniqueIds = [...new Set([req.user.id, ...memberIds])];

  const { data: conv, error: convErr } = await supabaseAdmin
    .from("conversations")
    .insert({ type: "group", name: name.trim(), created_by: req.user.id })
    .select()
    .single();

  if (convErr) return res.status(500).json({ error: convErr.message });

  const { error: memErr } = await supabaseAdmin
    .from("conversation_members")
    .insert(uniqueIds.map((id) => ({ conversation_id: conv.id, user_id: id })));

  if (memErr) return res.status(500).json({ error: memErr.message });

  // Notify members via socket so they join the room
  const io = req.app.get("io");
  if (io) {
    const { data: members } = await supabaseAdmin
      .from("conversation_members")
      .select("user_id, profiles(id, display_name, email, avatar_url)")
      .eq("conversation_id", conv.id);

    const groupData = { ...conv, members: members?.map((m) => m.profiles) || [] };
    uniqueIds.forEach((uid) => io.to(`user:${uid}`).emit("group:created", groupData));
  }

  res.status(201).json({ conversation: conv });
});

// POST /chat/groups/:conversationId/members - Add members to group
router.post("/groups/:conversationId/members", authMiddleware, async (req, res) => {
  const { conversationId } = req.params;
  const { userIds } = req.body;
  if (!Array.isArray(userIds) || !userIds.length)
    return res.status(400).json({ error: "userIds required" });

  // Verify conversation is a group and requester is a member
  const { data: conv } = await supabaseAdmin
    .from("conversations")
    .select("type")
    .eq("id", conversationId)
    .single();

  if (!conv || conv.type !== "group")
    return res.status(400).json({ error: "Not a group conversation" });

  const { data: membership } = await supabaseAdmin
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", req.user.id)
    .single();

  if (!membership) return res.status(403).json({ error: "Not a member" });

  // Get existing members to avoid duplicates
  const { data: existing } = await supabaseAdmin
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", conversationId);

  const existingIds = new Set(existing?.map((m) => m.user_id) || []);
  const newIds = userIds.filter((id) => !existingIds.has(id));

  if (!newIds.length) return res.json({ added: 0 });

  const { error } = await supabaseAdmin
    .from("conversation_members")
    .insert(newIds.map((id) => ({ conversation_id: conversationId, user_id: id })));

  if (error) return res.status(500).json({ error: error.message });

  // Notify new members via socket
  const io = req.app.get("io");
  if (io) newIds.forEach((uid) => io.to(`user:${uid}`).emit("group:added", { conversationId }));

  res.json({ added: newIds.length });
});

// GET /chat/groups/:conversationId/members - Get group members
router.get("/groups/:conversationId/members", authMiddleware, async (req, res) => {
  const { conversationId } = req.params;

  const { data: membership } = await supabaseAdmin
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", req.user.id)
    .single();

  if (!membership) return res.status(403).json({ error: "Not a member" });

  const { data: members, error } = await supabaseAdmin
    .from("conversation_members")
    .select("user_id, profiles(id, display_name, email, avatar_url)")
    .eq("conversation_id", conversationId);

  if (error) return res.status(500).json({ error: error.message });
  res.json(members?.map((m) => m.profiles) || []);
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

  // Get conversations with members
  const conversations = [];
  for (const convId of convIds) {
    // Get conversation metadata
    const { data: convData } = await supabaseAdmin
      .from("conversations")
      .select("type, name")
      .eq("id", convId)
      .single();

    const isGroup = convData?.type === "group";

    const { data: members } = await supabaseAdmin
      .from("conversation_members")
      .select("user_id, profiles(id, display_name, email, avatar_url)")
      .eq("conversation_id", convId);

    // Get last message
    const { data: lastMsg } = await supabaseAdmin
      .from("messages")
      .select("id, content, created_at, sender_id, deleted_at, type")
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

    if (isGroup) {
      conversations.push({
        id: convId,
        type: "group",
        name: convData.name,
        members: members?.map((m) => m.profiles) || [],
        lastMessage: lastMsg || null,
        unreadCount: unreadCount || 0,
      });
    } else {
      const other = members?.find((m) => m.user_id !== req.user.id);
      conversations.push({
        id: convId,
        type: "direct",
        participant: other?.profiles || null,
        lastMessage: lastMsg || null,
        unreadCount: unreadCount || 0,
      });
    }
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

// POST /chat/upload - Upload a file and send as message
router.post("/upload", authMiddleware, (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  const { conversationId } = req.body;
  if (!req.file || !conversationId)
    return res.status(400).json({ error: "file and conversationId required" });

  // Verify membership
  const { data: member } = await supabaseAdmin
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", req.user.id)
    .single();

  if (!member) return res.status(403).json({ error: "Not a member" });

  const ext = req.file.originalname.split(".").pop();
  const filePath = `${conversationId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: uploadErr } = await supabaseAdmin.storage
    .from("chat-files")
    .upload(filePath, req.file.buffer, { contentType: req.file.mimetype });

  if (uploadErr) return res.status(500).json({ error: uploadErr.message });

  const { data: urlData } = supabaseAdmin.storage.from("chat-files").getPublicUrl(filePath);

  const isImage = req.file.mimetype.startsWith("image/");
  const fileInfo = JSON.stringify({
    url: urlData.publicUrl,
    fileName: req.file.originalname,
    fileSize: req.file.size,
    mimeType: req.file.mimetype,
  });

  const { data: message, error: msgErr } = await supabaseAdmin
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: req.user.id,
      content: fileInfo,
      type: isImage ? "image" : "file",
    })
    .select("*, profiles:sender_id(display_name, avatar_url)")
    .single();

  if (msgErr) return res.status(500).json({ error: msgErr.message });

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
