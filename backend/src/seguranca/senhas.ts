import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derivar = promisify(scrypt);
const PREFIXO = 'scrypt$';

export async function gerarHash(senha: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = await derivar(senha, salt, 64) as Buffer;
  return `${PREFIXO}${salt}$${hash.toString('hex')}`;
}

export function possuiHash(senha: string): boolean { return senha.startsWith(PREFIXO); }

export async function verificarSenha(senha: string, armazenada: string): Promise<boolean> {
  if (!possuiHash(armazenada)) {
    // Compatibilidade com os cadastros anteriores; o login converte para hash.
    const entrada = Buffer.from(senha);
    const original = Buffer.from(armazenada);
    return entrada.length === original.length && timingSafeEqual(entrada, original);
  }
  const [, salt, hash] = armazenada.split('$');
  if (!salt || !hash || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hash)) return false;
  const derivado = await derivar(senha, salt, 64) as Buffer;
  return timingSafeEqual(derivado, Buffer.from(hash, 'hex'));
}
