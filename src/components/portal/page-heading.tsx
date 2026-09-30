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
    <div data-page-heading className="mb-[22px] flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-[13px] text-creaw-faint">
          Home <span aria-hidden="true"> / </span>
          {section}
          <span aria-hidden="true"> / </span>
          <span className="font-semibold text-primary">{title}</span>
        </p>
        <h1 className="font-heading text-[32px] font-bold leading-tight">{title}</h1>
        {description && <p className="text-[14.5px] text-creaw-faint">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </div>
  );
}
