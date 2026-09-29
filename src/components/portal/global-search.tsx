"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
export interface SearchDestination {
  label: string;
  href: string;
  description?: string;
}
export function GlobalSearch({ destinations }: { destinations: readonly SearchDestination[] }) {
  const [query, setQuery] = useState(""),
    [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const results =
    query.trim().length < 2
      ? []
      : destinations
          .filter((item) =>
            `${item.label} ${item.description ?? ""}`
              .toLowerCase()
              .includes(query.toLowerCase().trim())
          )
          .slice(0, 7);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        input.current?.focus();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
  return (
    <div
      className="relative min-w-0 flex-1"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          input.current?.focus();
          setOpen(false);
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label className="flex items-center gap-2 rounded-xl border bg-creaw-canvas px-3">
        <Search aria-hidden="true" size={17} className="shrink-0 text-creaw-muted" />
        <span className="sr-only">Search portal</span>
        <input
          ref={input}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search portal…"
          className="h-11 min-w-0 w-full bg-transparent text-sm outline-none"
        />
        <kbd className="hidden rounded border bg-white px-1 text-xs text-muted-foreground xl:block">
          ⌘K
        </kbd>
      </label>
      {open && query.trim().length >= 2 && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 rounded-xl border bg-white p-2 shadow-lg">
          <p role="status" className="px-2 py-1 text-xs text-muted-foreground">
            {results.length ? `${results.length} matching pages` : "No matching pages"}
          </p>
          <ul>
            {results.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm hover:bg-accent focus-visible:bg-accent"
                >
                  {item.label}
                  {item.description && (
                    <span className="block text-xs text-muted-foreground">{item.description}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
