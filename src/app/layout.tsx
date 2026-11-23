import type { Metadata, Viewport } from 'next';
import { Instrument_Serif, Inter_Tight } from 'next/font/google';
import { preconnect } from 'react-dom';
import { VerifyEmailBanner } from '@/features/auth/VerifyEmailBanner';
import { env } from '@/lib/env';
import { Footer } from '@/features/shell/Footer';
import { Header } from '@/features/shell/Header';
import { TabBar } from '@/features/shell/TabBar';
import { OG_BASE } from '@/features/share/page-meta';
import { IMAGE_ORIGIN } from '@/features/tmdb/images';
import { TOKENS } from '@/ui/tokens';
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
  openGraph: { type: 'website', ...OG_BASE },
};

export const viewport: Viewport = {
  themeColor: TOKENS.ink950,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // The hero or first posters of almost every page come from the TMDb CDN: open that connection while the HTML is
  // still arriving instead of when the first image is found.
  preconnect(IMAGE_ORIGIN);
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
          <VerifyEmailBanner />
          <main id="conteudo">
            {children}
          </main>
          <Footer />
          <TabBar />
        </Providers>
      </body>
    </html>
  );
}
