// File: contexts/AuthContext.tsx
// Save this in: src/contexts/AuthContext.tsx

"use client";
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { authService, UserWalletProfile, InternalWalletData } from '../lib/auth';

interface AuthContextType {
  user: User | null;
  profile: UserWalletProfile | null;
  walletData: InternalWalletData | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, walletData: InternalWalletData) => Promise<void>;
  signOut: () => Promise<void>;
  unlockWallet: (password: string) => Promise<boolean>;
  isWalletUnlocked: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserWalletProfile | null>(null);
  const [walletData, setWalletData] = useState<InternalWalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isWalletUnlocked, setIsWalletUnlocked] = useState(false);

  // Initialize auth state
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Get user profile
        const userProfile = await authService.getCurrentUserProfile();
        setProfile(userProfile);
        
        // Get stored wallet data
        const storedWallet = authService.getStoredWalletData();
        setWalletData(storedWallet);
      } else {
        setProfile(null);
        setWalletData(null);
        setIsWalletUnlocked(false);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { user: firebaseUser, profile: userProfile } = await authService.signInWithEmail(email, password);
      
      // The auth state change listener will handle setting the state
      // But we can also set it directly for immediate UI update
      setUser(firebaseUser);
      setProfile(userProfile);
      
      // Get stored wallet data
      const storedWallet = authService.getStoredWalletData();
      setWalletData(storedWallet);
    } catch (error) {
      console.error("Sign in error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, walletData: InternalWalletData) => {
    try {
      setLoading(true);
      const { user: firebaseUser, profile: userProfile } = await authService.createUserWithWallet(
        email, 
        password, 
        walletData
      );
      
      setUser(firebaseUser);
      setProfile(userProfile);
      setWalletData(walletData);
    } catch (error) {
      console.error("Sign up error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await authService.signOut();
      setUser(null);
      setProfile(null);
      setWalletData(null);
      setIsWalletUnlocked(false);
    } catch (error) {
      console.error("Sign out error:", error);
      throw error;
    }
  };

  const unlockWallet = async (password: string): Promise<boolean> => {
    if (!walletData?.privateKeyEncrypted) {
      throw new Error("No wallet data available");
    }

    try {
      // Try to decrypt the private key with the provided password
      const decryptedKey = authService.decryptPrivateKey(walletData.privateKeyEncrypted, password);
      
      if (decryptedKey) {
        setIsWalletUnlocked(true);
        // Optionally store the unlocked state temporarily
        sessionStorage.setItem("wallet_unlocked", "true");
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Error unlocking wallet:", error);
      return false;
    }
  };

  const value: AuthContextType = {
    user,
    profile,
    walletData,
    loading,
    signIn,
    signUp,
    signOut,
    unlockWallet,
    isWalletUnlocked
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}