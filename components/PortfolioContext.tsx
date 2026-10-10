'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { PortfolioData, Profile, ProjectItem, SkillCategory, ExperienceItem, EducationItem, CertificationItem } from '@/types/portfolio';
import { portfolioData as initialPortfolioData } from '@/data/portfolio';

const LOCAL_STORAGE_KEY = 'portfolio_custom_data';
const SESSION_STORAGE_LOCK_KEY = 'editUnlocked';

/**
 * Helper to check if edit mode has been unlocked for the current browser session.
 * Checks sessionStorage so the lock automatically re-engages whenever the browser is closed.
 */
export function isEditUnlocked(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(SESSION_STORAGE_LOCK_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Computes a SHA-256 hash string using the Web Crypto API.
 */
export async function computeSHA256(message: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    return message;
  }
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface PortfolioContextType {
  data: PortfolioData;
  isCustomized: boolean;
  isUnlocked: boolean;
  isLockOpen: boolean;
  isEditOpen: boolean;
  toastMessage: string | null;
  setIsLockOpen: (open: boolean) => void;
  setIsEditOpen: (open: boolean) => void;
  openEditMode: () => void;
  unlockWithPasscode: (passcode: string) => Promise<boolean>;
  lockSession: () => void;
  saveData: (newData: PortfolioData) => void;
  resetToDefault: () => void;
  exportData: () => void;
  importData: (jsonString: string) => boolean;
  showToast: (msg: string) => void;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<PortfolioData>(initialPortfolioData);
  const [isCustomized, setIsCustomized] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLockOpen, setIsLockOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Initialize from storage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Deep-merge with initialPortfolioData so missing keys don't crash
        setData({
          ...initialPortfolioData,
          ...parsed,
          profile: { ...initialPortfolioData.profile, ...(parsed.profile || {}) },
          projects: parsed.projects || initialPortfolioData.projects,
          skills: parsed.skills || initialPortfolioData.skills,
          experience: parsed.experience || initialPortfolioData.experience,
          education: parsed.education || initialPortfolioData.education,
          certifications: parsed.certifications || initialPortfolioData.certifications,
        });
        setIsCustomized(true);
      }
    } catch (err) {
      console.warn('Could not load custom portfolio data from localStorage:', err);
    }

    setIsUnlocked(isEditUnlocked());
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  // Autosave and update data state
  const saveData = useCallback((newData: PortfolioData) => {
    setData(newData);
    setIsCustomized(true);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newData));
    } catch (err) {
      console.error('Failed to save portfolio data to localStorage:', err);
    }
  }, []);

  // Reset to initial file defaults (does NOT clear passcode)
  const resetToDefault = useCallback(() => {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (err) {
      console.error('Failed to remove custom data from localStorage:', err);
    }
    setData(initialPortfolioData);
    setIsCustomized(false);
    showToast('Reset all data to default codebase settings.');
  }, [showToast]);

  // Unlock with SHA-256 hashed comparison
  const unlockWithPasscode = useCallback(
    async (passcode: string): Promise<boolean> => {
      try {
        const inputHash = await computeSHA256(passcode.trim());
        const targetHash = await computeSHA256(data.adminPasscode.trim());

        if (inputHash === targetHash) {
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(SESSION_STORAGE_LOCK_KEY, 'true');
          }
          setIsUnlocked(true);
          setIsLockOpen(false);
          setIsEditOpen(true);
          return true;
        }
      } catch (err) {
        console.error('Passcode verification error:', err);
      }
      return false;
    },
    [data.adminPasscode]
  );

  // Lock session and close edit panel
  const lockSession = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(SESSION_STORAGE_LOCK_KEY);
      } catch {}
    }
    setIsUnlocked(false);
    setIsEditOpen(false);
    setIsLockOpen(false);
    showToast('Edit mode locked.');
  }, [showToast]);

  // Open Edit Mode (checks gate)
  const openEditMode = useCallback(() => {
    if (isEditUnlocked()) {
      setIsUnlocked(true);
      setIsEditOpen(true);
    } else {
      setIsUnlocked(false);
      setIsLockOpen(true);
    }
  }, []);

  // Export data as data.json
  const exportData = useCallback(() => {
    try {
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'data.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Exported data.json successfully!');
    } catch (err) {
      console.error('Failed to export data:', err);
    }
  }, [data, showToast]);

  // Import data from JSON string
  const importData = useCallback(
    (jsonString: string): boolean => {
      try {
        const parsed = JSON.parse(jsonString);
        if (!parsed.profile || !parsed.projects) {
          showToast('Invalid data.json schema.');
          return false;
        }
        const merged: PortfolioData = {
          ...initialPortfolioData,
          ...parsed,
          profile: { ...initialPortfolioData.profile, ...parsed.profile },
          projects: parsed.projects || initialPortfolioData.projects,
          skills: parsed.skills || initialPortfolioData.skills,
          experience: parsed.experience || initialPortfolioData.experience,
          education: parsed.education || initialPortfolioData.education,
          certifications: parsed.certifications || initialPortfolioData.certifications,
        };
        saveData(merged);
        showToast('Imported data successfully!');
        return true;
      } catch (err) {
        showToast('Failed to parse imported JSON file.');
        return false;
      }
    },
    [saveData, showToast]
  );

  // Global keyboard shortcut: Ctrl+Shift+E (or Cmd+Shift+E)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
        e.preventDefault();
        openEditMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openEditMode]);

  return (
    <PortfolioContext.Provider
      value={{
        data,
        isCustomized,
        isUnlocked,
        isLockOpen,
        isEditOpen,
        toastMessage,
        setIsLockOpen,
        setIsEditOpen,
        openEditMode,
        unlockWithPasscode,
        lockSession,
        saveData,
        resetToDefault,
        exportData,
        importData,
        showToast,
      }}
    >
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return ctx;
}
