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
 * heading. The page itself shows only the breadcrumb, plus its own action buttons as a
 * slim right-aligned row, so content gets the room.
 */
export function PageHeading({
  title,
  section,
  actions,
}: {
  title: string;
  section: string;
  /** Kept for callers that describe the page; the header shows only the title. */
  description?: string;
  actions?: ReactNode;
}) {
  useSetHeaderTitle(title);
  return (
    <div
      data-page-heading
      className="mb-[22px] flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
    >
      <p className="text-[13px] text-creaw-faint">
        Home <span aria-hidden="true"> / </span>
        {section}
        <span aria-hidden="true"> / </span>
        <span className="font-semibold text-primary">{title}</span>
      </p>
      <h1 className="sr-only">{title}</h1>
      {actions && <div className="flex flex-wrap justify-end gap-2.5">{actions}</div>}
    </div>
  );
}
