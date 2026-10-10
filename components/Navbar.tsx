'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, FileDown, Sparkles } from 'lucide-react';
import { usePortfolio } from './PortfolioContext';
import ThemeToggle from './ThemeToggle';

export default function Navbar() {
  const { data } = usePortfolio();
  const { profile, navItems } = data;
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Background shadow & blur intensification
      setScrolled(window.scrollY > 20);

      // Scroll spy for active section
      const sections = navItems.map((item) =>
        item.href.replace('#', '')
      );
      
      const scrollPosition = window.scrollY + 120;
      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    e.preventDefault();
    setIsOpen(false);
    const targetId = href.replace('#', '');
    const element = document.getElementById(targetId);
    if (element) {
      const navOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - navOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'glass-nav shadow-lg shadow-black/5 dark:shadow-black/20 py-3'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Brand Logo */}
          <Link
            href="/"
            className="group flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900 dark:text-white"
          >
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-violet-600 text-white font-mono text-sm font-black shadow-md group-hover:scale-105 transition-transform">
              IA
            </span>
            <span className="hidden sm:inline font-bold">
              {profile.name}
            </span>
            <span className="sm:hidden font-bold">Ilyas</span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            {navItems.map((item) => {
              const isActive = activeSection === item.href.replace('#', '');
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.href)}
                  className={`relative px-3.5 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'text-cyan-600 dark:text-cyan-400 font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/50'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <motion.div
                      layoutId="activeNavIndicator"
                      className="absolute inset-0 bg-cyan-500/10 dark:bg-cyan-500/15 rounded-lg border border-cyan-500/20 -z-10"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                </a>
              );
            })}
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />

            {/* Resume Download Button */}
            <a
              href={profile.cvUrl}
              download="Ilyas_Ahmad_CV.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 text-xs md:text-sm font-semibold rounded-xl text-white bg-gradient-accent shadow-md shadow-cyan-500/20 hover:shadow-cyan-500/35 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <FileDown className="w-4 h-4" />
              <span>Download CV</span>
            </a>

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              aria-label={isOpen ? 'Close menu' : 'Open menu'}
              className="md:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400"
            >
              {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="md:hidden glass-card border-b border-t border-slate-200/80 dark:border-slate-800/80 mt-3 px-4 py-5 shadow-xl overflow-hidden"
          >
            <div className="flex flex-col gap-2">
              {navItems.map((item) => {
                const isActive = activeSection === item.href.replace('#', '');
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={(e) => handleNavClick(e, item.href)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-500/15 to-violet-500/15 text-cyan-600 dark:text-cyan-400 font-bold border border-cyan-500/20'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    {item.label}
                  </a>
                );
              })}

              <div className="pt-3 mt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                <a
                  href={profile.cvUrl}
                  download="Ilyas_Ahmad_CV.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-semibold rounded-xl text-white bg-gradient-accent shadow-md shadow-cyan-500/20"
                >
                  <FileDown className="w-4 h-4" />
                  <span>Download CV</span>
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
