import type { Metadata } from 'next';
import { RunsPage } from '@/components/pages/RunsPage';

export const metadata: Metadata = { title: 'Responsive Testing' };

export default function Page() {
  return <RunsPage testing="responsive" />;
}
