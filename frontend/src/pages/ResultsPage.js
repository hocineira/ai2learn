import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, ArrowLeft, CheckCircle2, XCircle, Clock, Cpu } from 'lucide-react';

export default function ResultsPage() {
  const { id } = useParams();
  const { getAuthHeaders, API, user } = useAuth();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const headers = getAuthHeaders();
        if (id) {
          const res = await axios.get(`${API}/submissions/${id}`, { headers });
          setDetail(res.data);
        } else {
          const res = await axios.get(`${API}/submissions`, { headers });
          setSubmissions(res.data);
        }
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    fetch();
  }, [id, API, getAuthHeaders]);

  if (loading) return <div className="text-zinc-500 text-center py-20">Chargement...</div>;

  // Detail view
  if (detail) {
    return (
      <div className="space-y-6 max-w-3xl" data-testid="result-detail">
        <Button variant="ghost" className="text-zinc-400 hover:text-cyan-400 -ml-3" onClick={() => navigate('/results')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Retour
        </Button>

        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>{detail.exercise_title}</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Soumis le {new Date(detail.submitted_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Score card */}
        <Card className="bg-zinc-900/50 backdrop-blur-md border-zinc-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-mono text-zinc-500 uppercase mb-1">Score total</p>
                <p className="text-4xl font-bold" style={{
                  fontFamily: 'Space Grotesk',
                  color: detail.graded ? ((detail.score / Math.max(detail.max_score, 1)) * 100 >= 50 ? '#10b981' : '#f43f5e') : '#71717a'
                }}>
                  {detail.graded ? `${detail.score}/${detail.max_score}` : 'En attente'}
                </p>
              </div>
              <Badge className={detail.graded ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}>
                {detail.graded ? 'Corrige' : 'En cours'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* AI Feedback */}
        {detail.ai_feedback && (
          <Card className="bg-zinc-900/50 backdrop-blur-md border-cyan-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-cyan-400" style={{ fontFamily: 'Space Grotesk' }}>
                <Cpu className="w-4 h-4" /> Feedback IA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-300 leading-relaxed ai-typing">{detail.ai_feedback}</p>
            </CardContent>
          </Card>
        )}

        {/* Answers detail */}
        <div className="space-y-3">
          {detail.answers?.map((answer, i) => (
            <Card key={i} className="bg-zinc-900/50 backdrop-blur-md border-zinc-800">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs font-mono text-zinc-500">Question {i + 1}</span>
                  <div className="flex items-center gap-2">
                    {answer.correct === true && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    {answer.correct === false && <XCircle className="w-4 h-4 text-red-400" />}
                    <span className="text-xs text-zinc-400">{answer.points_earned || 0} pts</span>
                  </div>
                </div>
                <p className="text-sm text-zinc-300 mb-2">{answer.answer}</p>
                {answer.ai_feedback && (
                  <p className="text-xs text-cyan-400/80 mt-2 border-t border-zinc-800 pt-2">{answer.ai_feedback}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6" data-testid="results-page">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
          Mes <span className="text-gradient">resultats</span>
        </h1>
        <p className="text-zinc-500 mt-1">{submissions.length} soumission{submissions.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="space-y-3">
        {submissions.map((sub, i) => (
          <Card
            key={sub.id}
            className="bg-zinc-900/50 backdrop-blur-md border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer animate-fade-in-up"
            style={{ animationDelay: `${i * 0.03}s` }}
            onClick={() => navigate(`/results/${sub.id}`)}
            data-testid={`submission-row-${sub.id}`}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-zinc-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-200">{sub.exercise_title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-zinc-500">
                      {new Date(sub.submitted_at).toLocaleDateString('fr-FR')}
                    </span>
                    {user?.role !== 'etudiant' && (
                      <span className="text-xs text-zinc-500">par {sub.student_name}</span>
                    )}
                  </div>
                </div>
              </div>
              {sub.graded ? (
                <div className="text-right">
                  <p className="text-lg font-bold" style={{
                    fontFamily: 'Space Grotesk',
                    color: (sub.score / Math.max(sub.max_score, 1)) * 100 >= 50 ? '#10b981' : '#f43f5e'
                  }}>
                    {sub.score}/{sub.max_score}
                  </p>
                  <p className="text-xs text-zinc-500">{Math.round((sub.score / Math.max(sub.max_score, 1)) * 100)}%</p>
                </div>
              ) : (
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                  <Clock className="w-3 h-3 mr-1" /> En attente
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {submissions.length === 0 && (
        <div className="text-center py-16">
          <BarChart3 className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500">Aucun resultat pour le moment</p>
          <Button className="mt-4 bg-cyan-600 hover:bg-cyan-500 text-white" onClick={() => navigate('/exercises')}>
            Commencer un exercice
          </Button>
        </div>
      )}
    </div>
  );
}
