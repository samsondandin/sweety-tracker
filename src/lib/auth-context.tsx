import { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";

export type AppAuthState = {
  user: User | null;
  ready: boolean;
};

export const AuthContext = createContext<AppAuthState>({ user: null, ready: false });

export function useAuth() {
  return useContext(AuthContext);
}