'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface SectionHeadingProps {
  badge?: string;
  title: string;
  highlightedWord?: string;
  subtitle?: string;
  centered?: boolean;
}

export default function SectionHeading({
  badge,
  title,
  highlightedWord,
  subtitle,
  centered = true,
}: SectionHeadingProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`mb-12 md:mb-16 ${centered ? 'text-center' : 'text-left'}`}
    >
      {badge && (
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold tracking-wider uppercase bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
          {badge}
        </span>
      )}
      <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
        {title}{' '}
        {highlightedWord && (
          <span className="text-gradient">{highlightedWord}</span>
        )}
      </h2>
      {subtitle && (
        <p className="mt-4 text-base md:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          {subtitle}
        </p>
      )}
      <div className={`mt-4 flex items-center gap-1.5 ${centered ? 'justify-center' : 'justify-start'}`}>
        <div className="w-12 h-1 rounded-full bg-gradient-to-r from-cyan-500 to-violet-600" />
        <div className="w-2 h-1 rounded-full bg-violet-500" />
      </div>
    </motion.div>
  );
}
