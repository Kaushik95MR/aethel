import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// The same two faces as the public site: Onest for everything, Unbounded for page titles.
const onest = localFont({
  src: [
    { path: "./fonts/Onest-normal-400.woff2", weight: "400" },
    { path: "./fonts/Onest-normal-500.woff2", weight: "500" },
  ],
  variable: "--font-onest",
  display: "swap",
});

const unbounded = localFont({
  src: "./fonts/Unbounded-normal-800.woff2",
  weight: "800",
  variable: "--font-unbounded",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aethel trip admin",
  description: "Staff tools for Aethel trip: enquiries, bookings, trips and hosts",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${onest.variable} ${unbounded.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
