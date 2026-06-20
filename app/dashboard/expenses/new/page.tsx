'use client';
import { useRouter } from 'next/navigation';

export default function NewExpensePage() {
  const router = useRouter();

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold">New Expense</h1>
      <button onClick={() => router.back()}>Cancel</button>
    </div>
  );
}