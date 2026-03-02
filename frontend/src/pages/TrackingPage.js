import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, GraduationCap, Shield } from 'lucide-react';

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

  if (loading) return <div className="text-zinc-500 text-center py-20">Chargement...</div>;

  const formationLabel = activeFormation === 'bachelor-ais' ? 'Bachelor AIS' : 'BTS SIO SISR';

  return (
    <div className="space-y-6" data-testid="tracking-page">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
          Suivi <span className="text-gradient">etudiants</span>
        </h1>
        <p className="text-zinc-500 mt-1">{formationLabel} - {tracking.length} etudiant{tracking.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tracking.map((student, i) => {
          const isBachelor = student.formation === 'bachelor-ais';
          return (
            <Card key={student.id} className="bg-zinc-900/50 backdrop-blur-md border-zinc-800 hover:border-emerald-500/30 transition-all animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }} data-testid={`student-card-${student.id}`}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-sm font-medium text-emerald-400">
                    {student.full_name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-200 truncate">{student.full_name}</p>
                    <p className="text-xs text-zinc-500">@{student.username}</p>
                  </div>
                  <Badge className={isBachelor ? 'bg-violet-500/15 text-violet-400 border-violet-500/30 text-[10px]' : 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30 text-[10px]'}>
                    {isBachelor ? <><Shield className="w-3 h-3 mr-1" />AIS</> : <><GraduationCap className="w-3 h-3 mr-1" />SISR</>}
                  </Badge>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Exercices completes</span>
                    <span className="text-sm font-medium text-zinc-200">{student.exercises_completed}</span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-zinc-500">Score moyen</span>
                      <span className="text-sm font-bold" style={{ color: student.avg_score >= 50 ? '#10b981' : student.avg_score > 0 ? '#f59e0b' : '#71717a' }}>{student.avg_score}%</span>
                    </div>
                    <Progress value={student.avg_score} className={`h-1.5 bg-zinc-800 ${student.avg_score >= 50 ? '[&>div]:bg-emerald-500' : '[&>div]:bg-amber-500'}`} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Derniere activite</span>
                    <span className="text-xs text-zinc-400">{student.last_activity ? new Date(student.last_activity).toLocaleDateString('fr-FR') : '-'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {tracking.length === 0 && (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500">Aucun etudiant dans cette formation</p>
        </div>
      )}
    </div>
  );
}
