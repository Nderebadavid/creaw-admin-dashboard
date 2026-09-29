import type { ReactNode } from "react";
export function PageHeading({title,section,description,actions}:{title:string;section:string;description?:string;actions?:ReactNode}) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-1 text-xs text-[#81766d]">Home <span aria-hidden="true"> / </span>{section}<span aria-hidden="true"> / </span><span className="text-primary">{title}</span></p><h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>{description && <p className="mt-1 text-sm text-[#81766d]">{description}</p>}</div>{actions && <div className="flex flex-wrap gap-3">{actions}</div>}</div>;
}
