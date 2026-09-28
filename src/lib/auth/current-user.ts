// CURRENT_USER is gone -- the sidebar and header now get the real signed-in
// user from useCurrentUser() (src/lib/auth/current-role.tsx), resolved
// server-side via GET /users/me.
//
// CURRENT_ORG remains a placeholder: vsla-identity-service has no
// per-user "current organization" concept exposed to an ordinary
// authenticated user yet (the /accounts endpoints are SUPER_ADMIN-only).
// Swap this for real data once that's available.
export const CURRENT_ORG = {
  name: "ALF Pte. Ltd.",
  initial: "A",
};
