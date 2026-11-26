import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy } from './security-headers';

const directive = (csp: string, name: string) =>
  csp
    .split('; ')
    .find((d) => d.startsWith(`${name} `))
    ?.split(' ')
    .slice(1) ?? [];

const PROD = { NODE_ENV: 'production', NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'telaviva-demo' };

describe('contentSecurityPolicy', () => {
  it('keeps everything on this site by default, with no plugins, no foreign base and no foreign form target', () => {
    const csp = contentSecurityPolicy(PROD);
    expect(directive(csp, 'default-src')).toEqual(["'self'"]);
    expect(directive(csp, 'object-src')).toEqual(["'none'"]);
    expect(directive(csp, 'base-uri')).toEqual(["'self'"]);
    expect(directive(csp, 'form-action')).toEqual(["'self'"]);
    expect(directive(csp, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(csp, 'worker-src')).toEqual(["'self'"]);
  });

  it('allows the TMDb images, the YouTube thumbnails and player, and the Google avatars', () => {
    const csp = contentSecurityPolicy(PROD);
    expect(directive(csp, 'img-src')).toEqual(
      expect.arrayContaining(['https://image.tmdb.org', 'https://i.ytimg.com', 'https://*.googleusercontent.com']),
    );
    expect(directive(csp, 'frame-src')).toContain('https://www.youtube-nocookie.com');
    // The service worker fetches the images itself, under the same policy.
    expect(directive(csp, 'connect-src')).toEqual(expect.arrayContaining(['https://image.tmdb.org', 'https://i.ytimg.com']));
  });

  it("allows Firebase: its APIs, apis.google.com and the project's sign-in helper", () => {
    const csp = contentSecurityPolicy(PROD);
    expect(directive(csp, 'connect-src')).toEqual(expect.arrayContaining(['https://*.googleapis.com', 'https://apis.google.com']));
    expect(directive(csp, 'script-src')).toContain('https://apis.google.com');
    expect(directive(csp, 'frame-src')).toEqual(expect.arrayContaining(["'self'", 'https://telaviva-demo.firebaseapp.com']));
  });

  it('never names a project id that is not a plain host label', () => {
    const csp = contentSecurityPolicy({ ...PROD, NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'evil.com; script-src *' });
    expect(csp).not.toContain('evil.com');
    expect(directive(csp, 'frame-src')).toEqual(["'self'", 'https://www.youtube-nocookie.com']);
  });

  it('allows the Auth emulator only when the build names one', () => {
    expect(contentSecurityPolicy(PROD)).not.toContain('127.0.0.1');
    const csp = contentSecurityPolicy({ ...PROD, NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' });
    expect(directive(csp, 'connect-src')).toContain('http://127.0.0.1:9099');
    expect(directive(csp, 'frame-src')).toContain('http://127.0.0.1:9099');
    expect(contentSecurityPolicy({ ...PROD, NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: 'x; script-src *' })).not.toContain('x;');
  });

  it("never allows eval in production; development adds it, which React's dev tools need", () => {
    expect(directive(contentSecurityPolicy(PROD), 'script-src')).not.toContain("'unsafe-eval'");
    expect(directive(contentSecurityPolicy({ ...PROD, NODE_ENV: 'development' }), 'script-src')).toContain("'unsafe-eval'");
  });
});
