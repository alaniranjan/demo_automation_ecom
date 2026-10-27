import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageSkeleton } from '@/components/pages/PageSkeleton';
import { SuitesPage } from '@/components/pages/SuitesPage';

export const metadata: Metadata = { title: 'Test Suites' };

export default function Page() {
  // SuitesPage reads ?status= with useSearchParams, which needs a Suspense boundary on a prerendered route.
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SuitesPage />
    </Suspense>
  );
}
