import { Users, UserCheck, UserMinus } from "lucide-react";
import { fetchMembers } from "../members/actions";
import type { Member } from "@/types/member";

export default async function DashboardPage() {
  const result = await fetchMembers();
  const members = result.success ? ((result.data as Member[]) ?? []) : [];
  const active = members.filter((m) => m.status === "active").length;
  const inactive = members.length - active;

  const cards = [
    { label: "Total Members", value: members.length, icon: Users },
    { label: "Active Members", value: active, icon: UserCheck },
    { label: "Inactive Members", value: inactive, icon: UserMinus },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Village group overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-semibold text-foreground mt-1">{value}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="text-primary" size={20} />
            </div>
          </div>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        Contributions, loans, and grants aren&apos;t built yet -- follow the same recipe as
        &quot;Members&quot; (type, actions.ts, table/form/modal, sidebar entry) to add them.
      </p>
    </div>
  );
}
