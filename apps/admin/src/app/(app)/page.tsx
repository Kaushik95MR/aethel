import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const staff = await requireStaff();
  const { error } = await searchParams;
  const supabase = await createClient();

  // RLS decides what each role can count; a null count renders as an em dash.
  const [newEnquiries, pendingBookings] = await Promise.all([
    supabase.from("enquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const stats = [
    { label: "New enquiries", value: newEnquiries.count },
    { label: "Pending bookings", value: pendingBookings.count },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-medium">Welcome, {staff.fullName.split(" ")[0]}</h1>
        <p className="text-sm text-zinc-500">Here&apos;s where things stand.</p>
      </div>
      {error === "forbidden" && (
        <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Your role doesn&apos;t have access to that page.
        </p>
      )}
      <div className="grid max-w-xl grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg bg-white p-4">
            <p className="text-sm text-zinc-500">{s.label}</p>
            <p className="text-2xl font-medium">{s.value ?? "—"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
