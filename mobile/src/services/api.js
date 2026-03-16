import AsyncStorage from '@react-native-async-storage/async-storage';

const API = 'https://chat-app-production-6766.up.railway.app';

const getToken = async () => await AsyncStorage.getItem('token');

const headers = async (withAuth = true) => {
  const h = { 'Content-Type': 'application/json' };
  if (withAuth) {
    const token = await getToken();
    if (token) h.Authorization = `Bearer ${token}`;
  }
  return h;
};

export const api = {
  signup: async (email, password, displayName) => {
    const res = await fetch(`${API}/auth/signup`, {
      method: 'POST',
      headers: await headers(false),
      body: JSON.stringify({ email, password, displayName }),
    });
    return res.json();
  },

  login: async (identifier, password) => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: await headers(false),
      body: JSON.stringify({ identifier, password }),
    });
    return res.json();
  },

  verifyOtp: async (email, otp) => {
    const res = await fetch(`${API}/auth/verify-otp`, {
      method: 'POST',
      headers: await headers(false),
      body: JSON.stringify({ email, otp }),
    });
    return res.json();
  },

  getMe: async () => {
    const res = await fetch(`${API}/auth/me`, { headers: await headers() });
    return res.json();
  },

  updateProfile: async (formData) => {
    const token = await getToken();
    const res = await fetch(`${API}/auth/profile`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    return res.json();
  },

  getConversations: async () => {
    const res = await fetch(`${API}/chat/conversations`, { headers: await headers() });
    return res.json();
  },

  createConversation: async (userId) => {
    const res = await fetch(`${API}/chat/conversations`, {
      method: 'POST',
      headers: await headers(),
      body: JSON.stringify({ userId }),
    });
    return res.json();
  },

  deleteConversation: async (conversationId) => {
    const res = await fetch(`${API}/chat/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: await headers(),
    });
    return res.json();
  },

  getMessages: async (conversationId) => {
    const res = await fetch(`${API}/chat/messages/${conversationId}`, {
      headers: await headers(),
    });
    return res.json();
  },

  createGroup: async (name, memberIds) => {
    const res = await fetch(`${API}/chat/groups`, {
      method: 'POST',
      headers: await headers(),
      body: JSON.stringify({ name, memberIds }),
    });
    return res.json();
  },

  getGroupMembers: async (conversationId) => {
    const res = await fetch(`${API}/chat/groups/${conversationId}/members`, {
      headers: await headers(),
    });
    return res.json();
  },

  findUser: async (q) => {
    const res = await fetch(`${API}/chat/find-user?q=${encodeURIComponent(q)}`, {
      headers: await headers(),
    });
    return res.json();
  },

  getProfile: async (userId) => {
    const res = await fetch(`${API}/chat/profile/${userId}`, {
      headers: await headers(),
    });
    return res.json();
  },

  uploadFile: async (conversationId, fileUri, fileName, mimeType) => {
    const token = await getToken();
    const formData = new FormData();
    formData.append('file', { uri: fileUri, name: fileName, type: mimeType });
    formData.append('conversationId', conversationId);
    const res = await fetch(`${API}/chat/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    return res.json();
  },
};

export const API_URL = API;
