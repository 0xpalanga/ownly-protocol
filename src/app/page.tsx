import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8 bg-gradient-to-br from-gray-950 to-gray-900 text-white">
      <div className="text-center space-y-6 max-w-2xl">
        <h1 className="text-5xl font-extrabold leading-tight">
          Ownly Protocol
        </h1>
        <p className="text-lg text-gray-300">
          Your privacy, your control. Encrypt, transfer, and own your on-chain data with full transparency control.
        </p>
        <div className="flex items-center justify-center gap-4 pt-6">
          <Link href="/internal-wallet">
          
            <Button className="text-base px-6 py-4">
              Launch App <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
