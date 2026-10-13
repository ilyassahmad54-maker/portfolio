'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from './PortfolioImage';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Lock,
  Download,
  Upload,
  RotateCcw,
  User,
  Sparkles,
  Briefcase,
  Layers,
  GraduationCap,
  Plus,
  Trash2,
  AlertTriangle,
  Check,
  Image as ImageIcon,
  ExternalLink,
} from 'lucide-react';
import CmsControls from './CmsControls';
import { reorderProject } from '@/lib/cms/legacy';
import { usePortfolio } from './PortfolioContext';
import { portfolioData as initialPortfolioData } from '@/data/portfolio';
import { ProjectItem, SkillItem, ExperienceItem, EducationItem, CertificationItem } from '@/types/portfolio';



export default function EditDrawer() {
  const {
    editorData: data,
    cms, model, imageUrl,
    saveData,
    exportData,
    importData,
    lockSession,
    isEditOpen, isLockOpen,
    setIsEditOpen,
    showToast,
  } = usePortfolio();

  const [activeTab, setActiveTab] = useState<
    'profile' | 'skills' | 'projects' | 'experience' | 'education'
  >('profile');

  const [profileImageWarning, setProfileImageWarning] = useState<string | null>(null);
  const [projectImageWarning, setProjectImageWarning] = useState<Record<string, string | null>>({});
  const importFileRef = useRef<HTMLInputElement>(null);
  const profileFileInputRef = useRef<HTMLInputElement>(null);

  const drawerRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!isEditOpen||isLockOpen)return;
    const previous=document.activeElement as HTMLElement|null;
    const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
    drawerRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const keyboard=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){setIsEditOpen(false);return;}
      if(event.key!=='Tab')return;
      const targets=Array.from(drawerRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, a[href]')||[]).filter(item=>item.offsetParent!==null);
      const first=targets[0],last=targets[targets.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    };
    window.addEventListener('keydown',keyboard);
    return()=>{document.body.style.overflow=overflow;window.removeEventListener('keydown',keyboard);previous?.focus();};
  },[isEditOpen,isLockOpen,setIsEditOpen]);

  // Visibility is a convenience; server endpoints validate sessions independently.
  if (!isEditOpen) {
    return null;
  }

  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file=e.target.files?.[0];e.target.value='';if(!file)return;
    setProfileImageWarning('Uploading…');
    const success=await model.replaceImage(file,'profile');
    setProfileImageWarning(success?null:'Upload failed. Choose the file again to retry.');
  };

  const handleResetProfileImage = () => {
    const updated = {
      ...data,
      profile: {
        ...data.profile,
        profileImage: initialPortfolioData.profile.profileImage,
      },
    };
    saveData(updated);
    setProfileImageWarning(null);
    showToast('Reset profile photo to default.');
  };

  // Handle profile field edits
  const handleProfileFieldChange = (field: string, value: string) => {
    const updated = {
      ...data,
      profile: {
        ...data.profile,
        [field]: value,
      },
    };
    saveData(updated);
  };

  // Handle social links
  const handleSocialLinkChange = (platform: 'github' | 'linkedin', url: string) => {
    const updatedLinks = data.socialLinks.map((link) => {
      if (link.platform === platform) {
        return { ...link, url };
      }
      return link;
    });
    saveData({
      ...data,
      socialLinks: updatedLinks,
    });
  };

  const handleProjectImageUpload = async (projectId: string, file: File) => {
    setProjectImageWarning(previous=>({...previous,[projectId]:'Uploading…'}));
    const success=await model.replaceImage(file,projectId);
    setProjectImageWarning(previous=>({...previous,[projectId]:success?null:'Upload failed. Choose the file again to retry.'}));
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setIsEditOpen(false)}
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
      />

      {/* Drawer Container */}
      <motion.div
        ref={drawerRef} role="dialog" aria-modal="true" aria-labelledby="portfolio-editor-title"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full flex flex-col shadow-2xl z-10"
      >
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-accent text-white font-bold text-xs shadow-md">
              ✏️
            </span>
            <div>
              <h2 id="portfolio-editor-title" className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Portfolio Draft Editor</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  {model.dirty ? 'Unsaved' : 'Saved draft'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Edits stay in memory until Save Draft. Publish makes them public.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Lock Button */}
            <button
              onClick={lockSession}
              className="p-2 rounded-xl bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title="Log out and revoke session"
            >
              <Lock className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">Logout</span>
            </button>

            {/* Close Button */}
            <button
              onClick={() => setIsEditOpen(false)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close edit drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Action Bar (Export, Import, Reset) */}
        <div className="px-4 py-2.5 bg-slate-100/90 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={exportData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 transition-colors"
              title="Download your edited content as data.json"
            >
              <Download className="w-3.5 h-3.5 text-cyan-500" />
              <span>Export JSON</span>
            </button>

            <button
              disabled={cms.busy || !cms.working}
              onClick={() => importFileRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 transition-colors"
              title="Upload data.json to restore edits"
            >
              <Upload className="w-3.5 h-3.5 text-violet-500" />
              <span>Import JSON</span>
            </button>
            <input
              type="file"
              ref={importFileRef}
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  importData(reader.result as string);
                };
                if(file.size>32*1024*1024){showToast('Import exceeds 32 MiB.');return;}
                reader.readAsText(file);
                e.target.value = '';
              }}
            />
          </div>


        </div>

        <CmsControls />

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-4 bg-white dark:bg-slate-900 overflow-x-auto scrollbar-none">
          {[
            { id: 'profile', label: 'Profile', icon: User },
            { id: 'skills', label: 'Skills', icon: Sparkles },
            { id: 'projects', label: 'Projects', icon: Layers },
            { id: 'experience', label: 'Experience', icon: Briefcase },
            { id: 'education', label: 'Education', icon: GraduationCap },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 py-3 px-3.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Drawer Body Scroll Area */}
        <fieldset disabled={cms.busy || !cms.working} className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* ========================================================= */}
          {/* TAB 1: PROFILE & PHOTO                                   */}
          {/* ========================================================= */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Profile Photo Section */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-cyan-500" />
                  <span>Profile Photo</span>
                </h3>

                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-slate-900 border-2 border-cyan-500/40 shrink-0">
                    <Image
                      src={imageUrl(data.profile.profileImage,true)}
                      alt="Profile preview"
                      fill
                      unoptimized={data.profile.profileImage.startsWith('/api/assets/')}
                      className="object-cover"
                    />
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => profileFileInputRef.current?.click()}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-600 text-white transition-colors shadow-sm"
                      >
                        Choose New Photo
                      </button>

                      <button
                        type="button"
                        onClick={handleResetProfileImage}
                        className="px-3 py-2 rounded-xl text-xs font-medium bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
                      >
                        Reset to Default
                      </button>
                    </div>

                    <input
                      ref={profileFileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleProfileImageUpload}
                    />

                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      JPEG, PNG or WebP up to 4 MiB. Uploads remain unpublished.
                    </p>

                    {profileImageWarning && (
                      <div className="flex items-start gap-1.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{profileImageWarning}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Text Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name

                  <input
                    type="text"
                    value={data.profile.name}
                    onChange={(e) => handleProfileFieldChange('name', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                  /></label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Location

                  <input
                    type="text"
                    value={data.profile.location}
                    onChange={(e) => handleProfileFieldChange('location', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                  /></label>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Headline / Title

                  <input
                    type="text"
                    value={data.profile.headline}
                    onChange={(e) => handleProfileFieldChange('headline', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                  /></label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address

                  <input
                    type="email"
                    value={data.profile.email}
                    onChange={(e) => handleProfileFieldChange('email', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                  /></label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number

                  <input
                    type="text"
                    value={data.profile.phone}
                    onChange={(e) => handleProfileFieldChange('phone', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                  /></label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    GitHub Profile URL

                  <input
                    type="text"
                    value={data.socialLinks.find((s) => s.platform === 'github')?.url || ''}
                    onChange={(e) => handleSocialLinkChange('github', e.target.value)}
                    placeholder="https://github.com/username"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                  /></label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    LinkedIn Profile URL

                  <input
                    type="text"
                    value={data.socialLinks.find((s) => s.platform === 'linkedin')?.url || ''}
                    onChange={(e) => handleSocialLinkChange('linkedin', e.target.value)}
                    placeholder="https://linkedin.com/in/username"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                  /></label>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Availability Status Badge

                  <input
                    type="text"
                    value={data.profile.statusBadge}
                    onChange={(e) => handleProfileFieldChange('statusBadge', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                  /></label>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    High-Level Bio Summary

                  <textarea
                    rows={4}
                    value={data.profile.summary}
                    onChange={(e) => handleProfileFieldChange('summary', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white resize-none"
                  /></label>
                </div>
              </div>
              <details className="space-y-3"><summary className="text-sm font-semibold cursor-pointer">Additional profile details</summary>
                <label className="block text-xs">Rotating roles (one per line)<textarea className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800" value={data.profile.roles.join('\n')} onChange={e=>saveData({...data,profile:{...data.profile,roles:e.target.value.split('\n')}})}/></label>
                <label className="block text-xs">About paragraphs (separate with a blank line)<textarea rows={5} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800" value={data.profile.aboutParagraphs.join('\n\n')} onChange={e=>saveData({...data,profile:{...data.profile,aboutParagraphs:e.target.value.split('\n\n')}})}/></label>
                <label className="block text-xs">CV asset path<input className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800" value={data.profile.cvUrl} onChange={e=>handleProfileFieldChange('cvUrl',e.target.value)}/></label>
                <label className="block text-xs">Contact form endpoint<input className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800" value={data.profile.formspreeEndpoint} onChange={e=>handleProfileFieldChange('formspreeEndpoint',e.target.value)}/></label>
              </details>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: SKILLS                                            */}
          {/* ========================================================= */}
          {activeTab === 'skills' && (
            <div className="space-y-6">
              {/* Quick Add Skill Form */}
              <div className="p-4 rounded-2xl bg-cyan-500/5 dark:bg-cyan-500/10 border border-cyan-500/20">
                <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 mb-3 flex items-center gap-1.5">
                  <Plus className="w-4 h-4" />
                  <span>Add New Skill</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <input
                    id="new-skill-name"
                    type="text"
                    placeholder="Skill name (e.g. PyTorch, Docker)"
                    className="sm:col-span-5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white"
                  />
                  <select
                    id="new-skill-category"
                    className="sm:col-span-5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white"
                  >
                    {data.skills.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.category}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const nameInput = document.getElementById('new-skill-name') as HTMLInputElement;
                      const catSelect = document.getElementById('new-skill-category') as HTMLSelectElement;
                      if (!nameInput?.value.trim()) return;

                      const catId = catSelect.value;
                      const updatedSkills = data.skills.map((cat) => {
                        if (cat.id === catId) {
                          return {
                            ...cat,
                            skills: [...cat.skills, { name: nameInput.value.trim(), highlighted: true }],
                          };
                        }
                        return cat;
                      });

                      saveData({ ...data, skills: updatedSkills });
                      nameInput.value = '';
                      showToast('New skill added!');
                    }}
                    className="sm:col-span-2 py-2 px-3 rounded-xl bg-cyan-500 text-white font-semibold text-xs hover:bg-cyan-600 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Skills by Category */}
              {data.skills.map((category) => (
                <div
                  key={category.id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80"
                >
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
                    {category.category}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {category.skills.map((skill, sIdx) => (
                      <div
                        key={sIdx}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border ${
                          skill.highlighted
                            ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/40'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            // Toggle highlight
                            const updatedSkills = data.skills.map((c) => {
                              if (c.id === category.id) {
                                return {
                                  ...c,
                                  skills: c.skills.map((s, idx) =>
                                    idx === sIdx ? { ...s, highlighted: !s.highlighted } : s
                                  ),
                                };
                              }
                              return c;
                            });
                            saveData({ ...data, skills: updatedSkills });
                          }}
                          title="Click to toggle highlight"
                          className="hover:underline"
                        >
                          {skill.name}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            // Delete skill
                            const updatedSkills = data.skills.map((c) => {
                              if (c.id === category.id) {
                                return {
                                  ...c,
                                  skills: c.skills.filter((_, idx) => idx !== sIdx),
                                };
                              }
                              return c;
                            });
                            saveData({ ...data, skills: updatedSkills });
                          }}
                          className="text-slate-400 hover:text-rose-500 ml-1"
                          title="Delete skill"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: PROJECTS                                          */}
          {/* ========================================================= */}
          {activeTab === 'projects' && (
            <div className="space-y-6">
              {/* Add Project Button */}
              <button
                type="button"
                onClick={() => {
                  const newProj: ProjectItem = {
                    id: `proj-${crypto.randomUUID()}`,
                    title: 'New AI Project',
                    slug: `new-project-${Date.now()}`,
                    category: 'AI & Computer Vision',
                    summary: 'Short overview of the project.',
                    description: 'Detailed description of the pipeline and architecture.',
                    image: '/assets/projects/multimodal-ai.jpg',
                    tags: ['Python', 'PyTorch'],
                    githubUrl: '#',
                    demoUrl: '#',
                    featured: false,
                    highlights: ['Key milestone achieved'],
                  };
                  saveData({ ...data, projects: [newProj, ...data.projects] });
                  showToast('New project created!');
                }}
                className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-cyan-500/40 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/5 transition-colors font-bold text-sm flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Project</span>
              </button>

              {/* Projects List */}
              {data.projects.map((project, pIdx) => (
                <div
                  key={project.id}
                  className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                      Project #{pIdx + 1}
                    </span>
                    <div className="flex items-center gap-2">
                    <button type="button" aria-label={`Move ${project.title} up`} disabled={pIdx===0} className="p-2 disabled:opacity-30" onClick={()=>saveData(reorderProject(data,project.id,-1))}>↑</button>
                    <button type="button" aria-label={`Move ${project.title} down`} disabled={pIdx===data.projects.length-1} className="p-2 disabled:opacity-30" onClick={()=>saveData(reorderProject(data,project.id,1))}>↓</button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete project "${project.title}"?`)) {
                          saveData({
                            ...data,
                            projects: data.projects.filter((p) => p.id !== project.id),
                          });
                          showToast('Project deleted.');
                        }
                      }}
                      className="text-rose-500 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
                      aria-label={`Delete ${project.title}`} title="Delete project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    </div>
                  </div>

                  {/* Project Image Upload */}
                  <div className="flex items-center gap-3">
                    <div className="relative w-24 h-14 rounded-lg overflow-hidden bg-slate-900 border border-slate-700 shrink-0">
                      <Image
                        src={imageUrl(project.image,true)}
                        alt={project.title}
                        fill
                        unoptimized={project.image.startsWith('/api/assets/')}
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="inline-block px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-xs font-semibold cursor-pointer text-slate-800 dark:text-slate-100 transition-colors">
                        Upload Project Image
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void handleProjectImageUpload(project.id, file);
                            e.target.value='';
                          }}
                        />
                      </label>
                      {projectImageWarning[project.id] && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                          {projectImageWarning[project.id]}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Title

                      <input
                        type="text"
                        value={project.title}
                        onChange={(e) => {
                          const updated = data.projects.map((p) =>
                            p.id === project.id ? { ...p, title: e.target.value } : p
                          );
                          saveData({ ...data, projects: updated });
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white"
                      /></label>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Category

                      <select
                        value={project.category}
                        onChange={(e) => {
                          const updated = data.projects.map((p) =>
                            p.id === project.id
                              ? { ...p, category: e.target.value as any }
                              : p
                          );
                          saveData({ ...data, projects: updated });
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white"
                      >
                        <option value="AI & Computer Vision">AI & Computer Vision</option>
                        <option value="Machine Learning">Machine Learning</option>
                        <option value="Data Analytics & Viz">Data Analytics & Viz</option>
                      </select></label>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Tech Tags (comma separated)

                      <input
                        type="text"
                        value={project.tags.join(', ')}
                        onChange={(e) => {
                          const tags = e.target.value.split(',').map((t) => t.trim()).filter(Boolean);
                          const updated = data.projects.map((p) =>
                            p.id === project.id ? { ...p, tags } : p
                          );
                          saveData({ ...data, projects: updated });
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white"
                      /></label>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        GitHub URL (use # for placeholder)

                      <input
                        type="text"
                        value={project.githubUrl}
                        onChange={(e) => {
                          const updated = data.projects.map((p) =>
                            p.id === project.id ? { ...p, githubUrl: e.target.value } : p
                          );
                          saveData({ ...data, projects: updated });
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white font-mono"
                      /></label>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Demo URL (use # for placeholder)

                      <input
                        type="text"
                        value={project.demoUrl}
                        onChange={(e) => {
                          const updated = data.projects.map((p) =>
                            p.id === project.id ? { ...p, demoUrl: e.target.value } : p
                          );
                          saveData({ ...data, projects: updated });
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white font-mono"
                      /></label>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Description

                      <textarea
                        rows={3}
                        value={project.description}
                        onChange={(e) => {
                          const updated = data.projects.map((p) =>
                            p.id === project.id ? { ...p, description: e.target.value } : p
                          );
                          saveData({ ...data, projects: updated });
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white resize-none"
                      /></label>
                    </div>
                  </div>
                  <details className="space-y-3"><summary className="text-xs font-semibold cursor-pointer">Additional project details</summary>
                    {(['summary','slug','liveDemoUrl'] as const).map(field=><label key={field} className="block text-xs">{field==='liveDemoUrl'?'Live demo URL':field==='summary'?'Card summary':'Project slug'}<input className="w-full p-3 rounded-xl bg-white dark:bg-slate-800" value={project[field]||''} onChange={e=>saveData({...data,projects:data.projects.map(item=>item.id===project.id?{...item,[field]:e.target.value}:item)})}/></label>)}
                    <label className="block text-xs">Highlights (one per line)<textarea className="w-full p-3 rounded-xl bg-white dark:bg-slate-800" value={project.highlights.join('\n')} onChange={e=>saveData({...data,projects:data.projects.map(item=>item.id===project.id?{...item,highlights:e.target.value.split('\n')}:item)})}/></label>
                    <label className="block text-xs"><input type="checkbox" checked={project.featured} onChange={e=>saveData({...data,projects:data.projects.map(item=>item.id===project.id?{...item,featured:e.target.checked}:item)})}/> Featured project</label>
                  </details>
                </div>
              ))}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: EXPERIENCE                                         */}
          {/* ========================================================= */}
          {activeTab === 'experience' && (
            <div className="space-y-6">
              <button
                type="button"
                onClick={() => {
                  const newExp: ExperienceItem = {
                    id: `exp-${Date.now()}`,
                    role: 'Machine Learning Specialist',
                    company: 'AI Research Lab',
                    location: 'Peshawar, Pakistan',
                    period: '2025',
                    current: false,
                    description: ['Developed state-of-the-art predictive algorithms.'],
                    technologies: ['Python', 'PyTorch'],
                  };
                  saveData({ ...data, experience: [newExp, ...data.experience] });
                  showToast('Experience added!');
                }}
                className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-cyan-500/40 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/5 transition-colors font-bold text-sm flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Work Experience</span>
              </button>

              {data.experience.map((exp) => (
                <div
                  key={exp.id}
                  className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-500">{exp.period}</span>
                    <button
                      type="button"
                      onClick={() => {
                        saveData({
                          ...data,
                          experience: data.experience.filter((e) => e.id !== exp.id),
                        });
                        showToast('Experience entry deleted.');
                      }}
                      className="text-rose-500 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Role

                      <input
                        type="text"
                        value={exp.role}
                        onChange={(e) => {
                          const updated = data.experience.map((it) =>
                            it.id === exp.id ? { ...it, role: e.target.value } : it
                          );
                          saveData({ ...data, experience: updated });
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white"
                      /></label>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Company / Institute

                      <input
                        type="text"
                        value={exp.company}
                        onChange={(e) => {
                          const updated = data.experience.map((it) =>
                            it.id === exp.id ? { ...it, company: e.target.value } : it
                          );
                          saveData({ ...data, experience: updated });
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white"
                      /></label>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Dates / Period

                      <input
                        type="text"
                        value={exp.period}
                        onChange={(e) => {
                          const updated = data.experience.map((it) =>
                            it.id === exp.id ? { ...it, period: e.target.value } : it
                          );
                          saveData({ ...data, experience: updated });
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white"
                      /></label>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Technologies (comma separated)

                      <input
                        type="text"
                        value={exp.technologies.join(', ')}
                        onChange={(e) => {
                          const tech = e.target.value.split(',').map((t) => t.trim()).filter(Boolean);
                          const updated = data.experience.map((it) =>
                            it.id === exp.id ? { ...it, technologies: tech } : it
                          );
                          saveData({ ...data, experience: updated });
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white"
                      /></label>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Accomplishment Bullets (one per line)

                      <textarea
                        rows={3}
                        value={exp.description.join('\n')}
                        onChange={(e) => {
                          const bullets = e.target.value.split('\n').filter(Boolean);
                          const updated = data.experience.map((it) =>
                            it.id === exp.id ? { ...it, description: bullets } : it
                          );
                          saveData({ ...data, experience: updated });
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white resize-none"
                      /></label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 5: EDUCATION & CERTIFICATIONS                         */}
          {/* ========================================================= */}
          {activeTab === 'education' && (
            <div className="space-y-6">
              {/* Education Section */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-cyan-500" />
                  <span>Degrees & Academics</span>
                </h3>

                {data.education.map((edu) => (
                  <div
                    key={edu.id}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3 mb-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Degree

                        <input
                          type="text"
                          value={edu.degree}
                          onChange={(e) => {
                            const updated = data.education.map((item) =>
                              item.id === edu.id ? { ...item, degree: e.target.value } : item
                            );
                            saveData({ ...data, education: updated });
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white"
                        /></label>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Institution

                        <input
                          type="text"
                          value={edu.institution}
                          onChange={(e) => {
                            const updated = data.education.map((item) =>
                              item.id === edu.id ? { ...item, institution: e.target.value } : item
                            );
                            saveData({ ...data, education: updated });
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white"
                        /></label>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          GPA

                        <input
                          type="text"
                          value={edu.gpa}
                          onChange={(e) => {
                            const updated = data.education.map((item) =>
                              item.id === edu.id ? { ...item, gpa: e.target.value } : item
                            );
                            saveData({ ...data, education: updated });
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white"
                        /></label>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Period

                        <input
                          type="text"
                          value={edu.period}
                          onChange={(e) => {
                            const updated = data.education.map((item) =>
                              item.id === edu.id ? { ...item, period: e.target.value } : item
                            );
                            saveData({ ...data, education: updated });
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white"
                        /></label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Certifications Section */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-500" />
                    <span>Certifications</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      const newCert: CertificationItem = {
                        id: `cert-${Date.now()}`,
                        title: 'New Credential Title',
                        issuer: 'Online Learning Platform',
                        date: '2025',
                        skillsLearned: ['Python', 'Data Analysis'],
                      };
                      saveData({ ...data, certifications: [newCert, ...data.certifications] });
                      showToast('Certification added!');
                    }}
                    className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Credential</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {data.certifications.map((cert) => (
                    <div
                      key={cert.id}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-violet-500">{cert.issuer}</span>
                        <button
                          type="button"
                          onClick={() => {
                            saveData({
                              ...data,
                              certifications: data.certifications.filter((c) => c.id !== cert.id),
                            });
                            showToast('Certification deleted.');
                          }}
                          className="text-rose-500 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Certificate Title

                          <input
                            type="text"
                            value={cert.title}
                            onChange={(e) => {
                              const updated = data.certifications.map((c) =>
                                c.id === cert.id ? { ...c, title: e.target.value } : c
                              );
                              saveData({ ...data, certifications: updated });
                            }}
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white"
                          /></label>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Issuer

                          <input
                            type="text"
                            value={cert.issuer}
                            onChange={(e) => {
                              const updated = data.certifications.map((c) =>
                                c.id === cert.id ? { ...c, issuer: e.target.value } : c
                              );
                              saveData({ ...data, certifications: updated });
                            }}
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white"
                          /></label>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Year / Date

                          <input
                            type="text"
                            value={cert.date}
                            onChange={(e) => {
                              const updated = data.certifications.map((c) =>
                                c.id === cert.id ? { ...c, date: e.target.value } : c
                              );
                              saveData({ ...data, certifications: updated });
                            }}
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white"
                          /></label>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Skills Learned (comma separated)

                          <input
                            type="text"
                            value={cert.skillsLearned.join(', ')}
                            onChange={(e) => {
                              const skillsLearned = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                              const updated = data.certifications.map((c) =>
                                c.id === cert.id ? { ...c, skillsLearned } : c
                              );
                              saveData({ ...data, certifications: updated });
                            }}
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white"
                          /></label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </fieldset>
      </motion.div>
    </div>
  );
}
