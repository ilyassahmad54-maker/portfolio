'use client';

import React from 'react';
import Link from 'next/link';
import { Heart, Github, Linkedin, Mail, ArrowUp } from 'lucide-react';
import { usePortfolio } from './PortfolioContext';

export default function Footer() {
  const { data, openEditMode } = usePortfolio();
  const { profile, socialLinks, navItems } = data;

  const currentYear = new Date().getFullYear();

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    e.preventDefault();
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
    <footer className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white/50 dark:bg-[#080d19]/80 backdrop-blur-md pt-14 pb-10 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start justify-between">
          {/* Brand & Summary */}
          <div className="md:col-span-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-violet-600 text-white font-mono text-sm font-black shadow-md">
                IA
              </span>
              <span className="font-bold text-lg text-slate-900 dark:text-white">
                {profile.name}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-sm leading-relaxed">
              {profile.headline}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {profile.location} • UET Peshawar
            </p>
          </div>

          {/* Quick Nav Links */}
          <div className="md:col-span-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-3">
              Navigation
            </h4>
            <ul className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
              {navItems.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    onClick={(e) => handleNavClick(e, item.href)}
                    className="text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Social Icons & Connect */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Connect
            </h4>
            <div className="flex items-center gap-2.5">
              {socialLinks.map((s, idx) => {
                let Icon = Mail;
                let href = s.url;
                if (s.platform === 'github') Icon = Github;
                if (s.platform === 'linkedin') Icon = Linkedin;
                if (s.platform === 'email') {
                  href = `mailto:${profile.email}?subject=Portfolio%20Contact`;
                }

                return (
                  <a
                    key={idx}
                    href={href}
                    target={s.platform === 'email' ? undefined : '_blank'}
                    rel={s.platform === 'email' ? undefined : 'noopener noreferrer'}
                    aria-label={s.label}
                    className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-cyan-500/10 text-slate-700 dark:text-slate-300 hover:text-cyan-500 dark:hover:text-cyan-400 border border-slate-200 dark:border-slate-700/60 transition-colors"
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                );
              })}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Open to Data Science, ML & Computer Vision roles.
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-6 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
          <p>© {currentYear} {profile.name}. All rights reserved.</p>
          <div className="flex items-center gap-3">
            <button
              onClick={openEditMode}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 transition-colors hover:border-cyan-500/50"
              title="Open Admin Edit Mode (Ctrl+Shift+E)"
            >
              <span>✏️</span>
              <span>Edit</span>
            </button>
            <p className="flex items-center gap-1">
              Built with Next.js 14, Tailwind CSS & Framer Motion
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
