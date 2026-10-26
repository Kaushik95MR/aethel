import Link from "next/link";
import { Suspense } from "react";
import { requireStaff, type StaffRole } from "@/lib/auth";
import { signOut } from "../login/actions";

type NavItem = { label: string; href?: string; roles?: StaffRole[] };

// Entries without an href are planned modules (see ARCHITECTURE.md §5), shown as not yet available.
const NAV: NavItem[] = [
  { label: "Dashboard", href: "/" },
  { label: "Enquiries", href: "/enquiries", roles: ["owner", "manager", "agent"] },
  { label: "Bookings", href: "/bookings", roles: ["owner", "manager", "agent", "accounts"] },
  { label: "Catalogue", roles: ["owner", "manager", "content_editor"] },
  { label: "Customers", roles: ["owner", "manager", "agent", "accounts"] },
  { label: "Staff", roles: ["owner"] },
  { label: "Audit log", roles: ["owner", "manager"] },
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
  const items = NAV.filter((i) => !i.roles || i.roles.includes(staff.role));

  return (
    <div className="grid min-h-screen grid-cols-[220px_1fr]">
      <aside className="flex flex-col border-r border-zinc-200 bg-white p-4">
        <p className="mb-4 text-sm font-medium">Travel admin</p>
        <nav className="flex-1 space-y-1 text-sm">
          {items.map((item) =>
            item.href ? (
              <Link key={item.label} href={item.href} className="block rounded-md px-2 py-1.5 hover:bg-zinc-100">
                {item.label}
              </Link>
            ) : (
              <span key={item.label} className="flex items-center justify-between rounded-md px-2 py-1.5 text-zinc-400">
                {item.label}
                <span className="text-xs">Soon</span>
              </span>
            ),
          )}
        </nav>
        <div className="border-t border-zinc-200 pt-3 text-xs text-zinc-500">
          <p className="truncate text-sm text-zinc-900">{staff.fullName}</p>
          <p className="mb-2 capitalize">{staff.role.replace("_", " ")}</p>
          <form action={signOut}>
            <button type="submit" className="text-zinc-700 underline">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="bg-zinc-50 p-8">{children}</main>
    </div>
  );
}
