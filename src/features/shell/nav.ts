import { Bookmark, Clapperboard, House, Search, Tv, type LucideIcon } from 'lucide-react';

export type NavItem = { href: string; label: string };
export type TabItem = NavItem & { icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Início' },
  { href: '/filmes', label: 'Filmes' },
  { href: '/series', label: 'Séries' },
  { href: '/descobrir', label: 'Descobrir' },
  { href: '/minha-lista', label: 'Minha lista' },
];

export const TAB_ITEMS: TabItem[] = [
  { href: '/', label: 'Início', icon: House },
  { href: '/filmes', label: 'Filmes', icon: Clapperboard },
  { href: '/series', label: 'Séries', icon: Tv },
  { href: '/buscar', label: 'Buscar', icon: Search },
  { href: '/minha-lista', label: 'Minha lista', icon: Bookmark },
];

const ALIASES: Record<string, string> = { '/filmes': '/filme', '/series': '/serie' };

function matches(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  if (matches(pathname, href)) return true;
  const alias = ALIASES[href];
  return alias !== undefined && matches(pathname, alias);
}
