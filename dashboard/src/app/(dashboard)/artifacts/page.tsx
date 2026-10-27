import type { Metadata } from 'next';
import { ArtifactsPage } from '@/components/pages/ArtifactsPage';

export const metadata: Metadata = { title: 'Artifacts' };

export default function Page() {
  return <ArtifactsPage />;
}
