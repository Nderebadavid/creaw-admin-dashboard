"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { User, Phone, IdCard, Loader2 } from "lucide-react";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/ui/form-input";
import { showToast } from "@/lib/toast";
import { updateMember } from "@/app/(dashboard)/members/actions";
import type { Member } from "@/types/member";

const schema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  phone_number: z.string().optional(),
  national_id: z.string().optional(),
  gender: z.string().optional(),
  date_joined: z.string().optional(),
  status: z.string(),
  notes: z.string().optional(),
});

type FormValues = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface UpdateMemberFormProps {
  member: Member;
  onSuccess?: () => void;
}

export function UpdateMemberForm({ member, onSuccess }: UpdateMemberFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: member.first_name,
      last_name: member.last_name,
      phone_number: member.phone_number ?? "",
      national_id: member.national_id ?? "",
      gender: member.gender ?? "",
      date_joined: member.date_joined,
      status: member.status,
      notes: member.notes ?? "",
    },
  });

  async function onSubmit(data: FormOutput) {
    setIsSubmitting(true);
    try {
      const result = await updateMember(member.id, {
        first_name: data.first_name,
        last_name: data.last_name,
        phone_number: data.phone_number || undefined,
        national_id: data.national_id || undefined,
        gender: data.gender || undefined,
        date_joined: data.date_joined || undefined,
        status: data.status,
        notes: data.notes || undefined,
      });

      if (!result.success) throw new Error(result.message);

      showToast.success("Member Updated", {
        description: `${data.first_name} ${data.last_name} has been updated.`,
      });
      onSuccess?.();
    } catch (error) {
      showToast.error("Failed to Update Member", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="bg-card rounded-xl border p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-primary"><User className="w-4 h-4" />Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="first_name" render={({ field }) => (
              <FormItem>
                <FormLabel>First Name *</FormLabel>
                <FormControl>
                  <FormInput label="First Name" id="first_name" icon={<User className="h-4 w-4 text-muted-foreground" />} {...field} error={form.formState.errors.first_name?.message} showLabel={false} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="last_name" render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name *</FormLabel>
                <FormControl>
                  <FormInput label="Last Name" id="last_name" icon={<User className="h-4 w-4 text-muted-foreground" />} {...field} error={form.formState.errors.last_name?.message} showLabel={false} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="phone_number" render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <FormControl>
                  <FormInput label="Phone Number" id="phone_number" icon={<Phone className="h-4 w-4 text-muted-foreground" />} {...field} showLabel={false} />
                </FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="national_id" render={({ field }) => (
              <FormItem>
                <FormLabel>National ID</FormLabel>
                <FormControl>
                  <FormInput label="National ID" id="national_id" icon={<IdCard className="h-4 w-4 text-muted-foreground" />} {...field} showLabel={false} />
                </FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="gender" render={({ field }) => (
              <FormItem>
                <FormLabel>Gender</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />

            <FormField control={form.control} name="date_joined" render={({ field }) => (
              <FormItem>
                <FormLabel>Date Joined</FormLabel>
                <FormControl>
                  <FormInput label="Date Joined" id="date_joined" type="date" {...field} showLabel={false} />
                </FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save Changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
