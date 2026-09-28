"use server";

import { membersStore } from "@/lib/mock-db/members";
import type { Member } from "@/types/member";

export interface ActionResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export interface CreateMemberData {
  first_name: string;
  last_name: string;
  phone_number?: string;
  national_id?: string;
  gender?: string;
  date_joined?: string;
  status?: string;
  notes?: string;
}

export interface UpdateMemberData {
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  national_id?: string;
  gender?: string;
  date_joined?: string;
  status?: string;
  notes?: string;
}

export async function fetchMembers(): Promise<ActionResult> {
  try {
    return { success: true, message: "Members fetched", data: membersStore.list() };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Failed to fetch members" };
  }
}

export async function createMember(data: CreateMemberData): Promise<ActionResult> {
  try {
    const payload = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== "" && v !== undefined)
    ) as Partial<CreateMemberData>;

    if (!payload.first_name || !payload.last_name) {
      return { success: false, message: "First name and last name are required" };
    }

    const now = new Date().toISOString();
    const member: Member = {
      id: crypto.randomUUID(),
      first_name: payload.first_name,
      last_name: payload.last_name,
      phone_number: payload.phone_number ?? null,
      national_id: payload.national_id ?? null,
      gender: payload.gender ?? null,
      date_joined: payload.date_joined ?? now.slice(0, 10),
      status: payload.status ?? "active",
      notes: payload.notes ?? null,
      created_at: now,
      updated_at: now,
    };

    membersStore.insert(member);
    return { success: true, message: "Member added successfully!", data: member };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Failed to create member" };
  }
}

export async function updateMember(memberId: string, data: UpdateMemberData): Promise<ActionResult> {
  try {
    const payload = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== "" && v !== undefined)
    );

    const updated = membersStore.update(memberId, {
      ...payload,
      updated_at: new Date().toISOString(),
    });

    if (!updated) {
      return { success: false, message: "Member not found" };
    }

    return { success: true, message: "Member updated successfully!", data: updated };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Failed to update member" };
  }
}
