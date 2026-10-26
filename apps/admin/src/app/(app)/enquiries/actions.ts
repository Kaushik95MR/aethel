"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  id: z.string().uuid(),
  status: z.enum(["new", "contacted", "quoted", "won", "lost"]),
  lost_reason: z.string().trim().max(500).optional(),
});

export async function updateEnquiryStatus(formData: FormData) {
  const staff = await requireStaff(["owner", "manager", "agent"]);

  const parsed = schema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    lost_reason: formData.get("lost_reason") || undefined,
  });
  if (!parsed.success) redirect("/enquiries?error=invalid");
  const { id, status, lost_reason } = parsed.data;

  if (status === "lost" && !lost_reason) redirect(`/enquiries/${id}?error=reason_required`);

  const supabase = await createClient();
  const update: Record<string, unknown> = { status, lost_reason: status === "lost" ? lost_reason : null };
  // Claiming an unassigned enquiry when first working it keeps the inbox honest.
  if (status !== "new") {
    const { data: current } = await supabase.from("enquiries").select("assigned_to").eq("id", id).maybeSingle();
    if (current && !current.assigned_to) update.assigned_to = staff.userId;
  }

  const { data, error } = await supabase.from("enquiries").update(update).eq("id", id).select("id");
  // RLS silently filters rows the role can't touch, so zero rows means forbidden or missing.
  if (error || !data?.length) redirect(`/enquiries/${id}?error=failed`);

  revalidatePath("/enquiries");
  redirect(`/enquiries/${id}?saved=1`);
}
