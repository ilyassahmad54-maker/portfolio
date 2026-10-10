'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Code,
  BrainCircuit,
  BarChart3,
  Wrench,
  CheckCircle,
  Sparkles,
  Cpu,
} from 'lucide-react';
import { usePortfolio } from './PortfolioContext';
import SectionHeading from './SectionHeading';

const categoryIcons: Record<string, React.ElementType> = {
  programming: Code,
  'ai-ml': BrainCircuit,
  'data-viz': BarChart3,
  'tools-soft': Wrench,
};

export default function Skills() {
  const { data } = usePortfolio();
  const { skills } = data;

  return (
    <section id="skills" className="py-20 md:py-28 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Technical Stack"
          title="Skills &"
          highlightedWord="Proficiencies"
          subtitle="Specialized toolkit spanning artificial intelligence, deep learning architectures, statistical data modeling, and business intelligence."
        />

        {/* Skills Category Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {skills.map((category, idx) => {
            const Icon = categoryIcons[category.id] || Cpu;

            return (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                whileHover={{ y: -4 }}
                className="glass-card rounded-2xl p-6 sm:p-8 hover:border-cyan-500/40 dark:hover:border-cyan-500/40 transition-all duration-300 hover:shadow-lg flex flex-col justify-between"
              >
                <div>
                  {/* Category Header */}
                  <div className="flex items-center gap-3.5 mb-3">
                    <div className="p-3 rounded-xl bg-gradient-to-tr from-cyan-500/15 to-violet-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                        {category.category}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        {category.description}
                      </p>
                    </div>
                  </div>

                  {/* Skills Tag Cloud */}
                  <div className="mt-6 flex flex-wrap gap-2.5">
                    {category.skills.map((skill, sIdx) => (
                      <span
                        key={sIdx}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 ${
                          skill.highlighted
                            ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 font-semibold shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        {skill.highlighted && (
                          <Sparkles className="w-3 h-3 text-cyan-500" />
                        )}
                        {skill.name}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bottom Footer Accent */}
                <div className="mt-6 pt-4 border-t border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span>{category.skills.length} Competencies</span>
                  <span className="text-cyan-600 dark:text-cyan-400 font-medium">
                    Verified Hands-on
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
