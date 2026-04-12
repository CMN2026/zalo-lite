"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { AUTH_USER_KEY, clearAuthSession } from "../lib/auth";

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role?: "USER" | "ADMIN";
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (userData: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem(AUTH_USER_KEY);
      if (savedUser) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUser(JSON.parse(savedUser) as User);
        return;
      }
    } catch (error) {
      console.error("Failed to restore user:", error);
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(null);
  }, []);

  const isLoading = user === undefined;

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    clearAuthSession();
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
