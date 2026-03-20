import type { Metadata } from 'next';
import ThemeRegistry from '@/components/ThemeRegistry';
import AppShell from '@/components/AppShell';
import Providers from '@/components/Providers';
import './globals.css';

// Force dynamic rendering so middleware auth check runs on every request
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'OCR Coach Dashboard',
  description: 'Multi-agent coaching system for Spartan Ultra Morzine 2027',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <ThemeRegistry>
            <AppShell>{children}</AppShell>
          </ThemeRegistry>
        </Providers>
      </body>
    </html>
  );
}
