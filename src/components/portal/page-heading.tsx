"use client";
import type { ReactNode } from "react";
import { useSetHeaderTitle } from "./page-title";

/** The text of a page heading; feature screens take this and add their own actions. */
export interface PageHeadingText {
  title: string;
  section: string;
  description?: string;
}

/**
 * Puts the page's title in the portal header and keeps it as the page's (screen-reader)
 * heading, so the page itself gives its room to content. Only a page's own action
 * buttons take space here, as a slim right-aligned row.
 */
export function PageHeading({
  title,
  actions,
}: {
  title: string;
  /** Kept for callers that describe the page; the header shows only the title. */
  section?: string;
  description?: string;
  actions?: ReactNode;
}) {
  useSetHeaderTitle(title);
  return (
    <div data-page-heading className={actions ? "mb-[22px]" : undefined}>
      <h1 className="sr-only">{title}</h1>
      {actions && <div className="flex flex-wrap justify-end gap-2.5">{actions}</div>}
    </div>
  );
}
