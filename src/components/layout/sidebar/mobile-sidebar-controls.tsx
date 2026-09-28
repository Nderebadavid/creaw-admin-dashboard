"use client";

import { MenuIcon, XIcon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface MobileSidebarControlsProps {
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

// Hamburger toggles the drawer in sidebar.tsx; framer-motion fades the
// backdrop in/out and cross-fades the menu/close icon.
export function MobileSidebarControls({
  isMobileOpen,
  setIsMobileOpen,
}: MobileSidebarControlsProps) {
  return (
    <>
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        aria-label={isMobileOpen ? "Close menu" : "Open menu"}
        className="fixed left-4 top-4 z-50 grid h-10 w-10 place-items-center overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-accent md:hidden"
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            key={isMobileOpen ? "close" : "open"}
            initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="grid place-items-center"
          >
            {isMobileOpen ? <XIcon size={20} /> : <MenuIcon size={20} />}
          </motion.span>
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            onClick={() => setIsMobileOpen(false)}
            aria-hidden
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
          />
        )}
      </AnimatePresence>
    </>
  );
}
