"use client";
import { createContext, useCallback, useContext, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

/**
 * Filter changes that reload the page through the router (the dashboard's period, location,
 * chart and funnel filters). While one is loading, the page is marked busy and takes no
 * clicks, so a slow API never invites a second, conflicting change.
 */
const PortalNavigationContext = createContext<{
  navigate: (href: string) => void;
  pending: boolean;
}>({
  // Outside the portal shell there is no busy page to mark: a plain page load.
  navigate: (href) => window.location.assign(href),
  pending: false,
});

export function usePortalNavigation() {
  return useContext(PortalNavigationContext);
}

/** Provides `navigate` and the shared `pending` flag; renders `children(pending)`. */
export function PortalNavigationProvider({
  children,
}: {
  children: (pending: boolean) => ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const navigate = useCallback(
    (href: string) => startTransition(() => router.push(href, { scroll: false })),
    [router]
  );
  return (
    <PortalNavigationContext.Provider value={{ navigate, pending }}>
      {children(pending)}
    </PortalNavigationContext.Provider>
  );
}
