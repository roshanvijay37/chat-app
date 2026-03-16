import { useState, useEffect } from "react";
import { api } from "../services/api";

export default function ViewProfileModal({ userId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getProfile(userId).then((data) => {
      if (data.id) setProfile(data);
      setLoading(false);
    });
  }, [userId]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card view-profile-card" onClick={(e) => e.stopPropagation()}>
        {loading ? (
          <p style={{ textAlign: "center", color: "var(--text-muted)" }}>Loading...</p>
        ) : !profile ? (
          <p style={{ textAlign: "center", color: "var(--error)" }}>Profile not found</p>
        ) : (
          <>
            <div className="view-profile-avatar">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="view-profile-img" />
              ) : (
                <div className="view-profile-placeholder">
                  {profile.display_name?.[0]?.toUpperCase() || "?"}
                </div>
              )}
            </div>
            <h2 className="view-profile-name">{profile.display_name}</h2>
            {profile.bio && <p className="view-profile-bio">{profile.bio}</p>}
          </>
        )}
        <button className="view-profile-close" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
