import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Users, GraduationCap, Shield, Download, TrendingUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2 shadow-xl">
        <p className="text-xs text-gray-500 dark:text-zinc-400 mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-sm font-medium" style={{ color: p.color }}>
            {p.name}: {p.value}%
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function TrackingPage() {
  const { getAuthHeaders, API, activeFormation } = useAuth();
  const [tracking, setTracking] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API}/stats/students-tracking?formation=${activeFormation || ''}`, { headers: getAuthHeaders() });
        setTracking(res.data);
      } catch (err) { console.error(err); }
      setLoading(false);
    };
    fetch();
  }, [API, getAuthHeaders, activeFormation]);

  const handleExportCSV = async () => {
    try {
      const formParam = activeFormation ? `?formation=${activeFormation}` : '';
      const res = await axios.get(`${API}/export/tracking-csv${formParam}`, {
        headers: getAuthHeaders(),
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'suivi-etudiants.csv';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="text-gray-500 dark:text-zinc-500 text-center py-20">Chargement...</div>;

  const formationLabel = activeFormation === 'bachelor-ais' ? 'Bachelor AIS' : 'BTS SIO SISR';

  // Chart data: student scores
  const chartData = tracking
    .slice()
    .sort((a, b) => b.avg_score - a.avg_score)
    .map(s => ({
      name: s.full_name?.split(' ')[0] || s.username,
      score: s.avg_score,
      exercises: s.exercises_completed,
    }));

  return (
    <div className="space-y-6" data-testid="tracking-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
            Suivi <span className="text-gradient">etudiants</span>
          </h1>
          <p className="text-gray-500 dark:text-zinc-500 mt-1">{formationLabel} - {tracking.length} etudiant{tracking.length !== 1 ? 's' : ''}</p>
        </div>
        <Button variant="outline" size="sm" className="bg-gray-50 dark:bg-zinc-900 border-gray-300 dark:border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-800 hover:text-cyan-400" onClick={handleExportCSV} data-testid="export-tracking-btn">
          <Download className="w-4 h-4 mr-2" /> Exporter CSV
        </Button>
      </div>

      {/* Overview chart */}
      {chartData.length > 0 && (
        <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: 'Space Grotesk' }}>
              <TrendingUp className="w-4 h-4 text-cyan-400" /> Classement par score moyen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 40)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: '#71717a', fontSize: 10 }} />
                <YAxis dataKey="name" type="category" width={80} tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="score" name="Score moyen" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.score >= 50 ? '#10b981' : entry.score > 0 ? '#f59e0b' : '#3f3f46'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tracking.map((student, i) => {
          const isBachelor = student.formation === 'bachelor-ais';
          return (
            <Card key={student.id} className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none hover:border-emerald-500/30 transition-all animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }} data-testid={`student-card-${student.id}`}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-sm font-medium text-emerald-400">
                    {student.full_name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200 truncate">{student.full_name}</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-500">@{student.username}</p>
                  </div>
                  <Badge className={isBachelor ? 'bg-violet-500/15 text-violet-400 border-violet-500/30 text-[10px]' : 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30 text-[10px]'}>
                    {isBachelor ? <><Shield className="w-3 h-3 mr-1" />AIS</> : <><GraduationCap className="w-3 h-3 mr-1" />SISR</>}
                  </Badge>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-zinc-500">Exercices completes</span>
                    <span className="text-sm font-medium text-gray-800 dark:text-zinc-200">{student.exercises_completed}</span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500 dark:text-zinc-500">Score moyen</span>
                      <span className="text-sm font-bold" style={{ color: student.avg_score >= 50 ? '#10b981' : student.avg_score > 0 ? '#f59e0b' : '#71717a' }}>{student.avg_score}%</span>
                    </div>
                    <Progress value={student.avg_score} className={`h-1.5 bg-gray-200 dark:bg-zinc-800 ${student.avg_score >= 50 ? '[&>div]:bg-emerald-500' : '[&>div]:bg-amber-500'}`} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-zinc-500">Derniere activite</span>
                    <span className="text-xs text-gray-500 dark:text-zinc-400">{student.last_activity ? new Date(student.last_activity).toLocaleDateString('fr-FR') : '-'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {tracking.length === 0 && (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-gray-300 dark:text-zinc-700 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-zinc-500">Aucun etudiant dans cette formation</p>
        </div>
      )}
    </div>
  );
}
