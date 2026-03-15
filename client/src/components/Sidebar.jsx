import { useState } from "react";
import { api } from "../services/api";

export default function Sidebar({
  conversations,
  activeConv,
  onSelect,
  onNewConv,
  user,
  onLogout,
}) {
  const [email, setEmail] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");

  const handleNewChat = async (e) => {
    e.preventDefault();
    setError("");
    // We need a way to find user by email — let's use the backend
    const API = import.meta.env.VITE_API_URL || "http://localhost:3000";
    const res = await fetch(`${API}/chat/find-user?email=${email}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    const data = await res.json();
    if (data.error) return setError(data.error);

    const conv = await api.createConversation(data.id);
    if (conv.error) return setError(conv.error);
    onNewConv(conv.conversation);
    setShowNew(false);
    setEmail("");
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="user-name">{user.display_name}</span>
        <div>
          <button className="icon-btn" onClick={() => setShowNew(!showNew)} title="New Chat">+</button>
          <button className="icon-btn" onClick={onLogout} title="Logout">⏻</button>
        </div>
      </div>

      {showNew && (
        <form className="new-chat-form" onSubmit={handleNewChat}>
          <input
            type="email"
            placeholder="Enter user's email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit">Start Chat</button>
          {error && <p className="error">{error}</p>}
        </form>
      )}

      <div className="conversation-list">
        {conversations.map((c) => (
          <div
            key={c.id}
            className={`conversation-item ${activeConv?.id === c.id ? "active" : ""}`}
            onClick={() => onSelect(c)}
          >
            <div className="conv-avatar">
              {c.participant?.display_name?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="conv-info">
              <span className="conv-name">{c.participant?.display_name || "Unknown"}</span>
              <span className="conv-last-msg">
                {c.lastMessage?.content?.slice(0, 30) || "No messages yet"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
