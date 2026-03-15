import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { getSocket } from "../services/socket";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";

export default function Chat() {
  const { user, logout } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);

  useEffect(() => {
    api.getConversations().then((data) => {
      if (Array.isArray(data)) setConversations(data);
    });
  }, []);

  // Listen for new messages to update sidebar
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewMsg = (msg) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === msg.conversation_id
            ? { ...c, lastMessage: { content: msg.content, created_at: msg.created_at, sender_id: msg.sender_id } }
            : c
        )
      );
    };

    socket.on("message:new", handleNewMsg);
    return () => socket.off("message:new", handleNewMsg);
  }, []);

  const handleNewConv = (conv) => {
    api.getConversations().then((data) => {
      if (Array.isArray(data)) {
        setConversations(data);
        const found = data.find((c) => c.id === conv.id);
        if (found) setActiveConv(found);
      }
    });
  };

  return (
    <div className="chat-layout">
      <Sidebar
        conversations={conversations}
        activeConv={activeConv}
        onSelect={setActiveConv}
        onNewConv={handleNewConv}
        user={user}
        onLogout={logout}
      />
      <ChatWindow conversation={activeConv} currentUser={user} />
    </div>
  );
}
