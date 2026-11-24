import type { Metadata } from "next";
import { Suspense } from "react";
import { Bricolage_Grotesque, Geist } from "next/font/google";
import { MobileTabs } from "@/components/mobile-tabs";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SITE } from "@/lib/site";
import "./globals.css";
import "./site.css";
import "./home.css";
import { onest, unbounded } from "./home-fonts";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: `${SITE.name} | ${SITE.tagline}`, template: `%s | ${SITE.name}` },
  description: "Trips with a party at night, an experienced host and a full plan by day.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${bricolage.variable} ${unbounded.variable} ${onest.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
        <SiteFooter />
        <Suspense fallback={null}>
          <MobileTabs />
        </Suspense>
      </body>
    </html>
  );
}
