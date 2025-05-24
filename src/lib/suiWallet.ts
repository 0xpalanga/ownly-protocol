// lib/suiWallet.ts
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { mnemonicToSeedSync } from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import { toB64 } from '@mysten/bcs';

export function getSuiKeypairFromMnemonic(mnemonic: string): Ed25519Keypair {
  const seed = mnemonicToSeedSync(mnemonic).slice(0, 32);
  const { key } = derivePath("m/44'/784'/0'/0'/0'", seed.toString('hex'));
  return Ed25519Keypair.fromSecretKey(Uint8Array.from(key));
}

export function getSuiAddressFromMnemonic(mnemonic: string): string {
  return getSuiKeypairFromMnemonic(mnemonic).getPublicKey().toSuiAddress();
}
