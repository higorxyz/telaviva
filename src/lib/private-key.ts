/**
 * The Firebase service-account key as it arrives from an env variable, brought back to a PEM firebase-admin can load.
 * People paste it in many shapes (from the .env line, from the JSON file, from a screen that turned the line breaks
 * into spaces), and Vercel stores whatever was pasted. Nothing here ever logs or returns part of the key in a message.
 */

const PEM = /-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/;

/** A key pasted as the whole service-account JSON file: take its `private_key`. */
function fromJson(value: string): string {
  if (!value.startsWith('{')) return value;
  try {
    const parsed: unknown = JSON.parse(value);
    const key = (parsed as { private_key?: unknown } | null)?.private_key;
    return typeof key === 'string' ? key : value;
  } catch {
    return value;
  }
}

/** Rebuilds the PEM from its body, whatever separated the lines (newlines, spaces, nothing). */
function rebuildPem(value: string): string {
  const match = PEM.exec(value);
  if (!match) return value;
  const [, label, body] = match;
  const base64 = body.replace(/\s+/g, '');
  const lines = base64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`;
}

export function normalizePrivateKey(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  const unquoted = fromJson(trimmed)
    .trim()
    .replace(/^"/, '')
    .replace(/",?$/, '')
    .replace(/\\\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n?/g, '\n')
    .trim();
  return unquoted ? rebuildPem(unquoted) : undefined;
}

/**
 * Why a normalized key would not load, in the app's pt-BR words, for the setup error a log prints in full.
 * Empty when the shape looks right (the parser may still reject the key itself).
 */
export function describeKeyProblem(key: string | undefined): string {
  if (!key) return 'a chave está vazia';
  if (!key.includes('-----BEGIN PRIVATE KEY-----')) return 'a chave não tem a linha -----BEGIN PRIVATE KEY-----';
  if (!key.includes('-----END PRIVATE KEY-----')) return 'a chave não tem a linha -----END PRIVATE KEY-----';
  const body = PEM.exec(key)?.[2]?.replace(/\s+/g, '') ?? '';
  // An RSA-2048 PKCS#8 key (what Firebase issues) is about 1,600 base64 characters.
  if (body.length < 1000) return `a chave parece incompleta (${body.length} caracteres no corpo)`;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(body)) return 'a chave tem caracteres que não pertencem a ela';
  return '';
}
