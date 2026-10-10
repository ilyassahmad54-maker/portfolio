'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Briefcase,
  Calendar,
  MapPin,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { portfolioData } from '@/data/portfolio';
import SectionHeading from './SectionHeading';

export default function Experience() {
  const { experience } = portfolioData;

  return (
    <section id="experience" className="py-20 md:py-28 relative">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Career Journey"
          title="Work"
          highlightedWord="Experience"
          subtitle="Four targeted internships spanning government artificial intelligence research institutes and dynamic ML startups."
        />

        {/* Timeline Container */}
        <div className="relative mt-12 md:mt-16">
          {/* Vertical central connector line */}
          <div className="absolute left-4 md:left-1/2 top-4 bottom-4 w-0.5 bg-gradient-to-b from-cyan-500 via-teal-400 to-violet-600 -translate-x-1/2" />

          {/* Timeline Items */}
          <div className="space-y-12">
            {experience.map((item, index) => {
              const isEven = index % 2 === 0;

              return (
                <div
                  key={item.id}
                  className={`relative flex flex-col md:flex-row items-start ${
                    isEven ? 'md:flex-row-reverse' : ''
                  }`}
                >
                  {/* Center Node / Icon */}
                  <div className="absolute left-4 md:left-1/2 -translate-x-1/2 flex items-center justify-center z-10">
                    <div
                      className={`relative flex items-center justify-center w-8 h-8 rounded-full border-4 ${
                        item.current
                          ? 'bg-cyan-500 border-white dark:border-slate-900 shadow-lg shadow-cyan-500/50'
                          : 'bg-slate-200 dark:bg-slate-800 border-white dark:border-slate-900 shadow'
                      }`}
                    >
                      {item.current ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-slate-500 dark:bg-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Content Card (Left or Right on desktop, offset left on mobile) */}
                  <motion.div
                    initial={{ opacity: 0, x: isEven ? 40 : -40 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className={`ml-12 md:ml-0 md:w-[calc(50%-2.5rem)] ${
                      isEven ? 'md:mr-auto' : 'md:ml-auto'
                    }`}
                  >
                    <div className="glass-card rounded-2xl p-6 sm:p-7 hover:border-cyan-500/40 dark:hover:border-cyan-500/40 transition-all duration-300 hover:shadow-xl group">
                      {/* Top Header: Period & Status */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                          <Calendar className="w-3 h-3" />
                          {item.period}
                        </span>

                        {item.current && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Current Role
                          </span>
                        )}
                      </div>

                      {/* Role & Company */}
                      <h3 className="text-xl font-extrabold text-slate-900 dark:text-white group-hover:text-cyan-500 dark:group-hover:text-cyan-400 transition-colors">
                        {item.role}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1 text-sm font-semibold text-violet-600 dark:text-violet-400">
                        <Briefcase className="w-4 h-4 shrink-0" />
                        <span>{item.company}</span>
                      </div>

                      <div className="flex items-center gap-1 mt-1 text-xs text-slate-500 dark:text-slate-400">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span>{item.location}</span>
                      </div>

                      {/* Bulleted Accomplishments */}
                      <ul className="mt-4 space-y-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                        {item.description.map((bullet, bIdx) => (
                          <li key={bIdx} className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                            <span className="leading-relaxed">{bullet}</span>
                          </li>
                        ))}
                      </ul>

                      {/* Tech Chips */}
                      <div className="mt-5 pt-4 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-wrap gap-1.5">
                        {item.technologies.map((tech, tIdx) => (
                          <span
                            key={tIdx}
                            className="px-2.5 py-0.5 rounded-md text-xs font-mono bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
