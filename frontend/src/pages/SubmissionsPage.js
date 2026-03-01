import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ClipboardList, Clock, CheckCircle2, Cpu } from 'lucide-react';
import { toast } from 'sonner';

export default function SubmissionsPage() {
  const { getAuthHeaders, API } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    try {
      const res = await axios.get(`${API}/submissions`, { headers: getAuthHeaders() });
      setSubmissions(res.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const triggerGrading = async (submissionId) => {
    try {
      toast.info('Correction IA en cours...');
      await axios.post(`${API}/grade/${submissionId}`, {}, { headers: getAuthHeaders() });
      toast.success('Correction terminee');
      fetchSubmissions();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  if (loading) return <div className="text-zinc-500 text-center py-20">Chargement...</div>;

  return (
    <div className="space-y-6" data-testid="submissions-page">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
          <span className="text-gradient">Soumissions</span>
        </h1>
        <p className="text-zinc-500 mt-1">{submissions.length} soumission{submissions.length !== 1 ? 's' : ''}</p>
      </div>

      <Card className="bg-zinc-900/50 backdrop-blur-md border-zinc-800">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-500 text-xs font-mono uppercase">Etudiant</TableHead>
                <TableHead className="text-zinc-500 text-xs font-mono uppercase">Exercice</TableHead>
                <TableHead className="text-zinc-500 text-xs font-mono uppercase">Date</TableHead>
                <TableHead className="text-zinc-500 text-xs font-mono uppercase">Score</TableHead>
                <TableHead className="text-zinc-500 text-xs font-mono uppercase">Statut</TableHead>
                <TableHead className="text-zinc-500 text-xs font-mono uppercase text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((sub) => (
                <TableRow key={sub.id} className="border-zinc-800 hover:bg-zinc-800/30" data-testid={`submission-row-${sub.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-xs text-emerald-400">
                        {sub.student_name?.charAt(0)}
                      </div>
                      <span className="text-sm text-zinc-200">{sub.student_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-zinc-300">{sub.exercise_title}</TableCell>
                  <TableCell className="text-sm text-zinc-400">
                    {new Date(sub.submitted_at).toLocaleDateString('fr-FR')}
                  </TableCell>
                  <TableCell>
                    {sub.graded ? (
                      <span className="text-sm font-bold" style={{
                        color: (sub.score / Math.max(sub.max_score, 1)) * 100 >= 50 ? '#10b981' : '#f43f5e'
                      }}>
                        {sub.score}/{sub.max_score}
                      </span>
                    ) : (
                      <span className="text-sm text-zinc-500">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={sub.graded ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}>
                      {sub.graded ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Corrige</> : <><Clock className="w-3 h-3 mr-1" /> En attente</>}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {!sub.graded && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 h-7"
                        onClick={() => triggerGrading(sub.id)}
                        data-testid={`grade-btn-${sub.id}`}
                      >
                        <Cpu className="w-3 h-3 mr-1" /> Corriger IA
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {submissions.length === 0 && (
        <div className="text-center py-16">
          <ClipboardList className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500">Aucune soumission pour le moment</p>
        </div>
      )}
    </div>
  );
}
