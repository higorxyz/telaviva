import { z } from 'zod';

// In the browser Zod would first probe `Function('')` to compile faster validators, which a Content-Security-Policy
// without 'unsafe-eval' blocks and reports on every page. The interpreted path validates the same. The server has no
// CSP and keeps the faster path. Imported first by src/app/providers.tsx, before any schema runs on the client.
if (typeof window !== 'undefined') z.config({ jitless: true });
