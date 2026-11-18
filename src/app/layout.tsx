import type { Metadata, Viewport } from 'next';
import { Instrument_Serif, Inter_Tight } from 'next/font/google';
import { env } from '@/lib/env';
import { Footer } from '@/features/shell/Footer';
import { Header } from '@/features/shell/Header';
import { TabBar } from '@/features/shell/TabBar';
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
          <a
            href="#conteudo"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-70 focus:rounded-full focus:bg-amber focus:px-4 focus:py-2 focus:text-ink-950"
          >
            Pular para o conteúdo
          </a>
          <Grain />
          <Header />
          <main id="conteudo" className="pb-20 md:pb-0">
            {children}
          </main>
          <Footer />
          <TabBar />
        </Providers>
      </body>
    </html>
  );
}
