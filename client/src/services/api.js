const API = import.meta.env.VITE_API_URL || "http://localhost:3000";

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

  login: (email, password) =>
    fetch(`${API}/auth/login`, {
      method: "POST",
      headers: headers(false),
      body: JSON.stringify({ email, password }),
    }).then((r) => r.json()),

  getMe: () =>
    fetch(`${API}/auth/me`, { headers: headers() }).then((r) => r.json()),

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
};
