"use client";
import { TableState } from "@/components/data-table/table-state";
export default function PortalError({retry}:{error:Error & {digest?:string};retry:()=>void}) {
  return <TableState error="We could not load this page. Please try again." onRetry={retry} />;
}
