import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-6 bg-gradient-to-br from-gray-950 to-gray-900 text-white">
      <div className="text-center space-y-8 max-w-xl">
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight">
          Ownly Protocol
        </h1>
        <p className="text-lg sm:text-xl text-gray-400">
          Empower your privacy. Encrypt and control your digital assets with complete transparency.
        </p>
        <div className="pt-4">
          <Link href="/dashboard">
            <Button size="lg" className="px-6 py-4 text-base">
              Launch App <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
