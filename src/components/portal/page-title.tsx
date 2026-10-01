"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// The current page's title is shown in the portal header, so pages spend no room on a
// heading of their own. Pages set it through `PageHeading`; the header reads it.
const TitleContext = createContext<{ title: string; setTitle: (title: string) => void }>({
  title: "",
  setTitle: () => {},
});

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("");
  return <TitleContext.Provider value={{ title, setTitle }}>{children}</TitleContext.Provider>;
}

/** The title the current page has set, or an empty string. */
export const useHeaderTitle = () => useContext(TitleContext).title;

/** Shows `title` in the portal header while the calling page is mounted. */
export function useSetHeaderTitle(title: string) {
  const { setTitle } = useContext(TitleContext);
  useEffect(() => {
    setTitle(title);
    return () => setTitle("");
  }, [title, setTitle]);
}
