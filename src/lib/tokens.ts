import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { bcs } from '@mysten/sui.js/bcs';
import type { EncryptedTokenData } from './tokenService';
import * as tokenService from './tokenService';
import CryptoJS from 'crypto-js';
import { PACKAGE_ID, LOCKER_ID } from './constants';
import { db } from './firebase';

// Update the transaction event types
export type TransactionType = 'Encrypt' | 'Lock' | 'Unlock' | 'Send' | 'Receive' | 'Transaction';
export type TransactionStatus = 'success' | 'pending' | 'failed' | 'locked' | 'sent' | 'received';

export interface TransactionEvent {
  id: string;
  type: TransactionType;
  tokenType: string;
  amount: string;
  sender: string;
  recipient?: string;
  status: TransactionStatus;
  timestamp: number;
}

export type { EncryptedTokenData };

// Re-export token service functions
export const saveEncryptedToken = tokenService.saveEncryptedToken;
export const getEncryptedTokensByStatus = tokenService.getEncryptedTokensByStatus;

export interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  coinType: string;
  address: string;
}

// Supported tokens on Sui testnet
export const SUPPORTED_TOKENS: { [key: string]: TokenInfo } = {
  SUI: {
    symbol: 'SUI',
    name: 'Sui',
    decimals: 9,
    coinType: '0x2::sui::SUI',
    address: ''
  },
  WAL: {
    symbol: 'WAL',
    name: 'Walrus',
    decimals: 9,
    coinType: '0x8190b041122eb492bf63cb464476bd68c6b7e570a4079645a8b28732b6197a82::wal::WAL', // Replace with actual WAL token address on testnet
    address: ''
  },
  DEEP: {
    symbol: 'DEEP',
    name: 'DeepBook Protocol',
    decimals: 9,
    coinType: '0x36dbef866a1d62bf7328989a10fb2f07d769f4ee587c0de4a0a256e57e0a58a8::deep::DEEP', // Replace with actual DEEP token address on testnet
    address: ''
  },
};

// Initialize SUI client with fallback URLs
const NETWORK_URLS = [
  'https://fullnode.testnet.sui.io',
  'https://sui-testnet.blockvision.org',
  'https://sui-testnet-rpc.allthatnode.com'
];

let currentUrlIndex = 0;

const getSuiClient = () => {
  return new SuiClient({ url: NETWORK_URLS[currentUrlIndex] });
};

// Retry mechanism for network requests
const withRetry = async <T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error);
      
      // If we haven't tried all URLs yet, switch to the next one
      if (error instanceof Error && error.message.includes('Failed to fetch')) {
        currentUrlIndex = (currentUrlIndex + 1) % NETWORK_URLS.length;
        console.log(`Switching to backup URL: ${NETWORK_URLS[currentUrlIndex]}`);
      }
      
      // If this was the last attempt, throw the error
      if (i === maxRetries - 1) throw error;
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
  throw new Error('All retry attempts failed');
};

// Update getTokenBalance to use retry mechanism
export const getTokenBalance = async (address: string, token: TokenInfo): Promise<string> => {
  return withRetry(async () => {
    const client = getSuiClient();
    const coins = await client.getCoins({
      owner: address,
      coinType: token.coinType
    });
    
    // Sum up all coin balances
    const totalBalance = coins.data
      .map(coin => BigInt(coin.balance))
      .reduce((a, b) => a + b, BigInt(0));
    
    return totalBalance.toString();
  });
};

export function buildLockTokenTransaction(
  amount: bigint,
  token: TokenInfo,
  recipientAddress: string
): TransactionBlock {
  const tx = new TransactionBlock();
  
  // Split the coin and send to escrow
  const [coin] = tx.splitCoins(tx.gas, [tx.pure(amount)]);
  
  // Create a new shared object to hold the locked tokens
  tx.moveCall({
    target: `${process.env.NEXT_PUBLIC_PACKAGE_ID}::token_locker::lock_token`,
    arguments: [
      coin,
      tx.pure(recipientAddress),
      tx.pure(token.coinType)
    ],
  });

  return tx;
}

