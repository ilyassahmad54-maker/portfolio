'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, X } from 'lucide-react';
import { usePortfolio } from './PortfolioContext';

export default function Toast() {
  const { toastMessage, showToast } = usePortfolio();

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      showToast('');
    }, 3800);
    return () => clearTimeout(timer);
  }, [toastMessage, showToast]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none px-4 max-w-md w-full flex justify-center">
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900/95 dark:bg-slate-800/95 text-white border border-cyan-500/30 shadow-2xl backdrop-blur-md text-sm font-medium"
          >
            <div className="p-1 rounded-lg bg-cyan-500/20 text-cyan-400 shrink-0">
              <Info className="w-4 h-4" />
            </div>
            <span className="flex-1 text-slate-100">{toastMessage}</span>
            <button
              onClick={() => showToast('')}
              className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
              aria-label="Dismiss toast"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
