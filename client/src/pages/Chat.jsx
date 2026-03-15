import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { getSocket } from "../services/socket";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth <= 600);
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth <= 600);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return mobile;
}

export default function Chat() {
  const { user, logout } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    api.getConversations().then((data) => {
      if (Array.isArray(data)) setConversations(data);
    });
  }, []);

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

  const showSidebar = !isMobile || !activeConv;
  const showChat = !isMobile || activeConv;

  return (
    <div className="chat-layout">
      {showSidebar && (
        <Sidebar
          conversations={conversations}
          activeConv={activeConv}
          onSelect={setActiveConv}
          onNewConv={handleNewConv}
          user={user}
          onLogout={logout}
        />
      )}
      {showChat && (
        <ChatWindow
          conversation={activeConv}
          currentUser={user}
          onBack={isMobile ? () => setActiveConv(null) : null}
        />
      )}
    </div>
  );
}
