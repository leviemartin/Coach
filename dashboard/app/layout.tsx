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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500&family=JetBrains+Mono:wght@400;500;700&family=Libre+Franklin:wght@600;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
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
