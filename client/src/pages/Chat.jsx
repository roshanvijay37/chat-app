import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { getSocket } from "../services/socket";
import * as webrtc from "../services/webrtc";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import ProfileModal from "../components/ProfileModal";
import ViewProfileModal from "../components/ViewProfileModal";
import CallOverlay from "../components/CallOverlay";

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
  const [viewProfileUserId, setViewProfileUserId] = useState(null);
  const isMobile = useIsMobile();

  // Call state
  const [callState, setCallState] = useState("idle"); // idle | outgoing | incoming | connected
  const [callType, setCallType] = useState("voice");
  const [callPeer, setCallPeer] = useState(null); // { id, name }
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const callPeerRef = useRef(null);
  const callStateRef = useRef("idle");
  const pendingCandidates = useRef([]);

  useEffect(() => {
    api.getConversations().then((data) => {
      if (Array.isArray(data)) setConversations(data);
    });
  }, []);

  const activeConvRef = useRef(null);
  const conversationsRef = useRef([]);
  useEffect(() => {
    activeConvRef.current = activeConv;
  }, [activeConv]);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

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

    // Call signaling
    const handleIncoming = async ({ from, callType: ct, offer }) => {
      if (callStateRef.current !== "idle") {
        socket.emit("call:busy", { to: from });
        return;
      }
      // Look up caller name from conversations
      const callerName = findUserName(from);
      callPeerRef.current = { id: from, name: callerName };
      setCallPeer({ id: from, name: callerName });
      setCallType(ct);
      setCallState("incoming");
      callStateRef.current = "incoming";
      pendingCandidates.current = [];
      // Store offer for when user accepts
      callPeerRef.current.offer = offer;
    };

    const handleAccepted = async ({ answer }) => {
      try {
        await webrtc.setRemoteAnswer(answer);
        for (const c of pendingCandidates.current) await webrtc.addIceCandidate(c);
        pendingCandidates.current = [];
        setCallState("connected");
        callStateRef.current = "connected";
      } catch (e) { console.error("call:accepted error", e); }
    };

    const handleRejected = () => resetCall();
    const handleEnded = () => resetCall();
    const handleBusy = () => { alert("User is busy on another call"); resetCall(); };

    const handleIceCandidate = async ({ candidate }) => {
      try {
        const pc = webrtc.getPC();
        if (pc?.remoteDescription) await webrtc.addIceCandidate(candidate);
        else pendingCandidates.current.push(candidate);
      } catch (e) { console.error("ICE error", e); }
    };

    socket.on("call:incoming", handleIncoming);
    socket.on("call:accepted", handleAccepted);
    socket.on("call:rejected", handleRejected);
    socket.on("call:ended", handleEnded);
    socket.on("call:busy", handleBusy);
    socket.on("call:ice-candidate", handleIceCandidate);

    return () => {
      socket.off("message:new", handleNewMsg);
      socket.off("message:status", handleStatus);
      socket.off("message:updated", handleMsgUpdated);
      socket.off("message:deleted", handleMsgDeleted);
      socket.off("group:created", handleGroupCreated);
      socket.off("group:added", handleGroupCreated);
      socket.off("call:incoming", handleIncoming);
      socket.off("call:accepted", handleAccepted);
      socket.off("call:rejected", handleRejected);
      socket.off("call:ended", handleEnded);
      socket.off("call:busy", handleBusy);
      socket.off("call:ice-candidate", handleIceCandidate);
    };
  }, [user.id]);

  function findUserName(userId) {
    for (const c of conversationsRef.current) {
      if (c.participant?.id === userId) return c.participant.display_name;
      if (c.members) {
        const m = c.members.find((m) => m.id === userId);
        if (m) return m.display_name;
      }
    }
    return "Unknown";
  }

  function resetCall() {
    webrtc.endCall();
    setCallState("idle");
    callStateRef.current = "idle";
    setCallPeer(null);
    callPeerRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsCamOff(false);
    pendingCandidates.current = [];
  }

  const startCall = useCallback(async (peerId, peerName, type) => {
    if (callStateRef.current !== "idle") return;
    try {
      const stream = await webrtc.getLocalStream(type);
      setLocalStream(stream);
      setCallType(type);
      setCallPeer({ id: peerId, name: peerName });
      callPeerRef.current = { id: peerId, name: peerName };
      setCallState("outgoing");
      callStateRef.current = "outgoing";
      pendingCandidates.current = [];

      const socket = getSocket();
      webrtc.createPeerConnection(
        (candidate) => socket.emit("call:ice-candidate", { to: peerId, candidate }),
        (stream) => setRemoteStream(stream)
      );
      const offer = await webrtc.createOffer();
      socket.emit("call:initiate", { to: peerId, callType: type, offer });
    } catch (e) {
      console.error("startCall error", e);
      alert("Could not access microphone/camera");
      resetCall();
    }
  }, []);

  const acceptCall = useCallback(async () => {
    try {
      const peer = callPeerRef.current;
      const stream = await webrtc.getLocalStream(callType);
      setLocalStream(stream);

      const socket = getSocket();
      webrtc.createPeerConnection(
        (candidate) => socket.emit("call:ice-candidate", { to: peer.id, candidate }),
        (stream) => setRemoteStream(stream)
      );
      const answer = await webrtc.createAnswer(peer.offer);
      socket.emit("call:accept", { to: peer.id, answer });

      for (const c of pendingCandidates.current) await webrtc.addIceCandidate(c);
      pendingCandidates.current = [];
      setCallState("connected");
      callStateRef.current = "connected";
    } catch (e) {
      console.error("acceptCall error", e);
      alert("Could not access microphone/camera");
      resetCall();
    }
  }, [callType]);

  const rejectCall = useCallback(() => {
    const socket = getSocket();
    socket.emit("call:reject", { to: callPeerRef.current?.id });
    resetCall();
  }, []);

  const endCall = useCallback(() => {
    const socket = getSocket();
    socket.emit("call:end", { to: callPeerRef.current?.id });
    resetCall();
  }, []);

  const handleToggleMute = useCallback(() => setIsMuted(webrtc.toggleMute()), []);
  const handleToggleCamera = useCallback(() => setIsCamOff(webrtc.toggleCamera()), []);

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

  const handleDeleteConv = async (conv) => {
    const label = conv.type === "group" ? "leave this group" : "delete this chat";
    if (!window.confirm(`Are you sure you want to ${label}?`)) return;
    const res = await api.deleteConversation(conv.id);
    if (res.error) return alert(res.error);
    setConversations((prev) => prev.filter((c) => c.id !== conv.id));
    if (activeConv?.id === conv.id) setActiveConv(null);
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
          onDeleteConv={handleDeleteConv}
        />
      )}
      {showChat && (
        <ChatWindow
          conversation={activeConv}
          currentUser={user}
          onBack={isMobile ? () => setActiveConv(null) : null}
          onViewProfile={(userId) => setViewProfileUserId(userId)}
          onStartCall={startCall}
        />
      )}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      {viewProfileUserId && <ViewProfileModal userId={viewProfileUserId} onClose={() => setViewProfileUserId(null)} />}
      <CallOverlay
        callState={callState}
        callType={callType}
        remoteName={callPeer?.name}
        localStream={localStream}
        remoteStream={remoteStream}
        isMuted={isMuted}
        isCamOff={isCamOff}
        onAccept={acceptCall}
        onReject={rejectCall}
        onEnd={endCall}
        onToggleMute={handleToggleMute}
        onToggleCamera={handleToggleCamera}
      />
    </div>
  );
}
