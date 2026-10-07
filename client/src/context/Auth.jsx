import { setLanguage } from "../services/language";
import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../services/api";
const Auth = createContext();
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    api
      .get("/auth/me")
      .then((r) => {
        setUser(r.data);
        if (["en", "roman-ur"].includes(r.data.language))
          setLanguage(r.data.language);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  const logout = async () => {
    await api.post("/auth/logout");
    setUser(null);
  };
  return (
    <Auth.Provider value={{ user, setUser, loading, logout }}>
      {children}
    </Auth.Provider>
  );
}
export const useAuth = () => useContext(Auth);
