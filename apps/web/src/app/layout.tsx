import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nicodemus - Teacher Dashboard",
  description: "Enterprise Educational AI Suite",
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
