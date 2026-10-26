import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, humanize } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { updateEnquiryStatus } from "../actions";

const STATUSES = ["new", "contacted", "quoted", "won", "lost"] as const;

const MESSAGES: Record<string, { tone: "ok" | "error"; text: string }> = {
  saved: { tone: "ok", text: "Enquiry updated." },
  reason_required: { tone: "error", text: "Add a reason before marking an enquiry as lost." },
  failed: { tone: "error", text: "Couldn't update this enquiry. You may not have access to it." },
};

type Enquiry = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  destination_interest: string | null;
  preferred_start: string | null;
  flexible_dates: boolean;
  adults: number;
  children: number;
  budget_note: string | null;
  message: string | null;
  source: string;
  status: string;
  lost_reason: string | null;
  created_at: string;
  package: { title: string; slug: string } | null;
  assigned: { full_name: string } | null;
};

export default async function EnquiryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await requireStaff(["owner", "manager", "agent"]);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const sp = await searchParams;
  const flash = sp.saved ? MESSAGES.saved : sp.error ? MESSAGES[sp.error] : undefined;

  const supabase = await createClient();
  const { data } = await supabase
    .from("enquiries")
    .select("*, package:packages(title, slug), assigned:staff!assigned_to(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const e = data as unknown as Enquiry;

  const details: [string, React.ReactNode][] = [
    ["Email", e.email ?? "—"],
    ["Phone", e.phone ?? "—"],
    ["Package", e.package?.title ?? "—"],
    ["Destination interest", e.destination_interest ?? "—"],
    ["Preferred start", `${formatDate(e.preferred_start)}${e.flexible_dates ? " (flexible)" : ""}`],
    ["Travellers", `${e.adults} adult${e.adults === 1 ? "" : "s"}${e.children ? `, ${e.children} child${e.children === 1 ? "" : "ren"}` : ""}`],
    ["Budget", e.budget_note ?? "—"],
    ["Source", humanize(e.source)],
    ["Received", formatDate(e.created_at)],
    ["Assigned to", e.assigned?.full_name ?? "Unassigned"],
  ];

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link href="/enquiries" className="text-sm text-zinc-600 underline">
          Back to enquiries
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-medium">{e.name}</h1>
          <StatusBadge status={e.status} />
        </div>
      </div>

      {flash && (
        <p
          role={flash.tone === "error" ? "alert" : "status"}
          className={`rounded-md px-3 py-2 text-sm ${flash.tone === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}
        >
          {flash.text}
        </p>
      )}

      <dl className="grid grid-cols-[160px_1fr] gap-x-4 gap-y-2 rounded-lg border border-zinc-200 bg-white p-4 text-sm">
        {details.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-zinc-500">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
        {e.message && (
          <div className="contents">
            <dt className="text-zinc-500">Message</dt>
            <dd className="whitespace-pre-wrap">{e.message}</dd>
          </div>
        )}
        {e.lost_reason && (
          <div className="contents">
            <dt className="text-zinc-500">Lost reason</dt>
            <dd>{e.lost_reason}</dd>
          </div>
        )}
      </dl>

      <form action={updateEnquiryStatus} className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4 text-sm">
        <input type="hidden" name="id" value={e.id} />
        <h2 className="font-medium">Update status</h2>
        <div className="flex flex-wrap gap-2">
          <select name="status" defaultValue={e.status} className="rounded-md border border-zinc-300 px-2 py-1.5">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <input
            name="lost_reason"
            defaultValue={e.lost_reason ?? ""}
            maxLength={500}
            placeholder="Reason, required if lost"
            className="min-w-64 flex-1 rounded-md border border-zinc-300 px-3 py-1.5"
          />
        </div>
        <button type="submit" className="rounded-md bg-zinc-900 px-3 py-1.5 text-white hover:bg-zinc-800">
          Save
        </button>
      </form>
    </div>
  );
}
