import React, { createContext, useContext, useEffect, useState } from "react";
import { AUTH_USER_KEY, clearAuthSession, getSavedAuthUser } from "../lib/auth";
import type { AuthUser } from "../lib/auth";

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (userData: AuthUser) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);

  useEffect(() => {
    getSavedAuthUser()
      .then((savedUser) => {
        setUser(savedUser);
      })
      .catch((error) => {
        console.error("Failed to restore user:", error);
        setUser(null);
      });
  }, []);

  const isLoading = user === undefined;

  const login = (userData: AuthUser) => {
    setUser(userData);
  };

  const logout = async () => {
    setUser(null);
    await clearAuthSession();
  };

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        login,
        logout,
        isAuthenticated: !!(user ?? null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
