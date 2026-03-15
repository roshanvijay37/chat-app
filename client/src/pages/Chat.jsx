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
        prev.map((c) => {
          if (c.id !== msg.conversation_id) return c;
          const isUnread = msg.sender_id !== user.id && activeConv?.id !== msg.conversation_id;
          return {
            ...c,
            lastMessage: { id: msg.id, content: msg.content, created_at: msg.created_at, sender_id: msg.sender_id },
            unreadCount: isUnread ? (c.unreadCount || 0) + 1 : c.unreadCount,
          };
        })
      );
    };

    const handleStatus = ({ messageIds, status }) => {
      if (status !== "read") return;
      setConversations((prev) =>
        prev.map((c) => {
          if (c.unreadCount === 0) return c;
          return { ...c, unreadCount: Math.max(0, (c.unreadCount || 0) - messageIds.length) };
        })
      );
    };

    socket.on("message:new", handleNewMsg);
    socket.on("message:status", handleStatus);

    const handleMsgUpdated = ({ messageId, content }) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.lastMessage && c.lastMessage.id === messageId
            ? { ...c, lastMessage: { ...c.lastMessage, content } }
            : c
        )
      );
    };

    const handleMsgDeleted = ({ messageId }) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.lastMessage && c.lastMessage.id === messageId
            ? { ...c, lastMessage: { ...c.lastMessage, content: null, deleted_at: true } }
            : c
        )
      );
    };

    socket.on("message:updated", handleMsgUpdated);
    socket.on("message:deleted", handleMsgDeleted);
    return () => {
      socket.off("message:new", handleNewMsg);
      socket.off("message:status", handleStatus);
      socket.off("message:updated", handleMsgUpdated);
      socket.off("message:deleted", handleMsgDeleted);
    };
  }, [activeConv?.id, user.id]);

  // Clear unread count when selecting a conversation
  const handleSelect = (conv) => {
    setActiveConv(conv);
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c))
    );
  };

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
          onSelect={handleSelect}
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
