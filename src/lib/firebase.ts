import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, orderBy, limit, addDoc, updateDoc, getDocs, doc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCIScTel5OABC3A4e0cv19QZBbCO2RchUI",
    authDomain: "ownly-protocol.firebaseapp.com",
    projectId: "ownly-protocol",
    storageBucket: "ownly-protocol.firebasestorage.app",
    messagingSenderId: "462314596286",
    appId: "1:462314596286:web:acd0ca3584e705cfb8bbef"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export interface Transaction {
  id?: string;
  type: 'encrypt' | 'decrypt' | 'send' | 'receive';
  tokenType: string;
  amount: string;
  sender: string;
  recipient?: string;
  encryptedData?: string;
  status: 'pending' | 'success' | 'failed' | 'locked' | 'sent' | 'received';
  timestamp: number;
  txHash?: string;
}

export async function saveTransaction(transaction: Transaction) {
  try {
    const docRef = await addDoc(collection(db, 'transactions'), transaction);
    return { ...transaction, id: docRef.id };
  } catch (error) {
    console.error('Error saving transaction:', error);
    throw error;
  }
}

export async function getUserTransactions(userAddress: string) {
  try {
    const q = query(
      collection(db, 'transactions'),
      where('sender', '==', userAddress),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Transaction[];
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
}

export async function updateTransactionStatus(transactionId: string, newStatus: Transaction['status']) {
  try {
    const transactionRef = doc(db, 'transactions', transactionId);
    await updateDoc(transactionRef, {
      status: newStatus,
      updatedAt: Date.now()
    });
  } catch (error) {
    console.error('Error updating transaction status:', error);
    throw error;
  }
}

export { db, auth }; 