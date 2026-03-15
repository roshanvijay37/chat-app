import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { getSocket } from "../services/socket";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import ProfileModal from "../components/ProfileModal";

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
  const [showProfile, setShowProfile] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    api.getConversations().then((data) => {
      if (Array.isArray(data)) setConversations(data);
    });
  }, []);

  const activeConvRef = useRef(null);
  useEffect(() => {
    activeConvRef.current = activeConv;
  }, [activeConv]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewMsg = (msg) => {
      setConversations((prev) => {
        const updated = prev.map((c) => {
          if (c.id !== msg.conversation_id) return c;
          const isActive = activeConvRef.current?.id === msg.conversation_id;
          const isUnread = msg.sender_id !== user.id && !isActive;
          return {
            ...c,
            lastMessage: { id: msg.id, content: msg.content, created_at: msg.created_at, sender_id: msg.sender_id, type: msg.type },
            unreadCount: isUnread ? (c.unreadCount || 0) + 1 : c.unreadCount,
          };
        });
        return updated.sort((a, b) => {
          const timeA = a.lastMessage?.created_at || "0";
          const timeB = b.lastMessage?.created_at || "0";
          return timeB.localeCompare(timeA);
        });
      });
    };

    const handleStatus = ({ conversationId, status }) => {
      if (status !== "read") return;
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, unreadCount: 0 } : c
        )
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

    const handleGroupCreated = () => {
      api.getConversations().then((data) => {
        if (Array.isArray(data)) setConversations(data);
      });
    };

    socket.on("group:created", handleGroupCreated);
    socket.on("group:added", handleGroupCreated);

    return () => {
      socket.off("message:new", handleNewMsg);
      socket.off("message:status", handleStatus);
      socket.off("message:updated", handleMsgUpdated);
      socket.off("message:deleted", handleMsgDeleted);
      socket.off("group:created", handleGroupCreated);
      socket.off("group:added", handleGroupCreated);
    };
  }, [user.id]);

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
          onOpenProfile={() => setShowProfile(true)}
        />
      )}
      {showChat && (
        <ChatWindow
          conversation={activeConv}
          currentUser={user}
          onBack={isMobile ? () => setActiveConv(null) : null}
        />
      )}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </div>
  );
}
