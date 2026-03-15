const API = import.meta.env.VITE_API_URL ?? "";

const getToken = () => localStorage.getItem("token");

const headers = (withAuth = true) => {
  const h = { "Content-Type": "application/json" };
  if (withAuth) h.Authorization = `Bearer ${getToken()}`;
  return h;
};

export const api = {
  signup: (email, password, displayName) =>
    fetch(`${API}/auth/signup`, {
      method: "POST",
      headers: headers(false),
      body: JSON.stringify({ email, password, displayName }),
    }).then((r) => r.json()),

  login: (identifier, password) =>
    fetch(`${API}/auth/login`, {
      method: "POST",
      headers: headers(false),
      body: JSON.stringify({ identifier, password }),
    }).then((r) => r.json()),

  getMe: () =>
    fetch(`${API}/auth/me`, { headers: headers() }).then((r) => r.json()),

  updateProfile: (formData) =>
    fetch(`${API}/auth/profile`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    }).then((r) => r.json()),

  getConversations: () =>
    fetch(`${API}/chat/conversations`, { headers: headers() }).then((r) =>
      r.json()
    ),

  createConversation: (userId) =>
    fetch(`${API}/chat/conversations`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ userId }),
    }).then((r) => r.json()),

  getMessages: (conversationId) =>
    fetch(`${API}/chat/messages/${conversationId}`, {
      headers: headers(),
    }).then((r) => r.json()),

  verifyOtp: (email, otp) =>
    fetch(`${API}/auth/verify-otp`, {
      method: "POST",
      headers: headers(false),
      body: JSON.stringify({ email, otp }),
    }).then((r) => r.json()),

  createGroup: (name, memberIds) =>
    fetch(`${API}/chat/groups`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ name, memberIds }),
    }).then((r) => r.json()),

  addGroupMembers: (conversationId, userIds) =>
    fetch(`${API}/chat/groups/${conversationId}/members`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ userIds }),
    }).then((r) => r.json()),

  getGroupMembers: (conversationId) =>
    fetch(`${API}/chat/groups/${conversationId}/members`, {
      headers: headers(),
    }).then((r) => r.json()),

  findUser: (q) =>
    fetch(`${API}/chat/find-user?q=${encodeURIComponent(q)}`, {
      headers: headers(),
    }).then((r) => r.json()),

  uploadFile: (conversationId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("conversationId", conversationId);
    return fetch(`${API}/chat/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    }).then((r) => r.json());
  },

  deleteConversation: (conversationId) =>
    fetch(`${API}/chat/conversations/${conversationId}`, {
      method: "DELETE",
      headers: headers(),
    }).then((r) => r.json()),
};
