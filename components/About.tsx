'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  GraduationCap,
  MapPin,
  Briefcase,
  Award,
  CheckCircle2,
  Code2,
  Layers,
  Sparkles,
} from 'lucide-react';
import { usePortfolio } from './PortfolioContext';
import SectionHeading from './SectionHeading';

function AnimatedCounter({
  target,
  suffix = '',
}: {
  target: number;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    let start = 0;
    const isDecimal = target % 1 !== 0;
    const duration = 1500; // ms
    const steps = 40;
    const stepDuration = duration / steps;
    const increment = target / steps;

    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(isDecimal ? parseFloat(start.toFixed(1)) : Math.floor(start));
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [isInView, target]);

  return (
    <span ref={ref} className="font-extrabold tracking-tight">
      {count}
      {suffix}
    </span>
  );
}

export default function About() {
  const { data } = usePortfolio();
  const { profile, stats } = data;

  const keyHighlights = [
    {
      icon: GraduationCap,
      label: 'Degree',
      value: 'BS Data Science',
      sub: 'UET Peshawar (GPA 3.7)',
    },
    {
      icon: MapPin,
      label: 'Location',
      value: profile.location,
      sub: 'Open to Remote & Relocation',
    },
    {
      icon: Briefcase,
      label: 'Experience',
      value: '4 Industry Internships',
      sub: 'AI & Data Science Roles',
    },
    {
      icon: Award,
      label: 'Academic Standing',
      value: 'Top Tier / GPA 3.7',
      sub: 'Distinction Track',
    },
  ];

  return (
    <section id="about" className="py-20 md:py-28 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Background & Expertise"
          title="About"
          highlightedWord="Me"
          subtitle="Transforming complex unstructured data into intelligent machine learning models and actionable strategic insights."
        />

        {/* Bio & Highlights Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Column: Narrative paragraphs */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-7 space-y-5"
          >
            <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-200/60 dark:border-slate-800/60">
                <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    Who I Am & What I Drive
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Data Scientist • ML Engineer • Vision Architect
                  </p>
                </div>
              </div>

              {profile.aboutParagraphs.map((paragraph, idx) => (
                <p
                  key={idx}
                  className="text-slate-600 dark:text-slate-300 leading-relaxed text-base"
                >
                  {paragraph}
                </p>
              ))}

              {/* Core Strengths Checklist */}
              <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {[
                  'YOLO Object Detection & ViT Backbones',
                  'Multimodal AI Pipeline Architecture',
                  'Predictive ML Modeling (Scikit-learn)',
                  'Business Intelligence (Power BI & Tableau)',
                  'Complex SQL Queries & Relational DBs',
                  'End-to-End Clean ML Codebases',
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0" />
                    <span className="text-xs sm:text-sm font-medium">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Right Column: Quick Info Cards */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4"
          >
            {keyHighlights.map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={index}
                  className="glass-card rounded-2xl p-5 hover:border-cyan-500/40 dark:hover:border-cyan-500/40 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 flex items-start gap-4"
                >
                  <div className="p-3 rounded-xl bg-gradient-to-tr from-cyan-500/10 to-violet-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      {item.label}
                    </p>
                    <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                      {item.value}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                      {item.sub}
                    </p>
                  </div>
                </div>
              );
            })}
          </motion.div>
        </div>

        {/* Animated Stats Counter Row */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {stats.map((stat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="glass-card rounded-2xl p-6 text-center group hover:border-cyan-500/40 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="text-3xl sm:text-4xl md:text-5xl font-black text-gradient">
                <AnimatedCounter target={stat.value} suffix={stat.suffix} />
              </div>
              <p className="mt-2 text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">
                {stat.label}
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                {stat.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
