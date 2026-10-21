import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LITRIC • Every Read Counts",
  description:
    "Literacy Intelligence for Tracking, Reporting, Insights & Competency. SK Pendidikan Khas Taiping.",
  manifest: "/manifest.webmanifest",
  applicationName: "LITRIC",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ms">
      <body className="antialiased">{children}</body>
    </html>
  );
}