export function buildUnlockTokenTransaction(
  recipientAddress: string,
  lockObjectId: string,
  token: TokenInfo
): TransactionBlock {
  const tx = new TransactionBlock();
  
  console.log('Building unlock transaction:', {
    recipientAddress,
    lockObjectId,
    tokenType: token.coinType
  });

  // Convert token type to a simple string for the contract
  const tokenTypeStr = token.symbol;

  // Call the unlock function with the shared object and get the returned coin
  const unlockedCoin = tx.moveCall({
    target: `${process.env.NEXT_PUBLIC_PACKAGE_ID}::token_locker::unlock_token`,
    arguments: [
      tx.object(lockObjectId),
      tx.pure(recipientAddress),
      tx.pure(Array.from(new TextEncoder().encode(tokenTypeStr))),
    ],
    typeArguments: [token.coinType]
  });

  // Transfer the unlocked coin to the recipient
  tx.transferObjects([unlockedCoin], tx.pure(recipientAddress));

  return tx;
}

export function buildTransferTokenTransaction(
  recipientAddress: string,
  amount: bigint,
  token: TokenInfo
): TransactionBlock {
  const tx = new TransactionBlock();
  
  // Split the coin and transfer
  const [coin] = tx.splitCoins(tx.gas, [tx.pure(amount)]);
  tx.transferObjects([coin], tx.pure(recipientAddress));

  return tx;
}

export function buildEncryptTokenTransaction(
  amount: string,
  token: TokenInfo,
  encryptedData: string,
  senderAddress: string,
  recipientAddress: string
): TransactionBlock {
  console.log("Building encryption transaction with params:", {
    amount,
    token,
    encryptedDataLength: encryptedData.length,
    senderAddress,
    recipientAddress
  });

  if (!amount || !token || !encryptedData || !senderAddress || !recipientAddress) {
    throw new Error("Missing required parameters for encryption");
  }

  const tx = new TransactionBlock();
  
  try {
    // Ensure amount is a valid bigint string
    const amountBigInt = BigInt(amount);
    if (amountBigInt <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    console.log("Creating coin with amount:", amount);

    // Create a coin object with the specified amount
    const [coin] = tx.splitCoins(tx.gas, [tx.pure(amount)]);

    // Get the package ID from environment variable
    const packageId = process.env.NEXT_PUBLIC_PACKAGE_ID;
    if (!packageId) {
      throw new Error("Package ID not configured");
    }

    console.log("Using package ID:", packageId);

    // Convert token type to a simple string for the contract
    const tokenTypeStr = token.symbol;

    // Call the lock_token function from the smart contract
    tx.moveCall({
      target: `${packageId}::token_locker::lock_token`,
      arguments: [
        coin,
        tx.pure(recipientAddress),
        tx.pure(Array.from(new TextEncoder().encode(tokenTypeStr))), // Convert string to UTF-8 bytes
      ],
      typeArguments: [token.coinType],
    });

    console.log("Transaction block built successfully");
    return tx;
  } catch (error) {
    console.error("Error building encryption transaction:", error);
    throw error;
  }
}

export async function getTransactionHistory(address: string): Promise<any[]> {
  try {
    const { data: transactions } = await getSuiClient().queryTransactionBlocks({
      filter: {
        FromAddress: address
      },
      options: {
        showInput: true,
        showEffects: true,
        showEvents: true,
      },
      limit: 50,
    });
    
    return transactions;
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    return [];
  }
}

// Add a new function to check package and module existence
export async function verifyContractModule() {
  try {
    const packageId = process.env.NEXT_PUBLIC_PACKAGE_ID;
    if (!packageId) {
      throw new Error("Package ID not configured");
    }

    const client = getSuiClient();
    
    // Get package info
    const { data: packageInfo } = await client.getObject({
      id: packageId,
      options: {
        showContent: true,
      }
    });

    console.log("Package info:", packageInfo);
    return packageInfo;
  } catch (error) {
    console.error("Error verifying contract module:", error);
    throw error;
  }
}

// Add a helper function to validate Sui address
export function isValidSuiAddress(address: string): boolean {
  // Sui addresses are 32 bytes (64 characters) prefixed with "0x"
  return /^0x[a-fA-F0-9]{64}$/.test(address);
} 
