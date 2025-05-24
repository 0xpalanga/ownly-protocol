import CryptoJS from "crypto-js";

export function decryptMnemonic(encryptedMnemonic: string, password: string): string | null {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedMnemonic, password);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted || null;
  } catch (err) {
    return null;
  }
}
