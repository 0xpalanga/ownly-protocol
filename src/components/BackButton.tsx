import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function BackButton() {
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      onClick={() => router.push('/dashboard')}
      className="mb-6"
    >
      <span className="mr-2">←</span> Back to Dashboard
    </Button>
  );
} 