import { useState } from "react";
import { api } from "../services/api";
import { useTheme } from "../context/ThemeContext";

export default function Sidebar({
  conversations,
  activeConv,
  onSelect,
  onNewConv,
  user,
  onLogout,
  onOpenProfile,
  onDeleteConv,
}) {
  const [query, setQuery] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [mode, setMode] = useState("direct"); // "direct" | "group"
  const [error, setError] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState([]);
  const [searchResult, setSearchResult] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const { theme, toggleTheme } = useTheme();

  const resetForm = () => {
    setShowNew(false);
    setMode("direct");
    setQuery("");
    setGroupName("");
    setGroupMembers([]);
    setSearchResult(null);
    setError("");
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setError("");
    const data = await api.findUser(query.trim());
    if (data.error) { setError(data.error); setSearchResult(null); return; }
    setSearchResult(data);
  };

  const handleDirectChat = async (e) => {
    e.preventDefault();
    if (!searchResult) return handleSearch();
    const conv = await api.createConversation(searchResult.id);
    if (conv.error) return setError(conv.error);
    onNewConv(conv.conversation);
    resetForm();
  };

  const addToGroup = () => {
    if (!searchResult) return;
    if (groupMembers.find((m) => m.id === searchResult.id)) return;
    setGroupMembers((prev) => [...prev, searchResult]);
    setSearchResult(null);
    setQuery("");
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) return setError("Group name required");
    if (groupMembers.length < 1) return setError("Add at least 1 member");
    setError("");
    const res = await api.createGroup(groupName.trim(), groupMembers.map((m) => m.id));
    if (res.error) return setError(res.error);
    onNewConv(res.conversation);
    resetForm();
  };

  const getConvDisplay = (c) => {
    if (c.type === "group") {
      return {
        name: c.name || "Group",
        initial: c.name?.[0]?.toUpperCase() || "G",
        avatarUrl: null,
      };
    }
    return {
      name: c.participant?.display_name || "Unknown",
      initial: c.participant?.display_name?.[0]?.toUpperCase() || "?",
      avatarUrl: c.participant?.avatar_url || null,
    };
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-user" onClick={onOpenProfile}>
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="" className="sidebar-avatar" />
          ) : (
            <div className="sidebar-avatar placeholder">{user.display_name?.[0]?.toUpperCase() || "?"}</div>
          )}
          <span className="user-name">{user.display_name}</span>
        </div>
        <div className="sidebar-header-actions">
          <button className="icon-btn" onClick={toggleTheme} title={theme === "dark" ? "Light mode" : "Dark mode"}>
            {theme === "dark" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>
          <button className="icon-btn" onClick={() => showNew ? resetForm() : setShowNew(true)} title="New Chat">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="2" x2="8" y2="14"/><line x1="2" y1="8" x2="14" y2="8"/></svg>
          </button>
          <button className="icon-btn" onClick={onLogout} title="Logout">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </div>

      {showNew && (
        <div className="new-chat-form">
          <div className="mode-tabs">
            <button className={mode === "direct" ? "active" : ""} onClick={() => setMode("direct")}>Direct</button>
            <button className={mode === "group" ? "active" : ""} onClick={() => setMode("group")}>Group</button>
          </div>

          {mode === "group" && (
            <input
              type="text"
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          )}

          <div className="search-row">
            <input
              type="text"
              placeholder="Search by email or username"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSearchResult(null); }}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSearch())}
            />
            <button type="button" onClick={handleSearch}>🔍</button>
          </div>

          {searchResult && (
            <div className="search-result">
              <span>{searchResult.display_name} ({searchResult.email})</span>
              {mode === "direct" ? (
                <button onClick={handleDirectChat}>Chat</button>
              ) : (
                <button onClick={addToGroup}>Add</button>
              )}
            </div>
          )}

          {mode === "group" && groupMembers.length > 0 && (
            <div className="group-members-list">
              {groupMembers.map((m) => (
                <span key={m.id} className="member-chip">
                  {m.display_name}
                  <button onClick={() => setGroupMembers((prev) => prev.filter((x) => x.id !== m.id))}>×</button>
                </span>
              ))}
            </div>
          )}

          {mode === "direct" && !searchResult && (
            <button className="form-submit" onClick={handleDirectChat}>Find & Chat</button>
          )}
          {mode === "group" && (
            <button className="form-submit" onClick={handleCreateGroup}>Create Group ({groupMembers.length})</button>
          )}

          {error && <p className="error">{error}</p>}
        </div>
      )}

      <div className="conversation-list" onClick={() => setContextMenu(null)}>
        {conversations.map((c) => {
          const display = getConvDisplay(c);
          const lastMsgPreview = c.lastMessage?.deleted_at
            ? "🚫 Message deleted"
            : c.lastMessage?.type === "image"
              ? "🖼️ Photo"
              : c.lastMessage?.type === "file"
                ? "📄 File"
                : c.lastMessage?.content?.slice(0, 30) || "No messages yet";
          const senderPrefix = c.type === "group" && c.lastMessage?.sender_name
            ? `${c.lastMessage.sender_name}: `
            : "";
          return (
            <div
              key={c.id}
              className={`conversation-item ${activeConv?.id === c.id ? "active" : ""}`}
              onClick={() => { setContextMenu(null); onSelect(c); }}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu(contextMenu === c.id ? null : c.id);
              }}
            >
              {display.avatarUrl ? (
                <img src={display.avatarUrl} alt="" className={`conv-avatar-img ${c.type === "group" ? "group" : ""}`} />
              ) : (
                <div className={`conv-avatar ${c.type === "group" ? "group" : ""}`}>
                  {display.initial}
                </div>
              )}
              <div className="conv-info">
                <span className="conv-name">{display.name}</span>
                <span className="conv-last-msg">{senderPrefix}{lastMsgPreview}</span>
              </div>
              {c.unreadCount > 0 && (
                <span className="unread-badge">{c.unreadCount > 99 ? "99+" : c.unreadCount}</span>
              )}
              {contextMenu === c.id && (
                <div className="conv-context-menu">
                  <button onClick={(e) => {
                    e.stopPropagation();
                    setContextMenu(null);
                    onDeleteConv(c);
                  }}>
                    {c.type === "group" ? "🚪 Leave Group" : "🗑️ Delete Chat"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
