'use client';

import React from 'react';
import Image from './PortfolioImage';
import { motion } from 'framer-motion';
import { TypeAnimation } from 'react-type-animation';
import {
  FileDown,
  ArrowRight,
  Mail,
  MapPin,
  Github,
  Linkedin,
  Sparkles,
  Brain,
  Eye,
  Database,
} from 'lucide-react';
import { usePortfolio } from './PortfolioContext';

export default function Hero() {
  const { data, imageUrl } = usePortfolio();
  const { profile, socialLinks } = data;

  // Build typing sequence for react-type-animation
  const typingSequence = profile.roles.flatMap((role) => [role, 1800]);

  const githubLink = socialLinks.find((s) => s.platform === 'github');
  const linkedinLink = socialLinks.find((s) => s.platform === 'linkedin');
  const emailMailto = `mailto:${profile.email}?subject=Portfolio%20Contact`;

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      const navOffset = 80;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - navOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  return (
    <section className="relative min-h-[92vh] flex items-center justify-center pt-28 pb-16 md:pt-36 md:pb-24 overflow-hidden">
      {/* Background Animated Gradient Blobs */}
      <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
        {/* Cyan blob */}
        <motion.div
          animate={{
            x: [0, 40, -30, 0],
            y: [0, -50, 20, 0],
            scale: [1, 1.15, 0.95, 1],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute -top-24 -left-20 w-80 md:w-[480px] h-80 md:h-[480px] rounded-full bg-cyan-500/15 dark:bg-cyan-500/12 blur-3xl"
        />

        {/* Violet blob */}
        <motion.div
          animate={{
            x: [0, -50, 40, 0],
            y: [0, 60, -30, 0],
            scale: [1, 1.2, 0.9, 1],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute top-1/3 -right-24 w-80 md:w-[500px] h-80 md:h-[500px] rounded-full bg-violet-600/15 dark:bg-violet-600/15 blur-3xl"
        />

        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:32px_32px] dark:opacity-40" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Text & CTAs */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="lg:col-span-7 text-center lg:text-left"
          >
            {/* Status Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mb-6 shadow-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span>{profile.statusBadge}</span>
            </div>

            {/* Main Greeting */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.15]">
              Hi, I&apos;m{' '}
              <span className="text-gradient underline decoration-cyan-400/40 decoration-wavy decoration-2 underline-offset-8">
                {profile.name}
              </span>
            </h1>

            {/* Typed Role Headline */}
            <div className="mt-4 sm:mt-5 text-xl sm:text-2xl md:text-3xl font-semibold text-slate-700 dark:text-slate-200 min-h-[44px] flex items-center justify-center lg:justify-start gap-2">
              <span className="text-slate-500 dark:text-slate-400 font-normal">
                I am a
              </span>
              <span className="text-violet-600 dark:text-cyan-400 font-bold">
                <TypeAnimation
                  sequence={typingSequence}
                  wrapper="span"
                  speed={45}
                  repeat={Infinity}
                />
              </span>
            </div>

            {/* Location & Summary */}
            <div className="mt-4 flex items-center justify-center lg:justify-start gap-2 text-sm text-slate-500 dark:text-slate-400">
              <MapPin className="w-4 h-4 text-cyan-500 shrink-0" />
              <span>{profile.location}</span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                UET Peshawar
              </span>
            </div>

            <p className="mt-6 text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mx-auto lg:mx-0">
              {profile.summary}
            </p>

            {/* Action CTA Buttons */}
            <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-4">
              <a
                href="#projects"
                onClick={(e) => scrollToSection(e, 'projects')}
                className="inline-flex items-center gap-2 px-6 py-3.5 text-sm sm:text-base font-semibold rounded-xl text-white bg-gradient-accent shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                <span>Explore Projects</span>
                <ArrowRight className="w-4 h-4" />
              </a>

              <a
                href="#contact"
                onClick={(e) => scrollToSection(e, 'contact')}
                className="inline-flex items-center gap-2 px-6 py-3.5 text-sm sm:text-base font-semibold rounded-xl text-slate-800 dark:text-slate-100 bg-white/90 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-sm transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                <Mail className="w-4 h-4 text-cyan-500" />
                <span>Contact Me</span>
              </a>

              <a
                href={profile.cvUrl}
                download="Ilyas_Ahmad_CV.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3.5 text-sm sm:text-base font-semibold rounded-xl text-violet-700 dark:text-cyan-300 bg-violet-50 dark:bg-cyan-950/40 border border-violet-200 dark:border-cyan-800 hover:bg-violet-100 dark:hover:bg-cyan-900/40 transition-all hover:-translate-y-0.5"
              >
                <FileDown className="w-4 h-4" />
                <span>Download CV</span>
              </a>
            </div>

            {/* Social Links Row */}
            <div className="mt-8 pt-6 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-center lg:justify-start gap-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Connect with me:
              </span>
              <div className="flex items-center gap-2.5">
                {githubLink && (
                  <a
                    href={githubLink.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="GitHub profile"
                    className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-cyan-500 transition-colors"
                  >
                    <Github className="w-4 h-4" />
                  </a>
                )}
                {linkedinLink && (
                  <a
                    href={linkedinLink.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="LinkedIn profile"
                    className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-cyan-500 transition-colors"
                  >
                    <Linkedin className="w-4 h-4" />
                  </a>
                )}
                <a
                  href={emailMailto}
                  aria-label="Send email"
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-cyan-500 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                </a>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Profile Visual Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
            className="lg:col-span-5 flex justify-center"
          >
            <div className="relative w-72 sm:w-80 md:w-96 aspect-square max-w-full">
              {/* Outer decorative glowing ring */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-cyan-500 via-teal-400 to-violet-600 blur-xl opacity-35 dark:opacity-45 animate-pulse-slow" />

              {/* Card Container */}
              <div className="relative w-full h-full rounded-3xl p-2 bg-gradient-to-tr from-cyan-500/20 via-slate-200/50 to-violet-500/20 dark:from-cyan-500/30 dark:via-slate-800/60 dark:to-violet-500/30 backdrop-blur-md shadow-2xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden group">
                <div className="relative w-full h-full rounded-2xl overflow-hidden bg-slate-900">
                  <Image
                    src={imageUrl(profile.profileImage)}
                    alt={profile.name}
                    fill
                    priority
                    unoptimized={profile.profileImage.startsWith('/api/assets/')}
                    sizes="(max-width: 768px) 320px, 400px"
                    className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />

                  {/* Bottom caption inside card */}
                  <div className="absolute bottom-4 left-4 right-4 p-3 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-white">
                    <p className="font-semibold text-sm flex items-center justify-between">
                      <span>{profile.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                        GPA 3.7
                      </span>
                    </p>
                    <p className="text-xs text-slate-300 truncate mt-0.5">
                      {profile.headline}
                    </p>
                  </div>
                </div>
              </div>

              {/* Floating Pill: YOLO / CV */}
              <motion.div
                animate={{ y: [-4, 6, -4] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-3 -right-3 sm:-right-5 px-3 py-2 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 shadow-lg flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-100"
              >
                <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-500">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-600 dark:text-slate-300">Specialty</p>
                  <p className="font-bold text-cyan-600 dark:text-cyan-400">YOLO & CV</p>
                </div>
              </motion.div>

              {/* Floating Pill: Deep Learning */}
              <motion.div
                animate={{ y: [6, -6, 6] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                className="absolute -bottom-4 -left-3 sm:-left-5 px-3.5 py-2 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 shadow-lg flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-100"
              >
                <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-500">
                  <Brain className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-600 dark:text-slate-300">Focus</p>
                  <p className="font-bold text-violet-600 dark:text-violet-400">Deep Learning</p>
                </div>
              </motion.div>

              {/* Floating Pill: SQL & BI */}
              <motion.div
                animate={{ x: [-4, 4, -4] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                className="hidden sm:flex absolute top-1/2 -left-8 px-3 py-1.5 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 shadow-md items-center gap-1.5 text-xs font-medium text-slate-800 dark:text-slate-200"
              >
                <Database className="w-3.5 h-3.5 text-teal-500" />
                <span>SQL & BI</span>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
