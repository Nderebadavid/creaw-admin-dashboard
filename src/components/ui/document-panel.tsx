import { FileText, CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
export interface DocumentItem {id:string|number;name:string;requirement?:string;description?:string;action?:ReactNode}
export function DocumentPanel({documents,requirements=[]}:{documents:readonly DocumentItem[];requirements?:readonly string[]}) {
  const missing = requirements.filter(requirement => !documents.some(document => document.requirement === requirement));
  return <section aria-label="Documents" className="rounded-2xl border bg-white p-5"><h3 className="mb-4 font-heading text-xl font-bold">Documents</h3><ul className="divide-y">{documents.map(document => <li key={document.id} className="flex items-center gap-3 py-3"><FileText aria-hidden="true" size={20} className="text-primary" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{document.name}</p>{document.description && <p className="text-xs text-muted-foreground">{document.description}</p>}</div>{document.action}</li>)}{missing.map(requirement => <li key={requirement} className="flex items-center gap-3 py-3 text-sm text-[#94570d]"><CircleAlert aria-hidden="true" size={18} />Missing: {requirement}</li>)}</ul>{!documents.length && !missing.length && <p className="text-sm text-muted-foreground">No documents added.</p>}</section>;
}
