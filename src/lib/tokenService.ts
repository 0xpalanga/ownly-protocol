import { db } from './firebase';
import { collection, addDoc, query, where, getDocs, orderBy } from 'firebase/firestore';

export interface EncryptedTokenData {
  id?: string;
  txDigest: string;
  encryptedData: string;
  encryptionKey: string;
  amount: string; // This is stored as raw amount (with all decimals)
  token: string;
  timestamp: number;
  sender: string;
  recipient?: string;
  status: 'locked' | 'sent' | 'received';
  lockObjectId: string;
}

export const saveEncryptedToken = async (tokenData: EncryptedTokenData): Promise<string> => {
  try {
    // Ensure amount is stored as raw value
    if (!tokenData.amount) {
      throw new Error('Amount is required');
    }

    const tokensCollection = collection(db, 'encryptedTokens');
    const docRef = await addDoc(tokensCollection, {
      ...tokenData,
      amount: tokenData.amount.toString() // Ensure amount is stored as string
    });
    return docRef.id;
  } catch (error) {
    console.error('Error saving encrypted token:', error);
    throw error;
  }
};

export const getEncryptedTokensByStatus = async (status: string, address: string): Promise<EncryptedTokenData[]> => {
  try {
    const tokensCollection = collection(db, 'encryptedTokens');
    let q;
    
    if (status === 'sent') {
      q = query(
        tokensCollection,
        where('sender', '==', address),
        where('status', '==', 'sent'),
        orderBy('timestamp', 'desc')
      );
    } else if (status === 'received') {
      q = query(
        tokensCollection,
        where('recipient', '==', address),
        where('status', '==', 'received'),
        orderBy('timestamp', 'desc')
      );
    } else { // locked
      q = query(
        tokensCollection,
        where('sender', '==', address),
        where('status', '==', 'locked'),
        orderBy('timestamp', 'desc')
      );
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        amount: data.amount.toString() // Ensure amount is returned as string
      };
    }) as EncryptedTokenData[];
  } catch (error) {
    console.error('Error fetching encrypted tokens:', error);
    return [];
  }
}; 