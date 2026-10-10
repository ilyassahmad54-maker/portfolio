'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { PortfolioData, Profile, ProjectItem, SkillCategory, ExperienceItem, EducationItem, CertificationItem } from '@/types/portfolio';
import { portfolioData as initialPortfolioData } from '@/data/portfolio';

const LOCAL_STORAGE_KEY = 'portfolio_custom_data';
function backupDraft() {
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (stored) localStorage.setItem(`${LOCAL_STORAGE_KEY}_backup_${Date.now()}`, stored);
}

async function authorized(): Promise<boolean> {
  try {
    const response = await fetch('/api/admin/session', { cache: 'no-store' });
    return response.ok;
  } catch { return false; }
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

  // Stored drafts are previewed only by an authenticated admin. Never rewrite on load.
  const loadDraft = useCallback(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        delete parsed.adminPasscode;
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

  }, []);

  useEffect(() => {
    void authorized().then(valid => {
      setIsUnlocked(valid);
      if (valid) loadDraft();
    });
  }, [loadDraft]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  // Autosave and update data state
  const saveData = useCallback(async (newData: PortfolioData) => {
    if (!(await authorized())) { setIsUnlocked(false); setIsEditOpen(false); return; }
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newData));
      setData(newData);
      setIsCustomized(true);
    } catch (err) {
      console.error('Failed to save portfolio data to localStorage:', err);
      showToast('Draft could not be saved. Browser storage may be full.');
    }
  }, [showToast]);

  // Reset browser-local drafts to initial file defaults
  const resetToDefault = useCallback(async () => {
    if (!(await authorized())) { setIsUnlocked(false); setIsEditOpen(false); return; }
    try {
      backupDraft();
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (err) {
      showToast('Reset cancelled: could not back up your draft.');
      return;
    }
    setData(initialPortfolioData);
    setIsCustomized(false);
    showToast('Reset all data to default codebase settings.');
  }, [showToast]);

  const unlockWithPasscode = useCallback(async (passcode: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      if (!response.ok) return false;
      loadDraft();
      setIsUnlocked(true); setIsLockOpen(false); setIsEditOpen(true);
      return true;
    } catch { return false; }
  }, [loadDraft]);

  const lockSession = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Logout failed');
      setIsUnlocked(false); setIsEditOpen(false); setIsLockOpen(false);
      setData(initialPortfolioData); setIsCustomized(false);
      showToast('Logged out. Draft preserved; showing published content.');
    } catch { showToast('Logout failed. Please try again.'); }
  }, [showToast]);

  const openEditMode = useCallback(async () => {
    const valid = await authorized();
    if (valid) loadDraft();
    setIsUnlocked(valid);
    setIsEditOpen(valid);
    setIsLockOpen(!valid);
  }, [loadDraft]);

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
        delete parsed.adminPasscode;
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
        try { backupDraft(); } catch {
          showToast('Import cancelled: could not back up your draft.');
          return false;
        }
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
