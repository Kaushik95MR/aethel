import Link from "next/link";
import { getUserLite } from "@/lib/auth";

/** In the header: "Log in" for visitors, a square initial linking to the account for signed-in people. Reads cookies, so it sits in Suspense. */
export async function AccountLink() {
  const user = await getUserLite();
  if (!user) {
    return (
      <Link href="/login" className="hidden text-lg underline-offset-8 hover:text-sun hover:underline md:inline">
        Log in
      </Link>
    );
  }
  const initial = (user.name ?? user.email ?? "?").slice(0, 1).toUpperCase();
  return (
    <Link href="/account" aria-label="Your account" className="grid size-11 place-items-center bg-[#c4eae7] text-xl font-medium text-[#0a1322]">
      {initial}
    </Link>
  );
}
