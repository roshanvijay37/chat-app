import { useState, useRef } from "react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function ProfileModal({ onClose }) {
  const { user, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(user.display_name || "");
  const [bio, setBio] = useState(user.bio || "");
  const [preview, setPreview] = useState(user.avatar_url || null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    const formData = new FormData();
    if (displayName.trim() !== user.display_name) formData.append("displayName", displayName.trim());
    if (bio.trim() !== (user.bio || "")) formData.append("bio", bio.trim());
    if (avatarFile) formData.append("avatar", avatarFile);

    // Nothing changed
    if ([...formData.entries()].length === 0) { setSaving(false); onClose(); return; }

    const res = await api.updateProfile(formData);
    setSaving(false);
    if (res.error) return setError(res.error);
    await refreshProfile();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Edit Profile</h2>
        <form onSubmit={handleSave}>
          <div className="avatar-edit" onClick={() => fileRef.current?.click()}>
            {preview ? (
              <img src={preview} alt="avatar" className="avatar-preview" />
            ) : (
              <div className="avatar-placeholder">
                {user.display_name?.[0]?.toUpperCase() || "?"}
              </div>
            )}
            <span className="avatar-edit-label">📷</span>
            <input
              type="file"
              ref={fileRef}
              onChange={handleAvatarChange}
              accept="image/*"
              style={{ display: "none" }}
            />
          </div>

          <input
            type="text"
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <textarea
            placeholder="Bio (max 150 chars)"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={150}
            rows={2}
          />
          <p className="char-count">{bio.length}/150</p>

          {error && <p className="error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
