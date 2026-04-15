import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { BookOpen, BarChart3, TrendingUp, CheckCircle2, Clock, ArrowRight, GraduationCap, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2 shadow-xl">
        <p className="text-xs text-gray-500 dark:text-zinc-400 mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-sm font-medium" style={{ color: p.color }}>
            {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function EtudiantDashboard() {
  const { getAuthHeaders, API, user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const formation = user?.formation || 'bts-sio-sisr';
  const formationLabel = formation === 'bachelor-ais' ? 'Bachelor AIS' : 'BTS SIO SISR';
  const FormIcon = formation === 'bachelor-ais' ? Shield : GraduationCap;
  const formColor = formation === 'bachelor-ais' ? 'text-violet-400' : 'text-cyan-400';

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const headers = getAuthHeaders();
        const [statsRes, chartsRes, exRes, subRes] = await Promise.all([
          axios.get(`${API}/stats/student`, { headers }),
          axios.get(`${API}/stats/student-charts`, { headers }),
          axios.get(`${API}/exercises?formation=${formation}`, { headers }),
          axios.get(`${API}/submissions`, { headers }),
        ]);
        setStats(statsRes.data);
        setCharts(chartsRes.data);
        setExercises(exRes.data);
        setSubmissions(subRes.data);
      } catch (err) { console.error(err); }
      setLoading(false);
    };
    fetchAll();
  }, [API, getAuthHeaders, formation]);

  if (loading) return <div className="text-gray-500 dark:text-zinc-500 text-center py-20">Chargement...</div>;

  const completedIds = new Set(submissions.map(s => s.exercise_id));
  const availableExercises = exercises.filter(e => !completedIds.has(e.id));

  const radarData = charts?.radar || [];
  const progressData = charts?.progress || [];

  return (
    <div className="space-y-8" data-testid="etudiant-dashboard">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FormIcon className={`w-5 h-5 ${formColor}`} />
          <Badge className={formation === 'bachelor-ais' ? 'bg-violet-500/20 text-violet-400 border-violet-500/30' : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'}>
            {formationLabel}
          </Badge>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
          Bienvenue, <span className="text-gradient">{user?.full_name}</span>
        </h1>
        <p className="text-gray-500 dark:text-zinc-500 mt-1">Votre progression sur AI2Lean</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-mono text-gray-500 dark:text-zinc-500 uppercase">Completes</p>
                <p className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>
                  {stats?.completed_exercises || 0}<span className="text-gray-400 dark:text-zinc-600 text-lg">/{stats?.total_exercises || 0}</span>
                </p>
              </div>
            </div>
            <Progress value={stats?.total_exercises ? ((stats?.completed_exercises || 0) / stats.total_exercises) * 100 : 0} className="mt-3 h-1.5 bg-gray-200 dark:bg-zinc-800 [&>div]:bg-emerald-500" />
          </CardContent>
        </Card>
        <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-xs font-mono text-gray-500 dark:text-zinc-500 uppercase">Score moyen</p>
                <p className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>{stats?.avg_score || 0}%</p>
              </div>
            </div>
            <Progress value={stats?.avg_score || 0} className="mt-3 h-1.5 bg-gray-200 dark:bg-zinc-800 [&>div]:bg-cyan-500" />
          </CardContent>
        </Card>
        <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-xs font-mono text-gray-500 dark:text-zinc-500 uppercase">Disponibles</p>
                <p className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>{availableExercises.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts: Progress over time + Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: 'Space Grotesk' }}>
              <TrendingUp className="w-4 h-4 text-cyan-400" /> Evolution des notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {progressData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={progressData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis domain={[0, 20]} tick={{ fill: '#71717a', fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={10} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: "Moyenne", fill: '#f59e0b', fontSize: 10, position: 'right' }} />
                  <Line type="monotone" dataKey="score" name="Note /20" stroke="#06b6d4" strokeWidth={2} dot={{ fill: '#06b6d4', r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 dark:text-zinc-500 text-sm text-center py-10">Completez des exercices pour voir votre progression</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: 'Space Grotesk' }}>
              <BarChart3 className="w-4 h-4 text-violet-400" /> Performance par categorie
            </CardTitle>
          </CardHeader>
          <CardContent>
            {radarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="#27272a" />
                  <PolarAngleAxis dataKey="category" tick={{ fill: '#a1a1aa', fontSize: 9 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#52525b', fontSize: 8 }} />
                  <Radar name="Score (%)" dataKey="score" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 dark:text-zinc-500 text-sm text-center py-10">Pas encore de donnees par categorie</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: 'Space Grotesk' }}>
              <BookOpen className="w-4 h-4 text-cyan-400" /> Exercices disponibles
            </CardTitle>
            <Button variant="ghost" className="text-gray-500 dark:text-zinc-400 hover:text-cyan-400 text-xs" onClick={() => navigate('/exercises')}>
              Voir tout <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {availableExercises.length ? (
            <div className="space-y-2">
              {availableExercises.slice(0, 5).map((ex) => (
                <div key={ex.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-zinc-800/30 border border-gray-200 dark:border-zinc-800/50 hover:border-cyan-500/30 transition-all cursor-pointer group"
                  onClick={() => navigate(`/exercises/${ex.id}`)} data-testid={`available-exercise-${ex.id}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 dark:text-zinc-200 group-hover:text-cyan-400 transition-colors">{ex.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className="bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border-gray-300 dark:border-zinc-700 text-[10px]">{ex.category}</Badge>
                      <span className="text-xs text-gray-500 dark:text-zinc-500">{ex.questions?.length} Q</span>
                      {ex.time_limit > 0 && <span className="text-xs text-gray-500 dark:text-zinc-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {ex.time_limit} min</span>}
                    </div>
                  </div>
                  <Button size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs ml-3">Commencer</Button>
                </div>
              ))}
            </div>
          ) : <p className="text-gray-500 dark:text-zinc-500 text-sm py-4 text-center">Tous les exercices ont ete completes !</p>}
        </CardContent>
      </Card>

      <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: 'Space Grotesk' }}>
            <BarChart3 className="w-4 h-4 text-cyan-400" /> Resultats recents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {submissions.length ? (
            <div className="space-y-2">
              {submissions.slice(0, 5).map((sub) => (
                <div key={sub.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-zinc-800/30 border border-gray-200 dark:border-zinc-800/50 hover:border-gray-300 dark:border-zinc-700 transition-colors cursor-pointer"
                  onClick={() => navigate(`/results/${sub.id}`)} data-testid={`result-${sub.id}`}>
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-zinc-200">{sub.exercise_title}</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-500">{new Date(sub.submitted_at).toLocaleDateString('fr-FR')}</p>
                  </div>
                  {sub.graded ? (
                    <div className="text-right">
                      <p className="text-lg font-bold" style={{ fontFamily: 'Space Grotesk', color: (sub.score / Math.max(sub.max_score, 1)) * 100 >= 50 ? '#10b981' : '#f43f5e' }}>
                        {sub.score_20 != null ? sub.score_20 : Math.round((sub.score / Math.max(sub.max_score, 1)) * 200) / 10}/20
                      </p>
                      <p className="text-xs text-gray-500 dark:text-zinc-500">{sub.score}/{sub.max_score} pts</p>
                    </div>
                  ) : <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">En attente</Badge>}
                </div>
              ))}
            </div>
          ) : <p className="text-gray-500 dark:text-zinc-500 text-sm py-4 text-center">Aucun resultat</p>}
        </CardContent>
      </Card>
    </div>
  );
}
