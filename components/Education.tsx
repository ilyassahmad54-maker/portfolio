'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  GraduationCap,
  Award,
  Calendar,
  MapPin,
  ExternalLink,
  BookOpen,
  CheckCircle,
  BadgeCheck,
} from 'lucide-react';
import { usePortfolio } from './PortfolioContext';
import SectionHeading from './SectionHeading';

export default function Education() {
  const { data } = usePortfolio();
  const { education, certifications } = data;

  return (
    <section id="education" className="py-20 md:py-28 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Credentials & Academics"
          title="Education &"
          highlightedWord="Certifications"
          subtitle="Formal academic foundations combined with industry-standard credentials in data science, SQL, and predictive analytics."
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          {/* Left Column: Education (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-500">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Formal Degree
              </h3>
            </div>

            {education.map((edu, idx) => (
              <motion.div
                key={edu.id}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="glass-card rounded-2xl p-6 sm:p-7 border-l-4 border-l-cyan-500 hover:border-cyan-500/60 transition-all hover:shadow-xl"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                    <Calendar className="w-3 h-3" />
                    {edu.period}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    GPA {edu.gpa}
                  </span>
                </div>

                <h4 className="text-xl font-black text-slate-900 dark:text-white mt-3">
                  {edu.degree}
                </h4>

                <p className="text-sm font-semibold text-violet-600 dark:text-cyan-400 mt-1">
                  {edu.institution}
                </p>

                <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>{edu.location}</span>
                </div>

                <div className="mt-5 space-y-2 pt-4 border-t border-slate-200/60 dark:border-slate-800/60 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                  {edu.details.map((detail, dIdx) => (
                    <div key={dIdx} className="flex items-start gap-2">
                      <BookOpen className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                      <span>{detail}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Right Column: Certifications (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="p-2 rounded-xl bg-violet-500/10 text-violet-500">
                <Award className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Professional Certifications
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {certifications.map((cert, idx) => (
                <motion.div
                  key={cert.id}
                  initial={{ opacity: 0, y: 25 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.5, delay: idx * 0.08 }}
                  whileHover={{ y: -4 }}
                  className="glass-card rounded-2xl p-5 hover:border-violet-500/40 dark:hover:border-violet-500/40 transition-all duration-300 hover:shadow-lg flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                        {cert.issuer}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {cert.date}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-slate-900 dark:text-white mt-2 leading-snug">
                      {cert.title}
                    </h4>

                    {/* Skill tags */}
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {cert.skillsLearned.map((skill, sIdx) => (
                        <span
                          key={sIdx}
                          className="px-2 py-0.5 rounded-md text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  {cert.credentialUrl && (
                    <div className="mt-5 pt-3 border-t border-slate-200/50 dark:border-slate-800/50">
                      <a
                        href={cert.credentialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline"
                      >
                        <BadgeCheck className="w-4 h-4 text-cyan-500" />
                        <span>Verify Credential</span>
                        <ExternalLink className="w-3 h-3 ml-0.5" />
                      </a>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
