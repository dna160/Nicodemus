/**
 * Cryptography utilities for Student Rep Agent
 * - Encryption/decryption with TweetNaCl
 * - ID generation
 * - Hashing
 */

import { randomBytes, secretbox } from "tweetnacl";
import { encodeUTF8, encodeBase64, decodeBase64, decodeUTF8 } from "tweetnacl-util";

/**
 * Generate a unique ID (UUID v4 format)
 */
export function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate device ID hash (one-way, deterministic)
 * Used to anonymize device across sessions
 */
export function generateDeviceHash(deviceId: string, schoolSalt: string = ""): string {
  const combined = `${deviceId}:${schoolSalt}`;
  return sha256(combined);
}

/**
 * SHA256 hash (using SubtleCrypto Web API)
 */
export async function sha256Async(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Synchronous SHA256 fallback (for non-crypto contexts)
 * Note: This is a placeholder - in production use SubtleCrypto
 */
export function sha256(text: string): string {
  // For now, use a simple hash fallback
  // In production, this should use crypto.subtle.digest
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Encryption key management
 */
let encryptionKey: Uint8Array | null = null;

/**
 * Initialize encryption key from storage or generate new
 */
export async function initializeEncryptionKey(): Promise<void> {
  const stored = await chrome.storage.local.get("encryption_key");
  if (stored.encryption_key) {
    encryptionKey = decodeBase64(stored.encryption_key);
  } else {
    encryptionKey = randomBytes(secretbox.keyLength);
    await chrome.storage.local.set({
      encryption_key: encodeBase64(encryptionKey)
    });
  }
}

/**
 * Encrypt sensitive data
 */
export function encryptData(plaintext: string): string {
  if (!encryptionKey) {
    throw new Error("Encryption key not initialized");
  }

  const nonce = randomBytes(secretbox.nonceLength);
  const ciphertext = secretbox(encodeUTF8(plaintext), nonce, encryptionKey);

  // Combine nonce + ciphertext for transmission
  const combined = new Uint8Array(nonce.length + ciphertext.length);
  combined.set(nonce);
  combined.set(ciphertext, nonce.length);

  return encodeBase64(combined);
}

/**
 * Decrypt sensitive data
 */
export function decryptData(encrypted: string): string {
  if (!encryptionKey) {
    throw new Error("Encryption key not initialized");
  }

  const combined = decodeBase64(encrypted);
  const nonce = combined.slice(0, secretbox.nonceLength);
  const ciphertext = combined.slice(secretbox.nonceLength);

  const plaintext = secretbox.open(ciphertext, nonce, encryptionKey);
  if (!plaintext) {
    throw new Error("Decryption failed - invalid key or corrupted data");
  }

  return decodeUTF8(plaintext);
}

/**
 * Encrypt an object
 */
export function encryptObject<T>(obj: T): string {
  return encryptData(JSON.stringify(obj));
}

/**
 * Decrypt an object
 */
export function decryptObject<T>(encrypted: string): T {
  return JSON.parse(decryptData(encrypted));
}

/**
 * One-way hash for student ID (non-reversible)
 */
export async function hashStudentId(studentId: string, salt: string): Promise<string> {
  return sha256Async(`${studentId}:${salt}`);
}

/**
 * Generate random string for tokens/session IDs
 */
export function generateRandomToken(length: number = 32): string {
  const bytes = randomBytes(length);
  return encodeBase64(bytes);
}
