import { useEffect, useRef } from "react";

export default function CallOverlay({
  callState, // "idle" | "outgoing" | "incoming" | "connected"
  callType,  // "voice" | "video"
  remoteName,
  localStream,
  remoteStream,
  isMuted,
  isCamOff,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  onToggleCamera,
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (callState === "idle") return null;

  const isVideo = callType === "video";
  const isConnected = callState === "connected";

  return (
    <div className="call-overlay">
      {/* Video elements */}
      {isVideo && isConnected && (
        <>
          <video ref={remoteVideoRef} className="call-remote-video" autoPlay playsInline />
          <video ref={localVideoRef} className="call-local-video" autoPlay playsInline muted />
        </>
      )}

      {/* Voice call or waiting states */}
      {(!isVideo || !isConnected) && (
        <div className="call-info">
          <div className="call-avatar">{remoteName?.[0]?.toUpperCase() || "?"}</div>
          <div className="call-name">{remoteName}</div>
          <div className="call-status-text">
            {callState === "outgoing" && "Calling..."}
            {callState === "incoming" && `Incoming ${callType} call`}
            {isConnected && !isVideo && "Connected"}
          </div>
          {/* Show local video preview while waiting on video call */}
          {isVideo && !isConnected && localStream && (
            <video ref={localVideoRef} className="call-preview-video" autoPlay playsInline muted />
          )}
        </div>
      )}

      {/* Controls */}
      <div className="call-controls">
        {callState === "incoming" ? (
          <>
            <button className="call-btn accept" onClick={onAccept} title="Accept">📞</button>
            <button className="call-btn reject" onClick={onReject} title="Decline">✕</button>
          </>
        ) : (
          <>
            <button className={`call-btn ${isMuted ? "active" : ""}`} onClick={onToggleMute} title={isMuted ? "Unmute" : "Mute"}>
              {isMuted ? "🔇" : "🎤"}
            </button>
            {isVideo && (
              <button className={`call-btn ${isCamOff ? "active" : ""}`} onClick={onToggleCamera} title={isCamOff ? "Camera on" : "Camera off"}>
                {isCamOff ? "📷" : "📹"}
              </button>
            )}
            <button className="call-btn reject" onClick={onEnd} title="End call">✕</button>
          </>
        )}
      </div>
    </div>
  );
}
