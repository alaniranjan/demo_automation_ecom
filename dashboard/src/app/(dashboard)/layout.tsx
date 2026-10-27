import { AppShell } from '@/components/shell/AppShell';

export default function DashboardLayout({ children }: LayoutProps<'/'>) {
  return <AppShell>{children}</AppShell>;
}
