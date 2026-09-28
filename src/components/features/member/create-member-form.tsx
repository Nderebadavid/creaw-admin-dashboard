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
import { createMember } from "@/app/(dashboard)/members/actions";

const schema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  phone_number: z.string().optional(),
  national_id: z.string().optional(),
  gender: z.string().optional(),
  date_joined: z.string().optional(),
  status: z.string().default("active"),
  notes: z.string().optional(),
});

type FormValues = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface CreateMemberFormProps {
  onSuccess?: () => void;
}

export function CreateMemberForm({ onSuccess }: CreateMemberFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { status: "active" },
  });

  async function onSubmit(data: FormOutput) {
    setIsSubmitting(true);
    try {
      const result = await createMember({
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

      showToast.success("Member Added", {
        description: `${data.first_name} ${data.last_name} has been added.`,
      });
      form.reset();
      onSuccess?.();
    } catch (error) {
      showToast.error("Failed to Add Member", {
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
                  <FormInput label="First Name" id="first_name" placeholder="Amina" icon={<User className="h-4 w-4 text-muted-foreground" />} {...field} error={form.formState.errors.first_name?.message} showLabel={false} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="last_name" render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name *</FormLabel>
                <FormControl>
                  <FormInput label="Last Name" id="last_name" placeholder="Wanjiru" icon={<User className="h-4 w-4 text-muted-foreground" />} {...field} error={form.formState.errors.last_name?.message} showLabel={false} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="phone_number" render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <FormControl>
                  <FormInput label="Phone Number" id="phone_number" placeholder="+254 700 000 000" icon={<Phone className="h-4 w-4 text-muted-foreground" />} {...field} showLabel={false} />
                </FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="national_id" render={({ field }) => (
              <FormItem>
                <FormLabel>National ID</FormLabel>
                <FormControl>
                  <FormInput label="National ID" id="national_id" placeholder="National ID number" icon={<IdCard className="h-4 w-4 text-muted-foreground" />} {...field} showLabel={false} />
                </FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="gender" render={({ field }) => (
              <FormItem>
                <FormLabel>Gender</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
          <Button type="button" variant="outline" onClick={() => form.reset()} disabled={isSubmitting}>Reset</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding...</> : <><User className="mr-2 h-4 w-4" />Add Member</>}
          </Button>
        </div>
      </form>
    </Form>
  );
}
