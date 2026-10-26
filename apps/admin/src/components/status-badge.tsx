import { humanize } from "@/lib/format";

const TONES: Record<string, string> = {
  // enquiries
  new: "bg-blue-50 text-blue-700",
  contacted: "bg-zinc-100 text-zinc-700",
  quoted: "bg-amber-50 text-amber-800",
  won: "bg-green-50 text-green-700",
  lost: "bg-red-50 text-red-700",
  // bookings
  pending: "bg-amber-50 text-amber-800",
  confirmed: "bg-green-50 text-green-700",
  completed: "bg-zinc-100 text-zinc-700",
  cancelled: "bg-red-50 text-red-700",
  // payments
  unpaid: "bg-zinc-100 text-zinc-700",
  partial: "bg-amber-50 text-amber-800",
  paid: "bg-green-50 text-green-700",
  refunded: "bg-red-50 text-red-700",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${TONES[status] ?? "bg-zinc-100 text-zinc-700"}`}>
      {humanize(status)}
    </span>
  );
}
