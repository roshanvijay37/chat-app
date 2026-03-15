import { createContext, useContext, useState, useEffect } from "react";
import { api } from "../services/api";
import { connectSocket, disconnectSocket } from "../services/socket";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      connectSocket(token);
      api.getMe().then((data) => {
        if (data.id) setUser(data);
        else localStorage.removeItem("token");
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const data = await api.login(email, password);
    if (data.error) return data;
    localStorage.setItem("token", data.session.access_token);
    connectSocket(data.session.access_token);
    const profile = await api.getMe();
    setUser(profile);
    return data;
  };

  const signup = async (email, password, displayName) => {
    const data = await api.signup(email, password, displayName);
    if (data.error) return data;
    if (data.session) {
      localStorage.setItem("token", data.session.access_token);
      connectSocket(data.session.access_token);
      const profile = await api.getMe();
      setUser(profile);
    }
    return data;
  };

  const logout = () => {
    localStorage.removeItem("token");
    disconnectSocket();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
