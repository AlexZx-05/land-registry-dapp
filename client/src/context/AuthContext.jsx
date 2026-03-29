import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { fetchMe, getAccessToken, login, logout, refreshSession, signup } from "../services/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        if (getAccessToken()) {
          const me = await fetchMe();
          if (mounted) setUser(me.user);
          return;
        }
        const refreshed = await refreshSession();
        if (mounted) setUser(refreshed.user);
      } catch (_error) {
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initialize();
    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      async loginAction(payload) {
        const result = await login(payload);
        setUser(result.user);
        return result;
      },
      async signupAction(payload) {
        const result = await signup(payload);
        if (result?.accessToken && result?.user) {
          setUser(result.user);
        } else {
          setUser(null);
        }
        return result;
      },
      async logoutAction() {
        await logout();
        setUser(null);
      }
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
