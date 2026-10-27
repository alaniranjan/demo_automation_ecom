import type { Metadata } from 'next';
import { VisualPage } from '@/components/pages/VisualPage';

export const metadata: Metadata = { title: 'Visual Testing' };

export default function Page() {
  return <VisualPage />;
}
