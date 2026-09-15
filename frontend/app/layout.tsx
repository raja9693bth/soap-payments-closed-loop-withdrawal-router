import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'SOAP Payments | Closed-Loop Withdrawal Router',
  description:
    'Enterprise-grade fintech operations platform for closed-loop withdrawal routing, FIFO refund allocation, and append-only ledger reconciliation.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-slate-50 antialiased">
      <body className="min-h-full flex flex-col text-slate-900 bg-slate-50">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
