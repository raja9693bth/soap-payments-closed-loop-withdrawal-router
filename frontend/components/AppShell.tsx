'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';
import { CommandPalette } from './CommandPalette';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Close mobile drawer upon route navigation
  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  // Handle Escape key and body scroll locking for mobile drawer
  useEffect(() => {
    if (!isMobileNavOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileNavOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isMobileNavOpen]);

  // If on the public landing page (/), render without the dashboard operations shell
  if (pathname === '/') {
    return <div className="min-h-screen bg-white w-full overflow-x-hidden">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col w-full max-w-full overflow-x-hidden">
      {/* Desktop Permanent Left Sidebar (Hidden on <1024px) */}
      <Sidebar />

      {/* Mobile & Tablet Slide-in Navigation Drawer */}
      {isMobileNavOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation drawer"
        >
          {/* Backdrop */}
          <div
            onClick={() => setIsMobileNavOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            aria-hidden="true"
          />

          {/* Slide-in Drawer Container */}
          <div className="relative z-10 flex h-full shadow-2xl animate-in slide-in-from-left duration-200">
            <Sidebar isDrawer onClose={() => setIsMobileNavOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area - Responsive left offset: 0 on mobile/tablet, 256px (pl-64) on lg */}
      <div className="flex-1 flex flex-col min-w-0 w-full lg:pl-64">
        <TopHeader
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenMobileNav={() => setIsMobileNavOpen(true)}
        />
        <main className="flex-1 p-3 sm:p-6 md:p-8 max-w-7xl w-full mx-auto min-w-0">
          {children}
        </main>
      </div>

      {/* Command Palette Modal */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </div>
  );
};
