import type { ReactNode } from 'react';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Nicodemus',
  description: 'Enterprise Educational AI Suite',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
