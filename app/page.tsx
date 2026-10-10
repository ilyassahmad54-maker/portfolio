import React from 'react';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import About from '@/components/About';
import Skills from '@/components/Skills';
import Experience from '@/components/Experience';
import Projects from '@/components/Projects';
import Education from '@/components/Education';
import Contact from '@/components/Contact';
import Footer from '@/components/Footer';
import ScrollToTop from '@/components/ScrollToTop';
import AdminLockModal from '@/components/AdminLockModal';
import EditDrawer from '@/components/EditDrawer';
import Toast from '@/components/Toast';
import LocalChangesBadge from '@/components/LocalChangesBadge';

export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col bg-slate-50 dark:bg-[#0B1120] text-slate-800 dark:text-slate-100 selection:bg-cyan-500/20 selection:text-cyan-400">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <About />
        <Skills />
        <Experience />
        <Projects />
        <Education />
        <Contact />
      </main>
      <Footer />
      <ScrollToTop />
      <LocalChangesBadge />
      <AdminLockModal />
      <EditDrawer />
      <Toast />
    </div>
  );
}
