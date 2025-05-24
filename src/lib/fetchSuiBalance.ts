// lib/fetchSuiBalance.ts
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

const client = new SuiClient({ url: getFullnodeUrl("testnet") });

export async function fetchSuiBalance(address: string): Promise<string | null> {
  try {
    const balance = await client.getBalance({ owner: address });
    return balance.totalBalance;
  } catch (err) {
    console.error("❌ Failed to fetch balance:", err);
    return null;
  }
}
