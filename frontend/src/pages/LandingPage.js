import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { GraduationCap, BookOpen, Monitor, BarChart3, Shield, CheckCircle2, ArrowRight, Zap, Users, Award } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  const features = [
    { icon: BookOpen, title: 'Cours interactifs', desc: 'Contenus pedagogiques avec video, images et illustrations', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
    { icon: Monitor, title: 'Labs pratiques', desc: 'Machines virtuelles Windows Server et Linux en un clic', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
    { icon: Zap, title: 'Correction IA', desc: 'Correction automatique des exercices par intelligence artificielle', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
    { icon: BarChart3, title: 'Suivi en temps reel', desc: 'Progression, scores, badges et classements des etudiants', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { icon: Users, title: 'Multi-formations', desc: 'BTS SIO SISR et Bachelor AIS avec contenus dedies', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    { icon: Award, title: 'Gamification', desc: 'Systeme de niveaux, XP, badges et streaks pour motiver', color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/20' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-zinc-950 dark:to-zinc-900">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-4 border-b border-gray-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <GraduationCap className="w-8 h-8 text-cyan-500" />
          <span className="text-xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
            <span className="text-gradient">AI2</span><span className="text-gray-700 dark:text-zinc-300">Lean</span>
          </span>
          <span className="text-xs text-gray-400 dark:text-zinc-600 hidden sm:block">NETBFRS Academy</span>
        </div>
        <Button onClick={() => navigate('/login')} className="bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white px-6">
          Se connecter <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 md:px-12 py-20 md:py-32 text-center">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-violet-500/5" />
        <div className="absolute top-20 left-1/4 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
        
        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-full text-sm text-cyan-700 dark:text-cyan-400 mb-6 animate-fade-in">
            <Shield className="w-4 h-4" /> Plateforme pedagogique NETBFRS
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight mb-6 animate-fade-in-up" style={{ fontFamily: 'Space Grotesk' }}>
            Apprenez l'IT avec
            <br />
            <span className="text-gradient">l'intelligence artificielle</span>
          </h1>
          
          <p className="text-lg md:text-xl text-gray-600 dark:text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            Cours interactifs, labs pratiques sur machines virtuelles et correction automatique par IA. 
            La plateforme complete pour les formations BTS SIO SISR et Bachelor AIS.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <Button onClick={() => navigate('/login')} size="lg" className="bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white px-8 py-4 text-lg shadow-xl shadow-cyan-500/20">
              Commencer maintenant <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 md:px-12 py-16 md:py-24 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4" style={{ fontFamily: 'Space Grotesk' }}>
            Tout pour <span className="text-gradient">reussir</span>
          </h2>
          <p className="text-gray-600 dark:text-zinc-400 max-w-xl mx-auto">
            Une plateforme complete pensee pour les formations IT
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
          {features.map((f, i) => (
            <div key={i} className="p-6 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/50 hover-lift transition-all">
              <div className={`w-12 h-12 rounded-lg ${f.bg} border flex items-center justify-center mb-4`}>
                <f.icon className={`w-6 h-6 ${f.color}`} />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-zinc-100" style={{ fontFamily: 'Space Grotesk' }}>
                {f.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Formations */}
      <section className="px-6 md:px-12 py-16 bg-gray-50 dark:bg-zinc-900/50 border-y border-gray-200 dark:border-zinc-800">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-8" style={{ fontFamily: 'Space Grotesk' }}>
            Formations <span className="text-gradient">disponibles</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl bg-white dark:bg-zinc-900 border border-cyan-200 dark:border-cyan-800 hover-lift">
              <GraduationCap className="w-10 h-10 text-cyan-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-cyan-600 dark:text-cyan-400 mb-2" style={{ fontFamily: 'Space Grotesk' }}>BTS SIO SISR</h3>
              <p className="text-sm text-gray-600 dark:text-zinc-400">Solutions d'Infrastructure, Systemes et Reseaux</p>
              <div className="mt-4 space-y-1">
                {['Active Directory', 'DNS / DHCP', 'Virtualisation', 'Reseaux & VLANs'].map((t, i) => (
                  <p key={i} className="text-xs text-gray-500 dark:text-zinc-500 flex items-center justify-center gap-1"><CheckCircle2 className="w-3 h-3 text-cyan-400" />{t}</p>
                ))}
              </div>
            </div>
            <div className="p-6 rounded-xl bg-white dark:bg-zinc-900 border border-violet-200 dark:border-violet-800 hover-lift">
              <Shield className="w-10 h-10 text-violet-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-violet-600 dark:text-violet-400 mb-2" style={{ fontFamily: 'Space Grotesk' }}>Bachelor AIS</h3>
              <p className="text-sm text-gray-600 dark:text-zinc-400">Administration des Infrastructures Securisees</p>
              <div className="mt-4 space-y-1">
                {['Cybersecurite', 'Administration systeme', 'Supervision', 'Cloud computing'].map((t, i) => (
                  <p key={i} className="text-xs text-gray-500 dark:text-zinc-500 flex items-center justify-center gap-1"><CheckCircle2 className="w-3 h-3 text-violet-400" />{t}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 md:px-12 py-8 text-center border-t border-gray-200 dark:border-zinc-800">
        <p className="text-sm text-gray-500 dark:text-zinc-500">
          &copy; {new Date().getFullYear()} AI2Lean - NETBFRS Academy. Tous droits reserves.
        </p>
      </footer>
    </div>
  );
}
