import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lulu — Get Discovered by AI Agents',
  description: 'Get discovered by AI agents. In 30 minutes. No code.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
