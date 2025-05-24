// File: lib/auth.ts
// Save this in: src/lib/auth.ts

import { getAuth, signInWithCustomToken, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase"; // Adjust path to your firebase config
import CryptoJS from "crypto-js";

export interface InternalWalletData {
  address: string;
  publicKey: string;
  privateKeyEncrypted: string;
  createdAt: string;
}

export interface UserWalletProfile {
  uid: string;
  email?: string;
  walletAddress: string;
  hasInternalWallet: boolean;
  createdAt: any;
  lastLogin?: any;
}

export class AuthService {
  private auth = getAuth();

  // Create Firebase user with email/password and link to internal wallet
  async createUserWithWallet(email: string, password: string, walletData: InternalWalletData) {
    try {
      // Create Firebase user
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      const user = userCredential.user;

      // Create user profile in Firestore with wallet info
      const userProfile: UserWalletProfile = {
        uid: user.uid,
        email: user.email || undefined,
        walletAddress: walletData.address,
        hasInternalWallet: true,
        createdAt: new Date(),
      };

      await setDoc(doc(db, "users", user.uid), userProfile);

      // Store encrypted wallet data separately (more secure)
      await setDoc(doc(db, "user_wallets", user.uid), {
        address: walletData.address,
        publicKey: walletData.publicKey,
        // Note: We don't store the encrypted private key in Firestore for security
        // Keep it in localStorage or secure local storage
        createdAt: walletData.createdAt,
        isActive: true
      });

      return { user, profile: userProfile };
    } catch (error) {
      console.error("Error creating user with wallet:", error);
      throw error;
    }
  }

  // Sign in with email/password
  async signInWithEmail(email: string, password: string) {
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      const user = userCredential.user;

      // Update last login
      await updateDoc(doc(db, "users", user.uid), {
        lastLogin: new Date()
      });

      // Get user profile
      const profileDoc = await getDoc(doc(db, "users", user.uid));
      const profile = profileDoc.data() as UserWalletProfile;

      return { user, profile };
    } catch (error) {
      console.error("Error signing in:", error);
      throw error;
    }
  }

  // Sign in with wallet address (alternative authentication)
  async signInWithWallet(walletAddress: string, signature: string) {
    try {
      // In a real implementation, you'd verify the signature server-side
      // and create a custom token. For now, we'll simulate this.
      
      // Find user by wallet address
      // You'd need to implement a cloud function to search for the user
      // and generate a custom token after signature verification
      
      console.log("Wallet authentication would happen here");
      throw new Error("Wallet authentication requires backend implementation");
    } catch (error) {
      console.error("Error with wallet authentication:", error);
      throw error;
    }
  }

  // Sign out
  async signOut() {
    try {
      await signOut(this.auth);
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  }

  // Get current user profile
  async getCurrentUserProfile(): Promise<UserWalletProfile | null> {
    const user = this.auth.currentUser;
    if (!user) return null;

    try {
      const profileDoc = await getDoc(doc(db, "users", user.uid));
      return profileDoc.exists() ? profileDoc.data() as UserWalletProfile : null;
    } catch (error) {
      console.error("Error getting user profile:", error);
      return null;
    }
  }

  // Listen to auth state changes
  onAuthStateChanged(callback: (user: User | null) => void) {
    return onAuthStateChanged(this.auth, callback);
  }

  // Get internal wallet data from localStorage
  getStoredWalletData(): InternalWalletData | null {
    try {
      const stored = localStorage.getItem("ownly_internal_wallet");
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error("Error getting stored wallet:", error);
      return null;
    }
  }

  // Decrypt private key with password
  decryptPrivateKey(encryptedPrivateKey: string, password: string): Uint8Array {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedPrivateKey, password);
      const privateKeyB64 = bytes.toString(CryptoJS.enc.Utf8);
      
      if (!privateKeyB64) {
        throw new Error("Failed to decrypt private key");
      }
      
      // Convert base64 to Uint8Array (you might need to adjust this based on your encoding)
      const binaryString = atob(privateKeyB64);
      const bytes2 = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes2[i] = binaryString.charCodeAt(i);
      }
      
      return bytes2;
    } catch (error) {
      console.error("Error decrypting private key:", error);
      throw new Error("Invalid password or corrupted private key");
    }
  }
}

// Create a singleton instance
export const authService = new AuthService();