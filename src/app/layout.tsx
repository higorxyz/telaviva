import type { Metadata, Viewport } from 'next';
import { Instrument_Serif, Inter_Tight } from 'next/font/google';
import { env } from '@/lib/env';
import { Grain } from '@/ui/Grain';
import { Providers } from './providers';
import './globals.css';

const instrumentSerif = Instrument_Serif({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-instrument-serif',
  display: 'swap',
});

const interTight = Inter_Tight({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-inter-tight',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(env.SITE_URL),
  title: { default: 'TelaViva — filmes e séries', template: '%s · TelaViva' },
  description: 'Descubra filmes e séries, com onde assistir no Brasil.',
};

export const viewport: Viewport = {
  themeColor: '#0c0a08',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${instrumentSerif.variable} ${interTight.variable}`}>
      <body className="min-h-dvh">
        <Providers>
          <Grain />
          <main id="conteudo">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
