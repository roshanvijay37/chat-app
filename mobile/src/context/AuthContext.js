import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';
import { getCachedUser, setCachedUser, clearAllCache, initDB } from '../services/db';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      await initDB();
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      // Show cached user instantly
      const cached = await getCachedUser();
      if (cached) {
        setUser(cached);
        setLoading(false);
        connectSocket(token);
      }

      // Verify token + refresh profile in background
      try {
        const fresh = await api.getMe();
        if (fresh.id) {
          // Check if different user logged in
          if (cached && cached.id !== fresh.id) {
            await clearAllCache();
          }
          setUser(fresh);
          await setCachedUser(fresh);
          if (!cached) {
            connectSocket(token);
            setLoading(false);
          }
        } else {
          // Token invalid
          await AsyncStorage.removeItem('token');
          await clearAllCache();
          setUser(null);
          setLoading(false);
        }
      } catch {
        // Network error — keep using cached user if available
        if (!cached) setLoading(false);
      }
    };
    init();
  }, []);

  const login = async (identifier, password) => {
    const data = await api.login(identifier, password);
    if (data.error) return data;
    await AsyncStorage.setItem('token', data.session.access_token);
    connectSocket(data.session.access_token);
    const profile = await api.getMe();

    // Clear old user's cache if different user
    const cached = await getCachedUser();
    if (cached && cached.id !== profile.id) {
      await clearAllCache();
    }

    setUser(profile);
    await setCachedUser(profile);
    return data;
  };

  const signup = async (email, password, displayName) => {
    const data = await api.signup(email, password, displayName);
    if (data.error) return data;
    if (data.session) {
      await AsyncStorage.setItem('token', data.session.access_token);
      connectSocket(data.session.access_token);
      const profile = await api.getMe();
      await clearAllCache();
      setUser(profile);
      await setCachedUser(profile);
    }
    return data;
  };

  const verifyOtp = async (email, otp) => {
    const data = await api.verifyOtp(email, otp);
    if (data.error) return data;
    if (data.session) {
      await AsyncStorage.setItem('token', data.session.access_token);
      connectSocket(data.session.access_token);
      const profile = await api.getMe();
      await clearAllCache();
      setUser(profile);
      await setCachedUser(profile);
    }
    return data;
  };

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    disconnectSocket();
    await clearAllCache();
    setUser(null);
  };

  const refreshProfile = async () => {
    const profile = await api.getMe();
    if (profile.id) {
      setUser(profile);
      await setCachedUser(profile);
    }
    return profile;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, verifyOtp, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
