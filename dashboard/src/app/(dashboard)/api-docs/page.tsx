import type { Metadata } from 'next';
import { ApiDocsPage } from '@/components/pages/ApiDocsPage';

export const metadata: Metadata = { title: 'API Documentation' };

export default function Page() {
  return <ApiDocsPage />;
}
