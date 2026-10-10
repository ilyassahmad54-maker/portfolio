'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, KeyRound, Eye, EyeOff, X, AlertCircle } from 'lucide-react';
import { usePortfolio } from './PortfolioContext';

export default function AdminLockModal() {
  const { isLockOpen, setIsLockOpen, unlockWithPasscode } = usePortfolio();
  const [passcode, setPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isLockOpen) {
      setPasscode('');
      setError(false);
      setErrorMessage('');
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isLockOpen]);

  const handleUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!passcode.trim()) {
      setError(true);
      setErrorMessage('Please enter the admin passcode.');
      return;
    }

    setIsVerifying(true);
    setError(false);
    setErrorMessage('');

    const success = await unlockWithPasscode(passcode);
    setIsVerifying(false);

    if (!success) {
      setError(true);
      setErrorMessage('Unable to sign in. Check your passcode or try again later.');
      setPasscode('');
      inputRef.current?.focus();
    }
  };

  return (
    <AnimatePresence>
      {isLockOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Dark Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsLockOpen(false)}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={
              error
                ? {
                    opacity: 1,
                    scale: 1,
                    y: 0,
                    x: [0, -10, 10, -8, 8, -4, 4, 0],
                    transition: { duration: 0.5 },
                  }
                : { opacity: 1, scale: 1, y: 0 }
            }
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl z-10"
          >
            {/* Close Button */}
            <button
              onClick={() => setIsLockOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Lock Header */}
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-violet-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-500 dark:text-cyan-400 mb-4 shadow-inner">
                <Lock className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                Admin Edit Mode
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Enter your administrative passcode to unlock live site editing.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleUnlock} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="admin-passcode"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2"
                >
                  Admin Passcode
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    ref={inputRef}
                    id="admin-passcode"
                    type={showPassword ? 'text' : 'password'}
                    value={passcode}
                    onChange={(e) => {
                      setPasscode(e.target.value);
                      if (error) setError(false);
                    }}
                    placeholder="Enter admin passcode"
                    className="w-full pl-10 pr-12 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    aria-label={showPassword ? 'Hide passcode' : 'Show passcode'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsLockOpen(false)}
                  className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifying}
                  className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-accent shadow-md shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
                >
                  {isVerifying ? 'Verifying...' : 'Unlock Edit Mode'}
                </button>
              </div>

              <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 pt-1">
                Your session is verified by the server.
              </p>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
