import type { ReactNode } from "react";

/** The text of a page heading; feature screens take this and add their own actions. */
export interface PageHeadingText {
  title: string;
  section: string;
  description?: string;
}
export function PageHeading({
  title,
  section,
  description,
  actions,
}: {
  title: string;
  section: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div data-page-heading className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="mb-1 text-xs text-creaw-muted">
          Home <span aria-hidden="true"> / </span>
          {section}
          <span aria-hidden="true"> / </span>
          <span className="text-primary">{title}</span>
        </p>
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-creaw-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}
