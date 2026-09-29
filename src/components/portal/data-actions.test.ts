import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
const cookie = vi.hoisted(() => ({value:""}));
vi.mock("next/headers",()=>({cookies:async()=>({get:()=>cookie})}));
import { resetMockStore, getMockStore, issueMockToken } from "@/lib/mock-api/store";
import { auditedRevealAction, auditedExportAction } from "./data-actions";
beforeEach(()=>{resetMockStore();cookie.value=issueMockToken(1);});
it("reveals one field through the authorized audited API",async()=>{
  const result = await auditedRevealAction({path:"/participants/1",routeTemplate:"/participants/:id"},"id_number");
  expect(result).toMatchObject({success:true});
  expect(getMockStore().audit_logs.at(-1)?.action).toBe("REVEAL");
});
it("exports the current filters across pages, with an audit entry",async()=>{
  const result = await auditedExportAction({path:"/participants",routeTemplate:"/participants",query:{id:1,page:2,pageSize:10}});
  expect(result.success).toBe(true);
  if(result.success) expect(result.content.split("\r\n")).toHaveLength(2);
  expect(getMockStore().audit_logs.at(-1)?.action).toBe("EXPORT");
});
it("rejects untrusted paths and field escalation",async()=>{
  expect(await auditedExportAction({path:"https://example.com/participants",routeTemplate:"/participants"})).toMatchObject({success:false});
  expect(await auditedRevealAction({path:"/admin/users/1",routeTemplate:"/admin/users/:id"},"password_hash")).toMatchObject({success:false});
});
