import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALG = 'aes-256-gcm';

export function encrypt(text: string, key: string): string {
  const iv = randomBytes(12);
  const k = Buffer.from(key, 'hex');
  const cipher = createCipheriv(ALG, k, iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decrypt(stored: string, key: string): string {
  const [ivHex, tagHex, encHex] = stored.split(':');
  const k = Buffer.from(key, 'hex');
  const decipher = createDecipheriv(ALG, k, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(encHex, 'hex', 'utf8') + decipher.final('utf8');
}
