import 'server-only';
import { parseEnv, parseServerAuthEnv, serverAuthConfigured } from './env-schema';

export const env = parseEnv(process.env);

export function serverAuthEnv() {
  return parseServerAuthEnv(process.env);
}

/** True when both the Firebase credential and the database are configured. */
export function serverAuthEnabled(): boolean {
  return serverAuthConfigured(serverAuthEnv());
}
