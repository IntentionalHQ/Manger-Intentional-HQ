import "server-only";

const VERSION = "v1";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

async function encryptionKey(): Promise<CryptoKey> {
  const configured = process.env.HQ_TOKEN_ENCRYPTION_KEY?.trim();
  if (!configured) {
    throw new Error("HQ_TOKEN_ENCRYPTION_KEY is not configured.");
  }

  let raw: Uint8Array;
  try {
    raw = base64ToBytes(configured);
  } catch {
    throw new Error("HQ_TOKEN_ENCRYPTION_KEY must be base64 encoded.");
  }
  if (raw.byteLength !== 32) {
    throw new Error("HQ_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }

  return crypto.subtle.importKey("raw", arrayBuffer(raw), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptSecret(value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: arrayBuffer(iv) },
    await encryptionKey(),
    new TextEncoder().encode(value),
  );
  return `${VERSION}.${bytesToBase64(iv)}.${bytesToBase64(
    new Uint8Array(ciphertext),
  )}`;
}

export async function decryptSecret(value: string): Promise<string> {
  const [version, encodedIv, encodedCiphertext] = value.split(".");
  if (
    version !== VERSION ||
    !encodedIv ||
    !encodedCiphertext
  ) {
    throw new Error("Stored integration credential has an unsupported format.");
  }

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: arrayBuffer(base64ToBytes(encodedIv)) },
    await encryptionKey(),
    arrayBuffer(base64ToBytes(encodedCiphertext)),
  );
  return new TextDecoder().decode(plaintext);
}
