import { type ReactNode } from 'react';
import { Navbar } from './okaform';
import type { NavItem } from './okaform';

interface LayoutProps {
  children: ReactNode;
  navItems?: NavItem[] | null;
}

function Layout({ children, navItems }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-ok-bg">
      {navItems !== null && <Navbar items={navItems ?? undefined} />}
      <main className="flex-1">{children}</main>
    </div>
  );
}

export default Layout;
