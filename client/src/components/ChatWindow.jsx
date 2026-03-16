import { useState, useEffect, useRef } from "react";
import { api } from "../services/api";
import { getSocket } from "../services/socket";

function MessageStatus({ msg }) {
  // Single check for sent
  const singleCheck = (
    <svg viewBox="0 0 16 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 5.5L5.5 10L14.5 1" />
    </svg>
  );
  // Double check for delivered/read
  const doubleCheck = (
    <svg viewBox="0 0 16 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 5.5L4 8.5L10 2.5" />
      <path d="M5 5.5L8 8.5L14 2.5" />
    </svg>
  );

  if (msg.read_at) return <span className="msg-status read" title="Read">{doubleCheck}</span>;
  if (msg.delivered_at) return <span className="msg-status delivered" title="Delivered">{doubleCheck}</span>;
  return <span className="msg-status sent" title="Sent">{singleCheck}</span>;
}

function parseFileContent(content) {
  try { return JSON.parse(content); }
  catch { return null; }
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileMessage({ msg, isMine }) {
  const file = parseFileContent(msg.content);
  if (!file) return <p>{msg.content}</p>;

  if (msg.type === "image") {
    return (
      <a href={file.url} target="_blank" rel="noopener noreferrer" className="img-msg">
        <img src={file.url} alt={file.fileName} loading="lazy" />
      </a>
    );
  }

  return (
    <a href={file.url} target="_blank" rel="noopener noreferrer" className={`file-msg ${isMine ? "mine" : ""}`}>
      <span className="file-icon">📄</span>
      <span className="file-details">
        <span className="file-name">{file.fileName}</span>
        <span className="file-size">{formatFileSize(file.fileSize)}</span>
      </span>
    </a>
  );
}

export default function ChatWindow({ conversation, currentUser, onBack, onViewProfile, onStartCall }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [menuMsgId, setMenuMsgId] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [editText, setEditText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState(null);
  const bottomRef = useRef(null);
  const typingTimeout = useRef(null);
  const fileInputRef = useRef(null);
  const isGroup = conversation?.type === "group";

  const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

  useEffect(() => {
    if (!conversation) return;
    api.getMessages(conversation.id).then((data) => {
      if (Array.isArray(data)) setMessages(data.reverse());
    });
  }, [conversation?.id]);

  // Mark messages as read when conversation is opened or new messages arrive
  useEffect(() => {
    if (!conversation) return;
    const socket = getSocket();
    if (socket) socket.emit("message:read", { conversationId: conversation.id });
  }, [conversation?.id, messages]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !conversation) return;

    socket.emit("conversation:join", conversation.id);

    const handleNew = (msg) => {
      if (msg.conversation_id === conversation.id) {
        setMessages((prev) => [...prev, msg]);
      }
    };

    const handleStatus = ({ messageIds, status, timestamp }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (!messageIds.includes(m.id)) return m;
          if (status === "read") return { ...m, delivered_at: m.delivered_at || timestamp, read_at: timestamp };
          if (status === "delivered") return { ...m, delivered_at: timestamp };
          return m;
        })
      );
    };

    const handleTypingStart = ({ userId, conversationId }) => {
      if (conversationId === conversation.id && userId !== currentUser.id) {
        if (isGroup) {
          setTypingUsers((prev) => new Set(prev).add(userId));
        }
        setTyping(true);
      }
    };

    const handleTypingStop = ({ userId, conversationId }) => {
      if (conversationId === conversation.id && userId !== currentUser.id) {
        if (isGroup) {
          setTypingUsers((prev) => {
            const next = new Set(prev);
            next.delete(userId);
            if (next.size === 0) setTyping(false);
            return next;
          });
        } else {
          setTyping(false);
        }
      }
    };

    const handleUpdated = ({ messageId, content, edited_at }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, content, edited_at } : m))
      );
    };

    const handleDeleted = ({ messageId, deleted_at }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, content: null, deleted_at } : m))
      );
    };

    const handleReactionUpdated = ({ messageId, reactions }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions } : m))
      );
    };

    socket.on("message:new", handleNew);
    socket.on("message:status", handleStatus);
    socket.on("message:updated", handleUpdated);
    socket.on("message:deleted", handleDeleted);
    socket.on("reaction:updated", handleReactionUpdated);
    socket.on("typing:start", handleTypingStart);
    socket.on("typing:stop", handleTypingStop);

    return () => {
      socket.off("message:new", handleNew);
      socket.off("message:status", handleStatus);
      socket.off("message:updated", handleUpdated);
      socket.off("message:deleted", handleDeleted);
      socket.off("reaction:updated", handleReactionUpdated);
      socket.off("typing:start", handleTypingStart);
      socket.off("typing:stop", handleTypingStop);
    };
  }, [conversation?.id, currentUser.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const socket = getSocket();
    socket.emit("message:send", {
      conversationId: conversation.id,
      content: input.trim(),
    });
    socket.emit("typing:stop", { conversationId: conversation.id });
    setInput("");
  };

  const handleEdit = (msg) => {
    setEditingMsg(msg);
    setEditText(msg.content);
    setMenuMsgId(null);
  };

  const submitEdit = (e) => {
    e.preventDefault();
    if (!editText.trim() || editText.trim() === editingMsg.content) {
      setEditingMsg(null);
      return;
    }
    const socket = getSocket();
    socket.emit("message:edit", {
      messageId: editingMsg.id,
      content: editText.trim(),
      conversationId: conversation.id,
    });
    setEditingMsg(null);
  };

  const toggleReaction = (msgId, emoji) => {
    const socket = getSocket();
    socket.emit("reaction:toggle", { messageId: msgId, emoji, conversationId: conversation.id });
    setReactionPickerMsgId(null);
  };

  const handleDelete = (msg) => {
    setMenuMsgId(null);
    const socket = getSocket();
    socket.emit("message:delete", {
      messageId: msg.id,
      conversationId: conversation.id,
    }, (res) => {
      if (res?.error) console.error("Delete failed:", res.error);
    });
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    fileInputRef.current.value = "";
    setUploading(true);
    const res = await api.uploadFile(conversation.id, file);
    setUploading(false);
    if (res.error) alert(res.error);
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const socket = getSocket();
    socket.emit("typing:start", { conversationId: conversation.id });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit("typing:stop", { conversationId: conversation.id });
    }, 1500);
  };

  if (!conversation) {
    return (
      <div className="chat-window empty">
        <p>Select a conversation or start a new chat</p>
      </div>
    );
  }

  const headerName = isGroup
    ? conversation.name
    : conversation.participant?.display_name || "Unknown";
  const headerInitial = isGroup
    ? conversation.name?.[0]?.toUpperCase() || "G"
    : conversation.participant?.display_name?.[0]?.toUpperCase() || "?";
  const headerSub = isGroup ? `${conversation.members?.length || 0} members` : null;

  // Build a map of member names for group sender display
  const memberMap = {};
  if (isGroup && conversation.members) {
    conversation.members.forEach((m) => { memberMap[m.id] = m.display_name; });
  }

  const headerAvatarUrl = isGroup ? null : conversation.participant?.avatar_url;
  const is1on1 = !isGroup && conversation.participant?.id;

  return (
    <div className="chat-window">
      <div className="chat-header">
        {onBack && <button className="back-btn" onClick={onBack}>←</button>}
        <div
          className={`chat-header-clickable ${isGroup ? "" : "clickable"}`}
          onClick={() => !isGroup && conversation.participant?.id && onViewProfile?.(conversation.participant.id)}
        >
          {headerAvatarUrl ? (
            <img src={headerAvatarUrl} alt="" className={`conv-avatar-img ${isGroup ? "group" : ""}`} />
          ) : (
            <div className={`conv-avatar ${isGroup ? "group" : ""}`}>
              {headerInitial}
            </div>
          )}
          <div className="chat-header-info">
            <span>{headerName}</span>
            {headerSub && <span className="chat-header-sub">{headerSub}</span>}
          </div>
        </div>
        {is1on1 && onStartCall && (
          <div className="call-buttons">
            <button className="call-header-btn" title="Voice call" onClick={() => onStartCall(conversation.participant.id, headerName, "voice")}>📞</button>
            <button className="call-header-btn" title="Video call" onClick={() => onStartCall(conversation.participant.id, headerName, "video")}>📹</button>
          </div>
        )}
      </div>

      <div className="messages" onClick={() => { setMenuMsgId(null); setReactionPickerMsgId(null); }}>
        {messages.map((msg) => {
          const isMine = msg.sender_id === currentUser.id;
          const isDeleted = !!msg.deleted_at;
          return (
            <div
              key={msg.id}
              className={`message ${isMine ? "mine" : "theirs"} ${isDeleted ? "deleted" : ""}`}
              onContextMenu={(e) => {
                if (!isMine || isDeleted) return;
                e.preventDefault();
                setMenuMsgId(menuMsgId === msg.id ? null : msg.id);
              }}
            >
              {isDeleted ? (
                <p className="deleted-text">🚫 This message was deleted</p>
              ) : (
                <>
                  {isGroup && !isMine && (
                    <span className="msg-sender">
                      {msg.profiles?.display_name || memberMap[msg.sender_id] || "Unknown"}
                    </span>
                  )}
                  {msg.type === "image" || msg.type === "file" ? (
                    <FileMessage msg={msg} isMine={isMine} />
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </>
              )}
              {!isDeleted && msg.reactions?.length > 0 && (
                <div className="reaction-pills">
                  {msg.reactions.map((r) => {
                    const iReacted = r.users.some((u) => u.id === currentUser.id);
                    return (
                      <button
                        key={r.emoji}
                        className={`reaction-pill ${iReacted ? "reacted" : ""}`}
                        onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, r.emoji); }}
                        title={r.users.map((u) => u.display_name).join(", ")}
                      >
                        {r.emoji} {r.users.length}
                      </button>
                    );
                  })}
                </div>
              )}
              <span className="msg-time">
                {msg.edited_at && !isDeleted && <span className="edited-label">edited</span>}
                {new Date(msg.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {isMine && !isDeleted && <MessageStatus msg={msg} />}
              </span>
              {menuMsgId === msg.id && (
                <div className="msg-menu" onClick={(e) => e.stopPropagation()}>
                  {msg.type === "text" && <button onClick={() => handleEdit(msg)}>✏️ Edit</button>}
                  <button onClick={() => handleDelete(msg)}>🗑️ Delete</button>
                </div>
              )}
              {!isDeleted && (
                <button
                  className="reaction-trigger"
                  onClick={(e) => { e.stopPropagation(); setReactionPickerMsgId(reactionPickerMsgId === msg.id ? null : msg.id); setMenuMsgId(null); }}
                >☺</button>
              )}
              {reactionPickerMsgId === msg.id && (
                <div className="reaction-picker" onClick={(e) => e.stopPropagation()}>
                  {REACTION_EMOJIS.map((emoji) => (
                    <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)}>{emoji}</button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {typing && <div className="typing-indicator">typing...</div>}
        <div ref={bottomRef} />
      </div>

      {editingMsg && (
        <form className="edit-bar" onSubmit={submitEdit}>
          <span>Editing message</span>
          <input value={editText} onChange={(e) => setEditText(e.target.value)} autoFocus />
          <button type="submit">✓</button>
          <button type="button" onClick={() => setEditingMsg(null)}>✕</button>
        </form>
      )}

      <form className="message-input" onSubmit={sendMessage}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          style={{ display: "none" }}
          accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.zip"
        />
        <button type="button" className="attach-btn" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? "⏳" : "📎"}
        </button>
        <input
          type="text"
          placeholder="Type a message..."
          value={input}
          onChange={handleInputChange}
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
