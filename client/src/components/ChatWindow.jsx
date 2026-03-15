import { useState, useEffect, useRef } from "react";
import { api } from "../services/api";
import { getSocket } from "../services/socket";

export default function ChatWindow({ conversation, currentUser, onBack }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);
  const typingTimeout = useRef(null);

  useEffect(() => {
    if (!conversation) return;
    api.getMessages(conversation.id).then((data) => {
      if (Array.isArray(data)) setMessages(data.reverse());
    });
  }, [conversation?.id]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !conversation) return;

    socket.emit("conversation:join", conversation.id);

    const handleNew = (msg) => {
      if (msg.conversation_id === conversation.id) {
        setMessages((prev) => [...prev, msg]);
      }
    };

    const handleTypingStart = ({ userId, conversationId }) => {
      if (conversationId === conversation.id && userId !== currentUser.id)
        setTyping(true);
    };

    const handleTypingStop = ({ userId, conversationId }) => {
      if (conversationId === conversation.id && userId !== currentUser.id)
        setTyping(false);
    };

    socket.on("message:new", handleNew);
    socket.on("typing:start", handleTypingStart);
    socket.on("typing:stop", handleTypingStop);

    return () => {
      socket.off("message:new", handleNew);
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

  return (
    <div className="chat-window">
      <div className="chat-header">
        {onBack && <button className="back-btn" onClick={onBack}>←</button>}
        <div className="conv-avatar">
          {conversation.participant?.display_name?.[0]?.toUpperCase() || "?"}
        </div>
        <span>{conversation.participant?.display_name || "Unknown"}</span>
      </div>

      <div className="messages">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message ${msg.sender_id === currentUser.id ? "mine" : "theirs"}`}
          >
            <p>{msg.content}</p>
            <span className="msg-time">
              {new Date(msg.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        ))}
        {typing && <div className="typing-indicator">typing...</div>}
        <div ref={bottomRef} />
      </div>

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
