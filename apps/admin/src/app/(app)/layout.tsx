import Link from "next/link";
import { Suspense } from "react";
import { Brand } from "@/components/brand";
import { Nav, type NavLink } from "@/components/nav";
import { Avatar } from "@/components/ui";
import { requireStaff, type StaffRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../login/actions";

type Item = NavLink & { roles: StaffRole[] };

// Only screens that exist are listed. Customers, staff and the audit log return when they are built.
const ITEMS: Item[] = [
  { label: "Overview", href: "/", icon: "overview", roles: ["owner", "manager", "agent", "content_editor", "accounts"] },
  { label: "Enquiries", href: "/enquiries", icon: "enquiries", roles: ["owner", "manager", "agent"] },
  { label: "Bookings", href: "/bookings", icon: "bookings", roles: ["owner", "manager", "agent", "accounts"] },
  { label: "Catalogue", href: "/catalogue", icon: "catalogue", roles: ["owner", "manager", "content_editor"] },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // Auth reads cookies (request-time data), so the whole shell streams behind a boundary.
  return (
    <Suspense fallback={<p className="p-8 text-sm text-zinc-500">Loading…</p>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();

  // A count appears only on the queue that needs action: enquiries nobody has picked up yet.
  let newEnquiries: number | null = null;
  if (["owner", "manager", "agent"].includes(staff.role)) {
    const supabase = await createClient();
    const { count } = await supabase.from("enquiries").select("id", { count: "exact", head: true }).eq("status", "new");
    newEnquiries = count;
  }
  const links: NavLink[] = ITEMS.filter((i) => i.roles.includes(staff.role)).map(({ roles: _r, ...l }) => {
    void _r;
    return l.href === "/enquiries" ? { ...l, badge: newEnquiries } : l;
  });

  const account = (
    <div className="flex items-center gap-2.5">
      <Avatar name={staff.fullName} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-900">{staff.fullName}</p>
        <p className="text-xs capitalize text-zinc-500">{staff.role.replace("_", " ")}</p>
      </div>
      <form action={signOut}>
        <button type="submit" className="text-xs font-medium text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline">
          Sign out
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[232px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 border-r border-zinc-200 px-3 py-4 lg:flex">
        <Link href="/" className="px-2.5" aria-label="Aethel overview">
          <Brand />
        </Link>
        <Nav links={links} />
        <div className="mt-auto border-t border-zinc-200 px-1 pt-4">{account}</div>
      </aside>

      {/* Phone and tablet: a slim bar with the menu folded away */}
      <details className="group border-b border-zinc-200 bg-[var(--ground)] lg:hidden">
        <summary className="flex min-h-12 items-center justify-between px-4">
          <Brand />
          <span className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium group-open:bg-zinc-100">Menu</span>
        </summary>
        <div className="space-y-4 px-3 pb-4">
          <Nav links={links} />
          <div className="border-t border-zinc-200 pt-4">{account}</div>
        </div>
      </details>

      <main className="min-w-0 px-4 py-6 sm:px-8 lg:py-8">
        <div className="mx-auto max-w-[1120px] space-y-6">{children}</div>
      </main>
    </div>
  );
}
