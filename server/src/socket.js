const { Server } = require("socket.io");
const { supabase, supabaseAdmin } = require("./config/supabase");

// Track online users: userId -> Set of socketIds
const onlineUsers = new Map();

function setupSocket(server) {
  const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  // Authenticate socket connections
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token provided"));

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return next(new Error("Invalid token"));

    socket.user = user;
    next();
  });

  io.on("connection", async (socket) => {
    const userId = socket.user.id;
    console.log(`User connected: ${userId}`);

    // Track online status
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);

    // Join all conversation rooms
    const { data: memberships } = await supabaseAdmin
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", userId);

    if (memberships) {
      memberships.forEach((m) => socket.join(m.conversation_id));
    }

    // Broadcast online status to contacts
    socket.broadcast.emit("user:online", { userId });

    // Join a new conversation room (called when a new conversation is created)
    socket.on("conversation:join", (conversationId) => {
      socket.join(conversationId);
    });

    // Handle sending messages via socket
    socket.on("message:send", async ({ conversationId, content }, callback) => {
      // Verify membership
      const { data: member } = await supabaseAdmin
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .single();

      if (!member) return callback?.({ error: "Not a member" });

      // Save to database
      const { data: message, error } = await supabaseAdmin
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: userId,
          content,
          type: "text",
        })
        .select("*, profiles:sender_id(display_name, avatar_url)")
        .single();

      if (error) return callback?.({ error: error.message });

      // Broadcast to all members in the conversation room
      io.to(conversationId).emit("message:new", message);

      // Check if recipient is online — if so, auto-mark delivered
      const { data: members } = await supabaseAdmin
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", conversationId)
        .neq("user_id", userId);

      if (members) {
        const onlineRecipient = members.some(
          (m) => onlineUsers.has(m.user_id) && onlineUsers.get(m.user_id).size > 0
        );
        if (onlineRecipient) {
          const now = new Date().toISOString();
          await supabaseAdmin
            .from("messages")
            .update({ delivered_at: now })
            .eq("id", message.id);
          io.to(conversationId).emit("message:status", {
            conversationId,
            messageIds: [message.id],
            status: "delivered",
            timestamp: now,
          });
        }
      }

      callback?.({ message });
    });

    // Mark messages as delivered when user connects
    (async () => {
      const { data: undelivered } = await supabaseAdmin
        .from("messages")
        .select("id, conversation_id, sender_id")
        .in("conversation_id", (memberships || []).map((m) => m.conversation_id))
        .neq("sender_id", userId)
        .is("delivered_at", null);

      if (undelivered?.length) {
        const ids = undelivered.map((m) => m.id);
        const now = new Date().toISOString();
        await supabaseAdmin
          .from("messages")
          .update({ delivered_at: now })
          .in("id", ids);

        // Notify senders grouped by conversation
        const byConv = {};
        for (const m of undelivered) {
          (byConv[m.conversation_id] ||= []).push(m.id);
        }
        for (const [convId, msgIds] of Object.entries(byConv)) {
          io.to(convId).emit("message:status", { conversationId: convId, messageIds: msgIds, status: "delivered", timestamp: now });
        }
      }
    })();

    // Handle delivery acknowledgement for individual messages
    socket.on("message:delivered", async ({ messageIds, conversationId }) => {
      if (!messageIds?.length) return;
      const now = new Date().toISOString();
      await supabaseAdmin
        .from("messages")
        .update({ delivered_at: now })
        .in("id", messageIds)
        .is("delivered_at", null);

      io.to(conversationId).emit("message:status", { conversationId, messageIds, status: "delivered", timestamp: now });
    });

    // Handle message edit
    socket.on("message:edit", async ({ messageId, content, conversationId }, callback) => {
      if (!content?.trim()) return callback?.({ error: "Content required" });

      const { data: msg } = await supabaseAdmin
        .from("messages")
        .select("sender_id, deleted_at")
        .eq("id", messageId)
        .single();

      if (!msg || msg.sender_id !== userId) return callback?.({ error: "Not allowed" });
      if (msg.deleted_at) return callback?.({ error: "Message is deleted" });

      const now = new Date().toISOString();
      const { error } = await supabaseAdmin
        .from("messages")
        .update({ content: content.trim(), edited_at: now })
        .eq("id", messageId);

      if (error) return callback?.({ error: error.message });

      io.to(conversationId).emit("message:updated", { messageId, content: content.trim(), edited_at: now });
      callback?.({ success: true });
    });

    // Handle message delete
    socket.on("message:delete", async ({ messageId, conversationId }, callback) => {
      const { data: msg } = await supabaseAdmin
        .from("messages")
        .select("sender_id, deleted_at")
        .eq("id", messageId)
        .single();

      if (!msg || msg.sender_id !== userId) return callback?.({ error: "Not allowed" });
      if (msg.deleted_at) return callback?.({ error: "Already deleted" });

      const now = new Date().toISOString();
      const { error } = await supabaseAdmin
        .from("messages")
        .update({ content: null, deleted_at: now })
        .eq("id", messageId);

      if (error) return callback?.({ error: error.message });

      io.to(conversationId).emit("message:deleted", { messageId, deleted_at: now });
      callback?.({ success: true });
    });

    // Handle read receipts
    socket.on("message:read", async ({ conversationId }) => {
      const { data: unread } = await supabaseAdmin
        .from("messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .neq("sender_id", userId)
        .is("read_at", null);

      if (!unread?.length) return;
      const ids = unread.map((m) => m.id);
      const now = new Date().toISOString();
      await supabaseAdmin
        .from("messages")
        .update({ read_at: now, delivered_at: now })
        .in("id", ids);

      io.to(conversationId).emit("message:status", { conversationId, messageIds: ids, status: "read", timestamp: now });
    });

    // Typing indicators
    socket.on("typing:start", ({ conversationId }) => {
      socket.to(conversationId).emit("typing:start", { userId, conversationId });
    });

    socket.on("typing:stop", ({ conversationId }) => {
      socket.to(conversationId).emit("typing:stop", { userId, conversationId });
    });

    // Get online status of specific users
    socket.on("users:online", (userIds, callback) => {
      const statuses = userIds.map((id) => ({
        userId: id,
        online: onlineUsers.has(id) && onlineUsers.get(id).size > 0,
      }));
      callback?.(statuses);
    });

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${userId}`);
      onlineUsers.get(userId)?.delete(socket.id);
      if (onlineUsers.get(userId)?.size === 0) {
        onlineUsers.delete(userId);
        socket.broadcast.emit("user:offline", { userId });
      }
    });
  });

  return io;
}

module.exports = { setupSocket };
