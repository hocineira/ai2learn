import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Users, BookOpen, ClipboardList, TrendingUp, Clock, GraduationCap, Shield, Download, BarChart3 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';

const formationMeta = {
  'bts-sio-sisr': { name: 'BTS SIO SISR', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20', icon: GraduationCap },
  'bachelor-ais': { name: 'Bachelor AIS', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20', icon: Shield },
};

const COLORS = ['#f43f5e', '#f59e0b', '#3b82f6', '#06b6d4', '#10b981'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2 shadow-xl">
        <p className="text-xs text-gray-500 dark:text-zinc-400 mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-sm font-medium" style={{ color: p.color }}>
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AdminDashboard() {
  const { getAuthHeaders, API, activeFormation } = useAuth();
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const headers = getAuthHeaders();
        const formParam = activeFormation ? `?formation=${activeFormation}` : '';
        const [statsRes, chartsRes] = await Promise.all([
          axios.get(`${API}/stats/overview${formParam}`, { headers }),
          axios.get(`${API}/stats/charts${formParam}`, { headers }),
        ]);
        setStats(statsRes.data);
        setCharts(chartsRes.data);
      } catch (err) { console.error(err); }
      setLoading(false);
    };
    fetchStats();
  }, [API, getAuthHeaders, activeFormation]);

  const handleExportCSV = async (type) => {
    try {
      const formParam = activeFormation ? `?formation=${activeFormation}` : '';
      const res = await axios.get(`${API}/export/${type}${formParam}`, {
        headers: getAuthHeaders(),
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = type.includes('tracking') ? `suivi-etudiants.csv` : `soumissions.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="text-gray-500 dark:text-zinc-500 text-center py-20">Chargement...</div>;

  const statCards = [
    { label: 'Etudiants', value: stats?.total_students || 0, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { label: 'Formateurs', value: stats?.total_formateurs || 0, icon: Users, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
    { label: 'Exercices', value: stats?.total_exercises || 0, icon: BookOpen, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
    { label: 'Soumissions', value: stats?.total_submissions || 0, icon: ClipboardList, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  ];

  const timelineData = (charts?.timeline || []).slice(-14);
  const scoreDist = charts?.score_distribution || [];
  const catStats = charts?.category_stats || [];
  const topStudents = charts?.top_students || [];

  return (
    <div className="space-y-8" data-testid="admin-dashboard">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
            Tableau de bord <span className="text-gradient">AI2Lean</span>
          </h1>
          <p className="text-gray-500 dark:text-zinc-500 mt-1">Vue d'ensemble - NETBFRS Academy</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="bg-gray-50 dark:bg-zinc-900 border-gray-300 dark:border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-800 hover:text-cyan-400" onClick={() => handleExportCSV('submissions-csv')} data-testid="export-submissions-csv">
            <Download className="w-4 h-4 mr-2" /> Export soumissions
          </Button>
          <Button variant="outline" size="sm" className="bg-gray-50 dark:bg-zinc-900 border-gray-300 dark:border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-800 hover:text-cyan-400" onClick={() => handleExportCSV('tracking-csv')} data-testid="export-tracking-csv">
            <Download className="w-4 h-4 mr-2" /> Export suivi
          </Button>
        </div>
      </div>

      {/* Formation cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stats?.formation_stats?.map((f) => {
          const meta = formationMeta[f.id] || {};
          const Icon = meta.icon || GraduationCap;
          return (
            <Card key={f.id} className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none hover:border-gray-300 dark:border-zinc-700 transition-all">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg ${meta.bg} border flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${meta.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200" style={{ fontFamily: 'Space Grotesk' }}>{f.name}</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-500">{f.students} etudiant{f.students !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-gray-50 dark:bg-zinc-800/30 rounded-md p-2">
                    <p className="text-lg font-bold text-gray-800 dark:text-zinc-200" style={{ fontFamily: 'Space Grotesk' }}>{f.exercises}</p>
                    <p className="text-[10px] text-gray-500 dark:text-zinc-500 uppercase">Exercices</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-zinc-800/30 rounded-md p-2">
                    <p className="text-lg font-bold text-gray-800 dark:text-zinc-200" style={{ fontFamily: 'Space Grotesk' }}>{f.submissions}</p>
                    <p className="text-[10px] text-gray-500 dark:text-zinc-500 uppercase">Soumissions</p>
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
          <Card key={s.label} className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-wider">{s.label}</p>
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

      {/* Charts row 1: Timeline + Score Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: 'Space Grotesk' }}>
              <TrendingUp className="w-4 h-4 text-cyan-400" /> Activite dans le temps
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={timelineData}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="count" name="Soumissions" stroke="#06b6d4" fill="url(#colorCount)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 dark:text-zinc-500 text-sm text-center py-10">Aucune donnee disponible</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: 'Space Grotesk' }}>
              <BarChart3 className="w-4 h-4 text-violet-400" /> Distribution des notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scoreDist.some(d => d.count > 0) ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={scoreDist}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="range" tick={{ fill: '#71717a', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Etudiants" radius={[4, 4, 0, 0]}>
                    {scoreDist.map((_, i) => (
                      <Cell key={i} fill={COLORS[i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 dark:text-zinc-500 text-sm text-center py-10">Aucune note disponible</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2: Categories + Top Students */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: 'Space Grotesk' }}>
              <BookOpen className="w-4 h-4 text-cyan-400" /> Performance par categorie
            </CardTitle>
          </CardHeader>
          <CardContent>
            {catStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={catStats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: '#71717a', fontSize: 10 }} />
                  <YAxis dataKey="category" type="category" width={100} tick={{ fill: '#a1a1aa', fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="avg_score" name="Score moyen (%)" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 dark:text-zinc-500 text-sm text-center py-10">Aucune donnee</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: 'Space Grotesk' }}>
              <Users className="w-4 h-4 text-emerald-400" /> Top etudiants
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topStudents.length > 0 ? (
              <div className="space-y-3 max-h-[220px] overflow-y-auto">
                {topStudents.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-gray-200 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold" style={{ color: i < 3 ? '#fbbf24' : '#71717a' }}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 dark:text-zinc-200 truncate">{s.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress value={s.avg_score} className="h-1.5 flex-1 bg-gray-200 dark:bg-zinc-800 [&>div]:bg-gradient-to-r [&>div]:from-cyan-500 [&>div]:to-violet-500" />
                        <span className="text-xs font-mono text-gray-500 dark:text-zinc-400 w-10 text-right">{s.avg_score}%</span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-zinc-500">{s.submissions} ex.</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-zinc-500 text-sm text-center py-10">Aucun etudiant</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: 'Space Grotesk' }}>
              <TrendingUp className="w-4 h-4 text-cyan-400" /> Performance moyenne
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <span className="text-5xl font-bold text-gradient" style={{ fontFamily: 'Space Grotesk' }}>{stats?.avg_score || 0}%</span>
              <span className="text-gray-500 dark:text-zinc-500 text-sm mb-2">score moyen global</span>
            </div>
            <Progress value={stats?.avg_score || 0} className="mt-4 h-2 bg-gray-200 dark:bg-zinc-800 [&>div]:bg-gradient-to-r [&>div]:from-cyan-500 [&>div]:to-violet-500" />
            <div className="mt-3 flex gap-4 text-xs text-gray-500 dark:text-zinc-500">
              <span>{stats?.graded_submissions || 0} corrigees</span>
              <span>{(stats?.total_submissions || 0) - (stats?.graded_submissions || 0)} en attente</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: 'Space Grotesk' }}>
              <Clock className="w-4 h-4 text-cyan-400" /> Activite recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[200px] overflow-y-auto">
              {stats?.recent_submissions?.length ? stats.recent_submissions.map((sub, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-zinc-800/50 last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-zinc-800 flex items-center justify-center text-xs font-medium text-gray-500 dark:text-zinc-400">
                      {sub.student_name?.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800 dark:text-zinc-200 truncate">{sub.student_name}</p>
                      <p className="text-xs text-gray-500 dark:text-zinc-500 truncate">{sub.exercise_title}</p>
                    </div>
                  </div>
                  <Badge className={sub.graded ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}>
                    {sub.graded ? `${sub.score}/${sub.max_score}` : 'En attente'}
                  </Badge>
                </div>
              )) : <p className="text-gray-500 dark:text-zinc-500 text-sm py-4 text-center">Aucune activite recente</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
