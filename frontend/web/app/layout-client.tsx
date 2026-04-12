"use client";

import { useAuth } from "./contexts/auth";
import LoginPage from "./login-select/page";
import { ReactNode } from "react";

export function LayoutClient({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <>{children}</>;
}
