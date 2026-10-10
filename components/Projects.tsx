'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Github,
  ExternalLink,
  Sparkles,
  Layers,
  ArrowUpRight,
  CheckCircle2,
} from 'lucide-react';
import { portfolioData } from '@/data/portfolio';
import SectionHeading from './SectionHeading';

const categories = [
  'All',
  'AI & Computer Vision',
  'Machine Learning',
  'Data Analytics & Viz',
] as const;

type Category = (typeof categories)[number];

export default function Projects() {
  const { projects } = portfolioData;
  const [activeCategory, setActiveCategory] = useState<Category>('All');

  const filteredProjects =
    activeCategory === 'All'
      ? projects
      : projects.filter((project) => project.category === activeCategory);

  return (
    <section id="projects" className="py-20 md:py-28 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Featured Engineering"
          title="Curated"
          highlightedWord="Projects"
          subtitle="Explore practical machine learning implementations, computer vision pipelines, and business intelligence dashboards."
        />

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
          {categories.map((category) => {
            const isActive = activeCategory === category;
            return (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`relative px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'text-white bg-gradient-accent shadow-md shadow-cyan-500/25'
                    : 'text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700/60'
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>

        {/* Projects Grid */}
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          <AnimatePresence>
            {filteredProjects.map((project, idx) => (
              <motion.div
                key={project.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                whileHover={{ y: -6 }}
                className="glass-card rounded-2xl overflow-hidden hover:border-cyan-500/40 dark:hover:border-cyan-500/40 transition-all duration-300 hover:shadow-2xl flex flex-col justify-between group"
              >
                <div>
                  {/* Project Image Container */}
                  <div className="relative w-full h-52 overflow-hidden bg-slate-900">
                    <Image
                      src={project.image}
                      alt={project.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />

                    {/* Category Badge Overlay */}
                    <div className="absolute top-3 left-3">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-900/85 backdrop-blur-md text-cyan-300 border border-slate-700/60">
                        {project.category}
                      </span>
                    </div>

                    {project.featured && (
                      <div className="absolute top-3 right-3">
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 backdrop-blur-md border border-amber-500/40">
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          Featured
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-cyan-500 dark:group-hover:text-cyan-400 transition-colors">
                      {project.title}
                    </h3>
                    <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                      {project.description}
                    </p>

                    {/* Key Highlights */}
                    {project.highlights && project.highlights.length > 0 && (
                      <div className="mt-4 space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                        {project.highlights.map((h, hIdx) => (
                          <div
                            key={hIdx}
                            className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-500 shrink-0 mt-0.5" />
                            <span className="line-clamp-1">{h}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Tech Tags */}
                    <div className="mt-5 flex flex-wrap gap-1.5">
                      {project.tags.map((tag, tIdx) => (
                        <span
                          key={tIdx}
                          className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Card Action Links */}
                <div className="p-6 pt-0 mt-2 flex items-center gap-3">
                  <a
                    href={project.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700/70 transition-colors"
                  >
                    <Github className="w-4 h-4" />
                    <span>Source Code</span>
                  </a>

                  {project.liveDemoUrl && (
                    <a
                      href={project.liveDemoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-gradient-accent shadow-sm hover:shadow-cyan-500/20 transition-all"
                    >
                      <span>Demo</span>
                      <ArrowUpRight className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}
