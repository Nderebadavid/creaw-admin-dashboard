import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { LookupTable } from "../schemas";
import type { Option } from "./config";

const crumb = "rounded-full bg-creaw-canvas px-3 py-1 font-semibold";
const current = "rounded-full bg-creaw-orange px-3 py-1 font-semibold text-white";

/**
 * Kenya › county › sub-county trail for the geography tables. `parent` is the
 * county (on the sub-county list) or sub-county (on the ward list) being viewed.
 */
export function GeoBreadcrumb({
  table,
  parent,
  counties,
}: {
  table: LookupTable;
  parent: { id: number; name: string; parentId: number | null } | null;
  counties: Option[];
}) {
  return (
    <>
      <nav
        aria-label="Geography breadcrumb"
        className="flex flex-wrap items-center gap-2 px-5 pt-4 text-sm"
      >
        <Link href="/admin/lookups/county" className={crumb}>
          Kenya
        </Link>
        {(table === "sub_county" || table === "ward") && (
          <>
            <ChevronRight size={15} />
            {parent?.parentId ? (
              <Link
                href={`/admin/lookups/sub_county?countyId=${parent.parentId}`}
                className={crumb}
              >
                {counties.find((row) => row.id === parent.parentId)?.name ?? "County"}
              </Link>
            ) : (
              <span className={current}>{parent?.name ?? "All counties"}</span>
            )}
          </>
        )}
        {table === "ward" && (
          <>
            <ChevronRight size={15} />
            <span className={current}>{parent?.name ?? "All sub-counties"}</span>
          </>
        )}
      </nav>
      {!parent && table !== "county" && (
        <p className="px-5 pt-3 text-sm text-creaw-faint">
          Open a {table === "ward" ? "sub-county" : "county"} from the geography hierarchy to add a
          child.
        </p>
      )}
    </>
  );
}
