import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  BookOpen, BarChart3, TrendingUp, CheckCircle2, Clock, ArrowRight, GraduationCap, Shield,
  Flame, Star, Trophy, Zap, Target, Award
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  BarChart, Bar
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
  const [detailedStats, setDetailedStats] = useState(null);
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
        const [statsRes, chartsRes, exRes, subRes, detailedRes] = await Promise.all([
          axios.get(`${API}/stats/student`, { headers }),
          axios.get(`${API}/stats/student-charts`, { headers }),
          axios.get(`${API}/exercises?formation=${formation}`, { headers }),
          axios.get(`${API}/submissions`, { headers }),
          axios.get(`${API}/stats/student-detailed`, { headers }).catch(() => ({ data: null })),
        ]);
        setStats(statsRes.data);
        setCharts(chartsRes.data);
        setExercises(exRes.data);
        setSubmissions(subRes.data);
        setDetailedStats(detailedRes.data);
      } catch (err) { console.error(err); }
      setLoading(false);
    };
    fetchAll();
  }, [API, getAuthHeaders, formation]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center animate-fade-in">
        <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="th-text-muted">Chargement de votre espace...</p>
      </div>
    </div>
  );

  const completedIds = new Set(submissions.map(s => s.exercise_id));
  const availableExercises = exercises.filter(e => !completedIds.has(e.id));
  const radarData = charts?.radar || [];
  const progressData = charts?.progress || [];
  const ds = detailedStats || {};

  // Motivational message based on performance
  const getMotivation = () => {
    if (!ds.avg_score_20) return "Commencez votre aventure d'apprentissage !";
    if (ds.avg_score_20 >= 18) return "Performance exceptionnelle ! Continuez ainsi !";
    if (ds.avg_score_20 >= 15) return "Excellent travail ! Vous etes sur la bonne voie.";
    if (ds.avg_score_20 >= 12) return "Bon travail ! Continuez a progresser.";
    if (ds.avg_score_20 >= 10) return "Pas mal ! Revoyez les points faibles.";
    return "Courage ! Chaque exercice vous fait progresser.";
  };

  return (
    <div className="space-y-6" data-testid="etudiant-dashboard">
      {/* Hero welcome */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-600/10 via-violet-600/5 to-transparent border border-gray-200 dark:border-zinc-800 p-6 md:p-8 animate-fade-in">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FormIcon className={`w-5 h-5 ${formColor}`} />
              <Badge className={formation === 'bachelor-ais' ? 'bg-violet-500/20 text-violet-400 border-violet-500/30' : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'}>
                {formationLabel}
              </Badge>
              {ds.streak > 0 && (
                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 animate-bounce-in">
                  <Flame className="w-3 h-3 mr-1" /> {ds.streak} jour{ds.streak > 1 ? 's' : ''} de suite
                </Badge>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
              Bonjour, <span className="text-gradient">{user?.full_name}</span>
            </h1>
            <p className="th-text-muted mt-1 text-sm">{getMotivation()}</p>
          </div>
          
          {/* Level badge */}
          {ds.level && (
            <div className="flex items-center gap-3 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-zinc-700 p-4 animate-scale-in">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg" style={{ fontFamily: 'Space Grotesk' }}>
                {ds.level}
              </div>
              <div>
                <p className="text-sm font-semibold th-text" style={{ fontFamily: 'Space Grotesk' }}>{ds.level_name}</p>
                <p className="text-xs th-text-muted">{ds.xp} XP</p>
                <div className="w-24 h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full transition-all duration-1000" style={{ width: `${ds.level_progress || 0}%` }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger-children">
        <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none hover-lift">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-[10px] font-mono th-text-muted uppercase">Completes</p>
            </div>
            <p className="text-2xl font-bold animate-count-up" style={{ fontFamily: 'Space Grotesk' }}>
              {stats?.completed_exercises || 0}<span className="text-base th-text-faint">/{stats?.total_exercises || 0}</span>
            </p>
            <Progress value={stats?.total_exercises ? ((stats?.completed_exercises || 0) / stats.total_exercises) * 100 : 0} className="mt-2 h-1 bg-gray-200 dark:bg-zinc-800 [&>div]:bg-emerald-500" />
          </CardContent>
        </Card>

        <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none hover-lift">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
              </div>
              <p className="text-[10px] font-mono th-text-muted uppercase">Moyenne</p>
            </div>
            <p className="text-2xl font-bold animate-count-up" style={{ fontFamily: 'Space Grotesk' }}>
              {ds.avg_score_20 || 0}<span className="text-base th-text-faint">/20</span>
            </p>
            <Progress value={(ds.avg_score_20 || 0) * 5} className="mt-2 h-1 bg-gray-200 dark:bg-zinc-800 [&>div]:bg-cyan-500" />
          </CardContent>
        </Card>

        <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none hover-lift">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Star className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-[10px] font-mono th-text-muted uppercase">Meilleure</p>
            </div>
            <p className="text-2xl font-bold animate-count-up" style={{ fontFamily: 'Space Grotesk' }}>
              {ds.best_score || 0}<span className="text-base th-text-faint">/20</span>
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none hover-lift">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <Zap className="w-4 h-4 text-violet-400" />
              </div>
              <p className="text-[10px] font-mono th-text-muted uppercase">XP Total</p>
            </div>
            <p className="text-2xl font-bold animate-count-up" style={{ fontFamily: 'Space Grotesk' }}>
              {ds.xp || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Badges Section */}
      {ds.badges && ds.badges.length > 0 && (
        <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none animate-fade-in-up">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2" style={{ fontFamily: 'Space Grotesk' }}>
              <Award className="w-4 h-4 text-amber-400" /> Badges obtenus
              <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] ml-1">{ds.badges.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {ds.badges.map((badge) => (
                <div key={badge.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-lg hover-lift" title={badge.desc}>
                  <span className="text-xl">{badge.icon}</span>
                  <div>
                    <p className="text-xs font-medium th-text">{badge.name}</p>
                    <p className="text-[10px] th-text-faint">{badge.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts: Progress + Radar + Score Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none hover-lift">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2" style={{ fontFamily: 'Space Grotesk' }}>
              <TrendingUp className="w-4 h-4 text-cyan-400" /> Evolution des notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {progressData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={progressData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis domain={[0, 20]} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={10} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: "Moyenne", fill: '#f59e0b', fontSize: 10, position: 'right' }} />
                  <Line type="monotone" dataKey="score" name="Note /20" stroke="#06b6d4" strokeWidth={2} dot={{ fill: '#06b6d4', r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="th-text-muted text-sm text-center py-10">Completez des exercices pour voir votre progression</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none hover-lift">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2" style={{ fontFamily: 'Space Grotesk' }}>
              <BarChart3 className="w-4 h-4 text-violet-400" /> Performance par categorie
            </CardTitle>
          </CardHeader>
          <CardContent>
            {radarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="var(--card-border)" />
                  <PolarAngleAxis dataKey="category" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'var(--text-faint)', fontSize: 8 }} />
                  <Radar name="Score (%)" dataKey="score" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <p className="th-text-muted text-sm text-center py-10">Pas encore de donnees par categorie</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Available Exercises & Recent Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2" style={{ fontFamily: 'Space Grotesk' }}>
                <Target className="w-4 h-4 text-cyan-400" /> Exercices disponibles
                {availableExercises.length > 0 && (
                  <Badge className="bg-cyan-500/15 text-cyan-400 border-cyan-500/30 text-[10px]">{availableExercises.length}</Badge>
                )}
              </CardTitle>
              <Button variant="ghost" className="th-text-muted hover:text-cyan-400 text-xs" onClick={() => navigate('/exercises')}>
                Tout <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {availableExercises.length ? (
              <div className="space-y-2">
                {availableExercises.slice(0, 5).map((ex, i) => (
                  <div key={ex.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-zinc-800/30 border border-gray-200 dark:border-zinc-800/50 hover:border-cyan-500/30 transition-all cursor-pointer group hover-lift"
                    onClick={() => navigate(`/exercises/${ex.id}`)} data-testid={`available-exercise-${ex.id}`}
                    style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium th-text group-hover:text-cyan-500 transition-colors truncate">{ex.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className="th-badge text-[10px]">{ex.category}</Badge>
                        <span className="text-xs th-text-faint">{ex.questions?.length} Q</span>
                        {ex.time_limit > 0 && <span className="text-xs th-text-faint flex items-center gap-1"><Clock className="w-3 h-3" /> {ex.time_limit}min</span>}
                      </div>
                    </div>
                    <Button size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs ml-3 flex-shrink-0">Commencer</Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Trophy className="w-10 h-10 text-amber-400 mx-auto mb-2" />
                <p className="text-sm th-text font-medium">Tous completes !</p>
                <p className="text-xs th-text-muted mt-1">Bravo, vous avez termine tous les exercices.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2" style={{ fontFamily: 'Space Grotesk' }}>
              <BarChart3 className="w-4 h-4 text-cyan-400" /> Resultats recents
            </CardTitle>
          </CardHeader>
          <CardContent>
            {submissions.length ? (
              <div className="space-y-2">
                {submissions.slice(0, 5).map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-zinc-800/30 border border-gray-200 dark:border-zinc-800/50 hover:border-gray-300 dark:hover:border-zinc-700 transition-colors cursor-pointer hover-lift"
                    onClick={() => navigate(`/results/${sub.id}`)} data-testid={`result-${sub.id}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium th-text truncate">{sub.exercise_title}</p>
                      <p className="text-xs th-text-faint">{new Date(sub.submitted_at).toLocaleDateString('fr-FR')}</p>
                    </div>
                    {sub.graded ? (
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-bold" style={{ fontFamily: 'Space Grotesk', color: (sub.score / Math.max(sub.max_score, 1)) * 100 >= 50 ? '#10b981' : '#f43f5e' }}>
                          {sub.score_20 != null ? sub.score_20 : Math.round((sub.score / Math.max(sub.max_score, 1)) * 200) / 10}/20
                        </p>
                      </div>
                    ) : <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs flex-shrink-0">En attente</Badge>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <BookOpen className="w-10 h-10 th-text-faint mx-auto mb-2" />
                <p className="text-sm th-text-muted">Aucun resultat pour le moment</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
