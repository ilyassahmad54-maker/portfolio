'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Mail,
  Phone,
  MapPin,
  Send,
  Linkedin,
  Github,
  Check,
  Copy,
  AlertCircle,
} from 'lucide-react';
import { usePortfolio } from './PortfolioContext';
import SectionHeading from './SectionHeading';

export default function Contact() {
  const { data } = usePortfolio();
  const { profile, socialLinks } = data;

  const [formState, setFormState] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
    _gotcha: '', // Formspree honeypot field for spam prevention
  });

  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedEmail, setCopiedEmail] = useState(false);

  const mailtoLink = `mailto:${profile.email}?subject=Portfolio%20Contact`;

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(profile.email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormState((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setErrorMessage('');

    try {
      const response = await fetch(profile.formspreeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(formState),
      });

      if (response.ok) {
        setStatus('success');
        setFormState({
          name: '',
          email: '',
          subject: '',
          message: '',
          _gotcha: '',
        });
      } else {
        const responseData = await response.json().catch(() => null);
        setStatus('error');
        const apiError =
          responseData?.errors?.map((err: any) => err.message).join(', ') ||
          responseData?.error ||
          'Failed to send message. Please email me directly.';
        setErrorMessage(apiError);
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        'Network error encountered. Please email me directly at ' + profile.email
      );
    }
  };

  const githubLink = socialLinks.find((s) => s.platform === 'github');
  const linkedinLink = socialLinks.find((s) => s.platform === 'linkedin');

  return (
    <section id="contact" className="py-20 md:py-28 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Get in Touch"
          title="Let's Build"
          highlightedWord="Together"
          subtitle="Interested in collaborating on AI/ML projects, data analytics initiatives, or internship and full-time opportunities? Send a message."
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left Column: Direct Contact Details & Cards (5 Cols) */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-5 space-y-6"
          >
            {/* Primary Email Card */}
            <div className="glass-card rounded-2xl p-6 relative overflow-hidden group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  {/* FIX 2: Mail icon triggers pre-filled mail client */}
                  <a
                    href={mailtoLink}
                    aria-label="Send email via mail client"
                    className="p-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 transition-all hover:scale-105"
                  >
                    <Mail className="w-5 h-5" />
                  </a>
                  <div>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Email Address
                    </p>
                    <a
                      href={mailtoLink}
                      className="text-sm sm:text-base font-bold text-slate-900 dark:text-white hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors"
                    >
                      {profile.email}
                    </a>
                  </div>
                </div>

                <button
                  onClick={handleCopyEmail}
                  title="Copy email address"
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                >
                  {copiedEmail ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>

              {copiedEmail && (
                <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  Copied to clipboard!
                </p>
              )}
            </div>

            {/* Phone Card */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Phone / WhatsApp
                  </p>
                  <a
                    href={`tel:${profile.phone.replace(/\s+/g, '')}`}
                    className="text-sm sm:text-base font-bold text-slate-900 dark:text-white hover:text-violet-500 dark:hover:text-violet-400 transition-colors"
                  >
                    {profile.phone}
                  </a>
                </div>
              </div>
            </div>

            {/* Location Card */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Current Location
                  </p>
                  <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    {profile.location}
                  </p>
                </div>
              </div>
            </div>

            {/* Social Connection Row */}
            <div className="glass-card rounded-2xl p-6">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-3">
                Social Profiles
              </p>
              <div className="flex flex-wrap gap-3">
                {linkedinLink && (
                  <a
                    href={linkedinLink.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-cyan-500/15 hover:text-cyan-500 dark:hover:text-cyan-400 border border-slate-200 dark:border-slate-700/60 transition-colors"
                  >
                    <Linkedin className="w-4 h-4 text-[#0A66C2]" />
                    <span>LinkedIn</span>
                  </a>
                )}
                {githubLink && (
                  <a
                    href={githubLink.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-cyan-500/15 hover:text-cyan-500 dark:hover:text-cyan-400 border border-slate-200 dark:border-slate-700/60 transition-colors"
                  >
                    <Github className="w-4 h-4" />
                    <span>GitHub</span>
                  </a>
                )}
              </div>
            </div>
          </motion.div>

          {/* Right Column: Interactive Contact Form (7 Cols) */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="lg:col-span-7"
          >
            <div className="glass-card rounded-2xl p-6 sm:p-8">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                Send a Direct Message
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mb-6">
                Fill out the form below and I will respond to your inquiry within 24 hours.
              </p>

              {/* Success Feedback Banner */}
              {status === 'success' && (
                <div className="mb-6 p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm">Message sent! I&apos;ll get back to you soon.</p>
                    <p className="text-xs mt-0.5">
                      Your note has been securely forwarded to my inbox.
                    </p>
                  </div>
                </div>
              )}

              {/* Error Feedback Banner */}
              {status === 'error' && (
                <div className="mb-6 p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-800 dark:text-rose-300 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm">Submission Error</p>
                    <p className="text-xs mt-0.5">{errorMessage}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Formspree hidden honeypot field */}
                <input
                  type="text"
                  name="_gotcha"
                  value={formState._gotcha}
                  onChange={handleChange}
                  style={{ display: 'none' }}
                  tabIndex={-1}
                  autoComplete="off"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="name"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Your Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      required
                      value={formState.name}
                      onChange={handleChange}
                      placeholder="e.g. Sarah Jenkins"
                      className="w-full px-4 py-2.5 rounded-xl text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="email"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Email Address *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      value={formState.email}
                      onChange={handleChange}
                      placeholder="e.g. sarah@company.com"
                      className="w-full px-4 py-2.5 rounded-xl text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="subject"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Subject *
                  </label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    required
                    value={formState.subject}
                    onChange={handleChange}
                    placeholder="Project Inquiry / Job Opportunity / Collaboration"
                    className="w-full px-4 py-2.5 rounded-xl text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label
                    htmlFor="message"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Message *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={5}
                    required
                    value={formState.message}
                    onChange={handleChange}
                    placeholder="Describe your project, timeline, or inquiry..."
                    className="w-full px-4 py-2.5 rounded-xl text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={status === 'submitting'}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold text-white bg-gradient-accent shadow-md shadow-cyan-500/20 hover:shadow-cyan-500/35 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:pointer-events-none"
                >
                  {status === 'submitting' ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Sending message...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Send Message</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
