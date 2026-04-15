import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { BookOpen, Users, TrendingUp, PlusCircle, Download, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Cell
} from 'recharts';

const COLORS = ['#f43f5e', '#f59e0b', '#3b82f6', '#06b6d4', '#10b981'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2 shadow-xl">
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

export default function FormateurDashboard() {
  const { getAuthHeaders, API, activeFormation } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [tracking, setTracking] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const headers = getAuthHeaders();
        const f = activeFormation || '';
        const [statsRes, chartsRes, exRes, trackRes] = await Promise.all([
          axios.get(`${API}/stats/overview?formation=${f}`, { headers }),
          axios.get(`${API}/stats/charts?formation=${f}`, { headers }),
          axios.get(`${API}/exercises?formation=${f}`, { headers }),
          axios.get(`${API}/stats/students-tracking?formation=${f}`, { headers }),
        ]);
        setStats(statsRes.data);
        setCharts(chartsRes.data);
        setExercises(exRes.data);
        setTracking(trackRes.data);
      } catch (err) { console.error(err); }
      setLoading(false);
    };
    fetchAll();
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
      link.download = type.includes('tracking') ? 'suivi-etudiants.csv' : 'soumissions.csv';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="text-gray-500 dark:text-zinc-500 text-center py-20">Chargement...</div>;

  const formationLabel = activeFormation === 'bachelor-ais' ? 'Bachelor AIS' : 'BTS SIO SISR';
  const timelineData = (charts?.timeline || []).slice(-14);
  const scoreDist = charts?.score_distribution || [];
  const catStats = charts?.category_stats || [];

  return (
    <div className="space-y-8" data-testid="formateur-dashboard">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
            <span className="text-gradient">AI2Lean</span> - {formationLabel}
          </h1>
          <p className="text-gray-500 dark:text-zinc-500 mt-1">Gerez vos exercices et suivez vos etudiants</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="bg-gray-50 dark:bg-zinc-900 border-gray-300 dark:border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-zinc-800 hover:text-cyan-400" onClick={() => handleExportCSV('submissions-csv')}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <Button data-testid="create-exercise-btn" onClick={() => navigate('/exercises/create')} className="bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white">
            <PlusCircle className="w-4 h-4 mr-2" /> Nouvel exercice
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-xs font-mono text-gray-500 dark:text-zinc-500 uppercase">Exercices</p>
              <p className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>{exercises.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-mono text-gray-500 dark:text-zinc-500 uppercase">Etudiants</p>
              <p className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>{tracking.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-xs font-mono text-gray-500 dark:text-zinc-500 uppercase">Score moyen</p>
              <p className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>{stats?.avg_score || 0}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: 'Space Grotesk' }}>
              <TrendingUp className="w-4 h-4 text-cyan-400" /> Soumissions dans le temps
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={timelineData}>
                  <defs>
                    <linearGradient id="colorCountF" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="count" name="Soumissions" stroke="#06b6d4" fill="url(#colorCountF)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 dark:text-zinc-500 text-sm text-center py-10">Aucune donnee</p>
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
              <ResponsiveContainer width="100%" height={200}>
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
              <p className="text-gray-500 dark:text-zinc-500 text-sm text-center py-10">Aucune note</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Students tracking */}
      <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: 'Space Grotesk' }}>
              <Users className="w-4 h-4 text-cyan-400" /> Suivi des etudiants
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-gray-500 dark:text-zinc-400 hover:text-cyan-400 text-xs" onClick={() => handleExportCSV('tracking-csv')}>
              <Download className="w-3 h-3 mr-1" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tracking.length ? (
            <div className="space-y-3">
              {tracking.slice(0, 6).map((student) => (
                <div key={student.id} className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-zinc-800/30 border border-gray-200 dark:border-zinc-800/50 hover:border-gray-300 dark:border-zinc-700 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-sm font-medium text-emerald-400">
                    {student.full_name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-zinc-200">{student.full_name}</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-500">@{student.username}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-800 dark:text-zinc-200">{student.exercises_completed} exerc.</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-500">Score: {student.avg_score}%</p>
                  </div>
                  <div className="w-20">
                    <Progress value={student.avg_score} className="h-1.5 bg-gray-200 dark:bg-zinc-800 [&>div]:bg-emerald-500" />
                  </div>
                </div>
              ))}
              {tracking.length > 6 && (
                <Button variant="ghost" className="w-full text-gray-500 dark:text-zinc-400 hover:text-cyan-400" onClick={() => navigate('/tracking')}>
                  Voir tous ({tracking.length})
                </Button>
              )}
            </div>
          ) : <p className="text-gray-500 dark:text-zinc-500 text-sm py-4 text-center">Aucun etudiant dans cette formation</p>}
        </CardContent>
      </Card>

      {/* Exercises */}
      <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: 'Space Grotesk' }}>
            <BookOpen className="w-4 h-4 text-cyan-400" /> Exercices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {exercises.slice(0, 5).map((ex) => (
              <div key={ex.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-zinc-800/30 border border-gray-200 dark:border-zinc-800/50 hover:border-cyan-500/30 transition-all cursor-pointer group"
                onClick={() => navigate(`/exercises/${ex.id}`)} data-testid={`exercise-card-${ex.id}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 dark:text-zinc-200 group-hover:text-cyan-400 transition-colors truncate">{ex.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className="bg-zinc-800 text-gray-500 dark:text-zinc-400 border-gray-300 dark:border-zinc-700 text-[10px]">{ex.category}</Badge>
                    <span className="text-xs text-gray-500 dark:text-zinc-500">{ex.questions?.length || 0} Q</span>
                    {ex.shared && <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-[10px]">Partage</Badge>}
                  </div>
                </div>
                <Badge className={ex.submission_count > 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-zinc-800 text-gray-500 dark:text-zinc-500 border-gray-300 dark:border-zinc-700'}>
                  {ex.submission_count} soum.
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
