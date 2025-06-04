import { SUPPORTED_TOKENS } from '@/lib/tokens';

// Format balance with proper decimals
export const formatBalance = (balance: string, decimals: number = 9): string => {
  try {
    if (!balance) return '0.0000';
    
    // If the balance is already in decimal format
    if (balance.includes('.')) {
      const [integerPart, fractionalPart = ''] = balance.split('.');
      const paddedFractional = fractionalPart.padEnd(decimals, '0');
      const fullNumber = integerPart + paddedFractional;
      const value = BigInt(fullNumber);
      const divisor = BigInt(10 ** decimals);
      const formattedInteger = value / divisor;
      const formattedFractional = (value % divisor).toString().padStart(decimals, '0');
      const formattedAmount = `${formattedInteger}.${formattedFractional.slice(0, 4)}`;
      return formattedAmount.replace(/\.?0+$/, '');
    }

    // If the balance is in smallest unit format
    const value = BigInt(balance);
    const divisor = BigInt(10 ** decimals);
    const integerPart = value / divisor;
    const fractionalPart = (value % divisor).toString().padStart(decimals, '0');
    const formattedAmount = `${integerPart}.${fractionalPart.slice(0, 4)}`;
    return formattedAmount.replace(/\.?0+$/, '');
  } catch (error) {
    console.error('Error formatting balance:', error);
    return '0.0000';
  }
};

// Convert decimal to smallest unit
export const decimalToSmallestUnit = (amount: string, decimals: number): bigint => {
  try {
    if (!amount) return BigInt(0);
    
    // Handle decimal input
    if (amount.includes('.')) {
      const [integerPart, fractionalPart = ''] = amount.split('.');
      const paddedFractional = fractionalPart.padEnd(decimals, '0').slice(0, decimals);
      const fullNumber = integerPart + paddedFractional;
      return BigInt(fullNumber);
    }
    
    // Handle integer input
    return BigInt(amount) * BigInt(10 ** decimals);
  } catch (error) {
    console.error('Error converting to smallest unit:', error);
    return BigInt(0);
  }
};

// Format transaction amount
export const formatTransactionAmount = (amount: string, token: string): string => {
  const tokenInfo = SUPPORTED_TOKENS[token as keyof typeof SUPPORTED_TOKENS];
  if (!tokenInfo) return amount;
  return formatBalance(amount, tokenInfo.decimals);
};

// Generate unique transaction ID
export const generateUniqueId = (() => {
  let counter = 0;
  return () => `tx-${counter++}`;
})(); 