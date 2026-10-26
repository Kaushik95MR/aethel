import type { Metadata } from "next";
import Link from "next/link";
import { Bricolage_Grotesque, Geist } from "next/font/google";
import { Interactions } from "@/components/interactions";
import { Logo } from "@/components/logo";
import { SiteHeader } from "@/components/site-header";
import { SITE } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], axes: ["wdth", "opsz"] });

export const metadata: Metadata = {
  title: { default: `${SITE.name} | Treks and trips from ${SITE.city}`, template: `%s | ${SITE.name}` },
  description: SITE.tagline,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${bricolage.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Interactions />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <footer data-header="dark" className="bg-ink text-background">
          <div className="mx-auto grid max-w-[88rem] gap-10 px-5 py-14 text-sm text-background/70 sm:grid-cols-3 sm:px-8">
            <div>
              <Logo className="text-background" />
              <p className="mt-3 max-w-xs">{SITE.tagline}</p>
            </div>
            <div>
              <p className="font-medium text-background">Explore</p>
              <ul className="mt-2 space-y-1">
                <li>
                  <Link href="/destinations" className="hover:text-brand">
                    Destinations
                  </Link>
                </li>
                <li>
                  <Link href="/packages" className="hover:text-brand">
                    Trips
                  </Link>
                </li>
                <li>
                  <Link href="/credits" className="hover:text-brand">
                    Photo credits
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-background">Contact</p>
              <p className="mt-2">{SITE.city}, India</p>
              <p>{SITE.email}</p>
              <p>{SITE.phone}</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
