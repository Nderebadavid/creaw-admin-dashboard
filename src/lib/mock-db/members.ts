import { createMockStore } from "./store";
import type { Member } from "@/types/member";

const seed: Member[] = [
  {
    id: "m-1",
    first_name: "Amina",
    last_name: "Wanjiru",
    phone_number: "+254 712 345 678",
    national_id: "23456789",
    gender: "female",
    date_joined: "2025-02-10",
    status: "active",
    notes: null,
    created_at: "2025-02-10T09:00:00.000Z",
    updated_at: "2025-02-10T09:00:00.000Z",
  },
  {
    id: "m-2",
    first_name: "Peter",
    last_name: "Otieno",
    phone_number: "+254 722 111 222",
    national_id: "31122334",
    gender: "male",
    date_joined: "2025-02-10",
    status: "active",
    notes: null,
    created_at: "2025-02-10T09:05:00.000Z",
    updated_at: "2025-02-10T09:05:00.000Z",
  },
  {
    id: "m-3",
    first_name: "Grace",
    last_name: "Achieng",
    phone_number: "+254 733 555 999",
    national_id: "29988776",
    gender: "female",
    date_joined: "2025-06-01",
    status: "inactive",
    notes: "On leave, relocated temporarily.",
    created_at: "2025-06-01T09:00:00.000Z",
    updated_at: "2025-08-01T09:00:00.000Z",
  },
];

export const membersStore = createMockStore<Member>(seed);
