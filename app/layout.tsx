import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { PortfolioProvider } from '@/components/PortfolioContext';
import { getPublicContent } from '@/lib/cms/public-content';
import { portfolioMetadata } from '@/lib/cms/metadata';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8FAFC' },
    { media: '(prefers-color-scheme: dark)', color: '#0B1120' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export async function generateMetadata(): Promise<Metadata> {
  return portfolioMetadata((await getPublicContent()).content);
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const published = await getPublicContent();
  return (
    <html lang="en" className="dark scroll-smooth" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('theme');
                  if (stored === 'light') {
                    document.documentElement.classList.remove('dark');
                  } else {
                    document.documentElement.classList.add('dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased min-h-screen selection:bg-cyan-500/20 selection:text-cyan-400`}>
        <ThemeProvider>
          <PortfolioProvider initialPublished={published}>{children}</PortfolioProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
