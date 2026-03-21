import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brewer Family AI Game Night",
  description: "Mission Control",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-gray-950 antialiased">{children}</body>
    </html>
  );
}
