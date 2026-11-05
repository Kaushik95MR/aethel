import type { Metadata } from "next";
import Link from "next/link";
import { Bricolage_Grotesque, Geist } from "next/font/google";
import { Logo } from "@/components/logo";
import { SiteHeader } from "@/components/site-header";
import { getUpcomingDepartures } from "@/lib/catalogue";
import { CATEGORIES } from "@/lib/categories";
import { formatDate } from "@/lib/format";
import { SITE } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], axes: ["wdth", "opsz"] });

export const metadata: Metadata = {
  title: { default: `${SITE.name} | Holidays, group trips and treks from ${SITE.city}`, template: `%s | ${SITE.name}` },
  description: SITE.tagline,
};

// The strip above the header says something true: the next trip that leaves, or an invitation to ask.
async function promoLine(): Promise<{ text: string; href: string }> {
  const [next] = await getUpcomingDepartures(1);
  return next
    ? { text: `Next trip leaves ${formatDate(next.start_date)}: ${next.title}. See the dates`, href: `/packages/${next.slug}` }
    : { text: "Tell us where you want to go and we'll plan it", href: "/enquire" };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const promo = await promoLine();
  return (
    <html lang="en" className={`${geistSans.variable} ${bricolage.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SiteHeader promo={promo} />
        <main className="flex-1">{children}</main>
        <footer data-header="dark" className="bg-ink text-background">
          <div className="mx-auto grid max-w-[88rem] gap-10 px-5 py-14 text-base text-background/80 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
            <div>
              <Logo className="text-background" />
              <p className="mt-3 max-w-xs">{SITE.tagline}</p>
            </div>
            <div>
              <p className="font-medium text-background">Kinds of trip</p>
              <ul className="mt-3 space-y-2">
                {CATEGORIES.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/packages?type=${c.slug}`} className="hover:text-sun">
                      {c.name}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/packages" className="hover:text-sun">
                    All trips
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-background">Places</p>
              <ul className="mt-3 space-y-2">
                {["Kerala", "Ladakh", "Himachal", "Goa", "Rajasthan", "Varanasi"].map((p) => (
                  <li key={p}>
                    <Link href={`/packages?q=${p}`} className="hover:text-sun">
                      {p}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/credits" className="hover:text-sun">
                    Photo credits
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-background">Contact</p>
              <p className="mt-3">{SITE.city}, India</p>
              <p>{SITE.email}</p>
              <p>{SITE.phone}</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
