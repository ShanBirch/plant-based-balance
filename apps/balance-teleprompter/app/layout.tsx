import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://sightline-teleprompter.shanizle.chatgpt.site'),
  title: 'Balance Teleprompter',
  description: 'Speak naturally, stay connected, and record in high resolution with a private camera teleprompter.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
  openGraph: {
    title: 'Balance Teleprompter',
    description: 'Speak naturally. Stay connected.',
    images: ['https://sightline-teleprompter.shanizle.chatgpt.site/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Balance Teleprompter',
    description: 'Speak naturally. Stay connected.',
    images: ['https://sightline-teleprompter.shanizle.chatgpt.site/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
