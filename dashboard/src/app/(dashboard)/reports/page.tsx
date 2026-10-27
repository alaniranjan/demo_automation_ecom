import type { Metadata } from 'next';
import { ReportsPage } from '@/components/pages/ReportsPage';

export const metadata: Metadata = { title: 'Allure Reports' };

export default function Page() {
  return <ReportsPage />;
}
