import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { portfolioData } from '@/data/portfolio';

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

export const metadata: Metadata = {
  metadataBase: new URL('https://ilyas-ahmad.vercel.app'),
  title: `${portfolioData.profile.name} — ${portfolioData.profile.headline}`,
  description: portfolioData.profile.summary,
  keywords: [
    portfolioData.profile.name,
    'Data Scientist',
    'Data Analyst',
    'Machine Learning Engineer',
    'Computer Vision',
    'Deep Learning',
    'YOLO',
    'Vision Transformers',
    'Python',
    'SQL',
    'Power BI',
    'Tableau',
    'UET Peshawar',
    'Portfolio',
  ],
  authors: [{ name: portfolioData.profile.name }],
  creator: portfolioData.profile.name,
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: `${portfolioData.profile.name} — ${portfolioData.profile.headline}`,
    description: portfolioData.profile.summary,
    siteName: `${portfolioData.profile.name} Portfolio`,
    images: [
      {
        url: portfolioData.profile.profileImage,
        width: 600,
        height: 600,
        alt: `${portfolioData.profile.name} - Profile Photo`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${portfolioData.profile.name} — ${portfolioData.profile.headline}`,
    description: portfolioData.profile.summary,
    images: [portfolioData.profile.profileImage],
  },
  icons: {
    icon: '/favicon.ico',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
