// utils/encryption.ts
export async function encryptDataWithMnemonic(
  mnemonic: string,
  data: Record<string, any>
): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(data));

  // Derive key from mnemonic
  const keyMaterial = await getKeyMaterial(mnemonic);
  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode("ownly-protocol"), // fixed salt
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // AES-GCM IV
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  // Return as base64 string with IV prefix
  const encryptedArray = new Uint8Array(encrypted);
  const full = new Uint8Array(iv.length + encryptedArray.length);
  full.set(iv, 0);
  full.set(encryptedArray, iv.length);

  return btoa(String.fromCharCode(...full));
}

async function getKeyMaterial(mnemonic: string): Promise<CryptoKey> {
  const enc = new TextEncoder().encode(mnemonic);
  return window.crypto.subtle.importKey(
    "raw",
    enc,
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
}
