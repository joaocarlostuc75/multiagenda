import { hashSync, compareSync } from 'bcryptjs';

/**
 * Hash de senha com bcrypt (cost 8).
 * Em produção o hash acontece no servidor; aqui demonstramos o padrão de
 * nunca armazenar senhas em texto puro.
 */
export const hashPassword = (pw: string): string => hashSync(pw, 8);

export const verifyPassword = (pw: string, hash: string): boolean => {
  if (!hash) return false;
  try {
    return compareSync(pw, hash);
  } catch {
    return false;
  }
};

/** Token aleatório criptograficamente seguro (48 hex chars). */
export const generateToken = (): string => {
  const arr = new Uint8Array(24);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
};

/** Validação básica de força de senha. */
export const passwordIssue = (pw: string): string | null => {
  if (pw.length < 6) return 'A senha deve ter pelo menos 6 caracteres.';
  return null;
};

export const validEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
