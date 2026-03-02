import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, BookOpen, ClipboardList, TrendingUp, Clock, GraduationCap, Shield } from 'lucide-react';

const formationMeta = {
  'bts-sio-sisr': { name: 'BTS SIO SISR', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20', icon: GraduationCap },
  'bachelor-ais': { name: 'Bachelor AIS', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20', icon: Shield },
};

export default function AdminDashboard() {
  const { getAuthHeaders, API, activeFormation } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get(`${API}/stats/overview`, { headers: getAuthHeaders() });
        setStats(res.data);
      } catch (err) { console.error(err); }
      setLoading(false);
    };
    fetchStats();
  }, [API, getAuthHeaders, activeFormation]);

  if (loading) return <div className="text-zinc-500 text-center py-20">Chargement...</div>;

  const statCards = [
    { label: 'Etudiants', value: stats?.total_students || 0, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { label: 'Formateurs', value: stats?.total_formateurs || 0, icon: Users, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
    { label: 'Exercices', value: stats?.total_exercises || 0, icon: BookOpen, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
    { label: 'Soumissions', value: stats?.total_submissions || 0, icon: ClipboardList, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  ];

  return (
    <div className="space-y-8" data-testid="admin-dashboard">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
          Tableau de bord <span className="text-gradient">AI2Lean</span>
        </h1>
        <p className="text-zinc-500 mt-1">Vue d'ensemble - NETBFRS Academy</p>
      </div>

      {/* Formation cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stats?.formation_stats?.map((f) => {
          const meta = formationMeta[f.id] || {};
          const Icon = meta.icon || GraduationCap;
          return (
            <Card key={f.id} className={`bg-zinc-900/50 backdrop-blur-md border-zinc-800 hover:border-zinc-700 transition-all`}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg ${meta.bg} border flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${meta.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-200" style={{ fontFamily: 'Space Grotesk' }}>{f.name}</p>
                    <p className="text-xs text-zinc-500">{f.students} etudiant{f.students !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-zinc-800/30 rounded-md p-2">
                    <p className="text-lg font-bold text-zinc-200" style={{ fontFamily: 'Space Grotesk' }}>{f.exercises}</p>
                    <p className="text-[10px] text-zinc-500 uppercase">Exercices</p>
                  </div>
                  <div className="bg-zinc-800/30 rounded-md p-2">
                    <p className="text-lg font-bold text-zinc-200" style={{ fontFamily: 'Space Grotesk' }}>{f.submissions}</p>
                    <p className="text-[10px] text-zinc-500 uppercase">Soumissions</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s, i) => (
          <Card key={s.label} className="bg-zinc-900/50 backdrop-blur-md border-zinc-800 animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider">{s.label}</p>
                  <p className="text-3xl font-bold mt-1" style={{ fontFamily: 'Space Grotesk' }}>{s.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-lg ${s.bg} border flex items-center justify-center`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Performance + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-zinc-900/50 backdrop-blur-md border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: 'Space Grotesk' }}>
              <TrendingUp className="w-4 h-4 text-cyan-400" /> Performance moyenne
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <span className="text-5xl font-bold text-gradient" style={{ fontFamily: 'Space Grotesk' }}>{stats?.avg_score || 0}%</span>
              <span className="text-zinc-500 text-sm mb-2">score moyen global</span>
            </div>
            <Progress value={stats?.avg_score || 0} className="mt-4 h-2 bg-zinc-800 [&>div]:bg-gradient-to-r [&>div]:from-cyan-500 [&>div]:to-violet-500" />
            <div className="mt-3 flex gap-4 text-xs text-zinc-500">
              <span>{stats?.graded_submissions || 0} corrigees</span>
              <span>{(stats?.total_submissions || 0) - (stats?.graded_submissions || 0)} en attente</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 backdrop-blur-md border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: 'Space Grotesk' }}>
              <Clock className="w-4 h-4 text-cyan-400" /> Activite recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[200px] overflow-y-auto">
              {stats?.recent_submissions?.length ? stats.recent_submissions.map((sub, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-medium text-zinc-400">
                      {sub.student_name?.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-zinc-200 truncate">{sub.student_name}</p>
                      <p className="text-xs text-zinc-500 truncate">{sub.exercise_title}</p>
                    </div>
                  </div>
                  <Badge className={sub.graded ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}>
                    {sub.graded ? `${sub.score}/${sub.max_score}` : 'En attente'}
                  </Badge>
                </div>
              )) : <p className="text-zinc-500 text-sm py-4 text-center">Aucune activite recente</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
