import localFont from "next/font/local";

export const unbounded = localFont({
  src: "./fonts/Unbounded-normal-800.woff2",
  weight: "800",
  variable: "--font-unbounded",
  display: "swap",
});

export const onest = localFont({
  src: [
    { path: "./fonts/Onest-normal-400.woff2", weight: "400" },
    { path: "./fonts/Onest-normal-500.woff2", weight: "500" },
  ],
  variable: "--font-onest",
  display: "swap",
});
