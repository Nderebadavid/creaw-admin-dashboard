"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { UserRole } from "@/types/navigation";
import type { SessionUser } from "./session";

// The dashboard layout resolves the real signed-in user server-side (see
// session-server.ts's getSessionUser(), backed by GET /users/me) and passes
// it into <CurrentRoleProvider>. This context just makes that value
// available to client components (sidebar, header) without prop-drilling.
//
// `setRole` is a dev-only preview override for exercising role-gated nav --
// it does not change the user's real permissions and resets to their actual
// role on reload.
export const DEFAULT_ROLE: UserRole = "guest";

const FALLBACK_USER: SessionUser = {
  id: 0,
  firstName: "Guest",
  lastName: "",
  name: "Guest",
  email: "",
  initials: "G",
  passwordChangeRequired: false,
  role: DEFAULT_ROLE,
};

interface SessionContextValue {
  role: UserRole;
  setRole: (role: UserRole) => void;
  user: SessionUser;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface CurrentRoleProviderProps {
  children: ReactNode;
  user?: SessionUser;
}

export function CurrentRoleProvider({
  children,
  user = FALLBACK_USER,
}: CurrentRoleProviderProps) {
  const [role, setRole] = useState<UserRole>(user.role);
  const value = useMemo(() => ({ role, setRole, user }), [role, user]);
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

function useSessionContext(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    // No provider in the tree (e.g. a component rendered outside the
    // dashboard layout) -- fall back rather than throw.
    return { role: DEFAULT_ROLE, setRole: () => {}, user: FALLBACK_USER };
  }
  return ctx;
}

/** Returns the signed-in user's active role (or the header's preview override). */
export function useCurrentRole(): UserRole {
  return useSessionContext().role;
}

/** Role + setter, for the header's role-switcher preview control. */
export function useRoleSwitcher(): Pick<SessionContextValue, "role" | "setRole"> {
  const { role, setRole } = useSessionContext();
  return { role, setRole };
}

/** The signed-in user's real profile (name, email, etc.) -- unaffected by the preview switcher. */
export function useCurrentUser(): SessionUser {
  return useSessionContext().user;
}
