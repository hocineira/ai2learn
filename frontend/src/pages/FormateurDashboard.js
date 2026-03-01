import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { BookOpen, Users, TrendingUp, PlusCircle, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function FormateurDashboard() {
  const { getAuthHeaders, API } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [tracking, setTracking] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const headers = getAuthHeaders();
        const [statsRes, exRes, trackRes] = await Promise.all([
          axios.get(`${API}/stats/overview`, { headers }),
          axios.get(`${API}/exercises`, { headers }),
          axios.get(`${API}/stats/students-tracking`, { headers }),
        ]);
        setStats(statsRes.data);
        setExercises(exRes.data);
        setTracking(trackRes.data);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    fetchAll();
  }, [API, getAuthHeaders]);

  if (loading) return <div className="text-zinc-500 text-center py-20">Chargement...</div>;

  return (
    <div className="space-y-8" data-testid="formateur-dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
            Tableau de bord <span className="text-gradient">Formateur</span>
          </h1>
          <p className="text-zinc-500 mt-1">Gerez vos exercices et suivez vos etudiants</p>
        </div>
        <Button
          data-testid="create-exercise-btn"
          onClick={() => navigate('/exercises/create')}
          className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]"
        >
          <PlusCircle className="w-4 h-4 mr-2" /> Nouvel exercice
        </Button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-zinc-900/50 backdrop-blur-md border-zinc-800">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-xs font-mono text-zinc-500 uppercase">Exercices</p>
              <p className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>{exercises.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 backdrop-blur-md border-zinc-800">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-mono text-zinc-500 uppercase">Etudiants</p>
              <p className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>{tracking.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 backdrop-blur-md border-zinc-800">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-xs font-mono text-zinc-500 uppercase">Score moyen</p>
              <p className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>{stats?.avg_score || 0}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Students tracking */}
      <Card className="bg-zinc-900/50 backdrop-blur-md border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: 'Space Grotesk' }}>
            <Users className="w-4 h-4 text-cyan-400" /> Suivi des etudiants en temps reel
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tracking.length ? (
            <div className="space-y-3">
              {tracking.slice(0, 5).map((student) => (
                <div key={student.id} className="flex items-center gap-4 p-3 rounded-lg bg-zinc-800/30 border border-zinc-800/50 hover:border-zinc-700 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-sm font-medium text-emerald-400">
                    {student.full_name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200">{student.full_name}</p>
                    <p className="text-xs text-zinc-500">@{student.username}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-zinc-200">{student.exercises_completed} exerc.</p>
                    <p className="text-xs text-zinc-500">Score: {student.avg_score}%</p>
                  </div>
                  <div className="w-20">
                    <Progress value={student.avg_score} className="h-1.5 bg-zinc-800 [&>div]:bg-emerald-500" />
                  </div>
                </div>
              ))}
              {tracking.length > 5 && (
                <Button variant="ghost" className="w-full text-zinc-400 hover:text-cyan-400" onClick={() => navigate('/tracking')}>
                  Voir tous les etudiants ({tracking.length})
                </Button>
              )}
            </div>
          ) : (
            <p className="text-zinc-500 text-sm py-4 text-center">Aucun etudiant inscrit</p>
          )}
        </CardContent>
      </Card>

      {/* Recent exercises */}
      <Card className="bg-zinc-900/50 backdrop-blur-md border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: 'Space Grotesk' }}>
            <BookOpen className="w-4 h-4 text-cyan-400" /> Mes exercices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {exercises.slice(0, 5).map((ex) => (
              <div
                key={ex.id}
                className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/30 border border-zinc-800/50 hover:border-cyan-500/30 transition-all cursor-pointer group"
                onClick={() => navigate(`/exercises/${ex.id}`)}
                data-testid={`exercise-card-${ex.id}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-200 group-hover:text-cyan-400 transition-colors truncate">{ex.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700 text-[10px]">{ex.category}</Badge>
                    <span className="text-xs text-zinc-500">{ex.questions?.length || 0} questions</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Badge className={ex.submission_count > 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}>
                    {ex.submission_count} soumission{ex.submission_count !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
