import { useState, useEffect, useRef } from "react";
import { api } from "../services/api";
import { getSocket } from "../services/socket";

function MessageStatus({ msg }) {
  if (msg.read_at) return <span className="msg-status read" title="Read">✓✓</span>;
  if (msg.delivered_at) return <span className="msg-status delivered" title="Delivered">✓✓</span>;
  return <span className="msg-status sent" title="Sent">✓</span>;
}

export default function ChatWindow({ conversation, currentUser, onBack }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [menuMsgId, setMenuMsgId] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [editText, setEditText] = useState("");
  const bottomRef = useRef(null);
  const typingTimeout = useRef(null);
  const isGroup = conversation?.type === "group";

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

    socket.on("message:new", handleNew);
    socket.on("message:status", handleStatus);
    socket.on("message:updated", handleUpdated);
    socket.on("message:deleted", handleDeleted);
    socket.on("typing:start", handleTypingStart);
    socket.on("typing:stop", handleTypingStop);

    return () => {
      socket.off("message:new", handleNew);
      socket.off("message:status", handleStatus);
      socket.off("message:updated", handleUpdated);
      socket.off("message:deleted", handleDeleted);
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

  const handleDelete = (msg) => {
    setMenuMsgId(null);
    const socket = getSocket();
    socket.emit("message:delete", {
      messageId: msg.id,
      conversationId: conversation.id,
    });
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

  return (
    <div className="chat-window">
      <div className="chat-header">
        {onBack && <button className="back-btn" onClick={onBack}>←</button>}
        <div className={`conv-avatar ${isGroup ? "group" : ""}`}>
          {headerInitial}
        </div>
        <div className="chat-header-info">
          <span>{headerName}</span>
          {headerSub && <span className="chat-header-sub">{headerSub}</span>}
        </div>
      </div>

      <div className="messages" onClick={() => setMenuMsgId(null)}>
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
                  <p>{msg.content}</p>
                </>
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
                <div className="msg-menu">
                  <button onClick={() => handleEdit(msg)}>✏️ Edit</button>
                  <button onClick={() => handleDelete(msg)}>🗑️ Delete</button>
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
