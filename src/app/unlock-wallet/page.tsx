"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import CryptoJS from "crypto-js";

export default function UnlockWalletPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleUnlock = () => {
    const encryptedMnemonic = localStorage.getItem("ownly_wallet_encrypted");
    if (!encryptedMnemonic) {
      setError("No wallet found.");
      return;
    }

    try {
      const bytes = CryptoJS.AES.decrypt(encryptedMnemonic, password);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);

      if (!decrypted) {
        setError("Incorrect password. Try again.");
        return;
      }

      // Save decrypted mnemonic in session (not localStorage for security)
      sessionStorage.setItem("ownly_wallet_mnemonic", decrypted);
      router.push("/dashboard");

    } catch (err) {
      setError("Decryption failed.");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      <div className="bg-gray-900 p-6 rounded-xl shadow-md w-full max-w-md space-y-6">
        <h1 className="text-2xl font-bold text-center">Unlock Your Wallet</h1>
        <input
          type="password"
          className="w-full p-3 rounded bg-gray-800 text-white"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <Button className="w-full" onClick={handleUnlock}>Unlock Wallet</Button>
      </div>
    </main>
  );
}
