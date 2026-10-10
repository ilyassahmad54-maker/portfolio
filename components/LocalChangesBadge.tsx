'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit3, RotateCcw } from 'lucide-react';
import { usePortfolio } from './PortfolioContext';

export default function LocalChangesBadge() {
  const { isCustomized, openEditMode, resetToDefault } = usePortfolio();

  return (
    <AnimatePresence>
      {isCustomized && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 left-6 z-40 hidden sm:flex items-center gap-2 p-1.5 pl-3 rounded-full bg-slate-900/90 dark:bg-slate-800/90 border border-amber-500/40 shadow-xl backdrop-blur-md text-xs"
        >
          <div className="flex items-center gap-1.5 text-amber-300 font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            <span>Editing (local changes)</span>
          </div>

          <button
            onClick={openEditMode}
            className="p-1.5 px-2.5 rounded-full bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 transition-colors flex items-center gap-1 font-semibold text-[11px]"
            title="Open Edit Mode"
          >
            <Edit3 className="w-3 h-3" />
            <span>Edit</span>
          </button>

          <button
            onClick={() => {
              if (confirm('Reset all custom changes to default codebase settings?')) {
                resetToDefault();
              }
            }}
            className="p-1.5 rounded-full text-slate-400 hover:text-rose-400 hover:bg-slate-700/50 transition-colors"
            title="Reset to default"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
