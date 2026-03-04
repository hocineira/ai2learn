import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Monitor, Play, Square, ExternalLink, ArrowLeft, Loader2, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function LabPage() {
  const { exerciseId } = useParams();
  const { getAuthHeaders, API, user } = useAuth();
  const navigate = useNavigate();
  const [exercise, setExercise] = useState(null);
  const [lab, setLab] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    fetchData();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [exerciseId]);

  const fetchData = async () => {
    try {
      const headers = getAuthHeaders();
      const [exRes, labRes] = await Promise.all([
        axios.get(`${API}/exercises/${exerciseId}`, { headers }),
        axios.get(`${API}/labs/status/${exerciseId}`, { headers }),
      ]);
      setExercise(exRes.data);
      setLab(labRes.data);

      if (labRes.data?.status === 'running' && labRes.data?.vm_ip === 'en-attente') {
        startPolling();
      }
    } catch (err) {
      toast.error('Exercice non trouve');
      navigate('/exercises');
    }
    setLoading(false);
  };

  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/labs/status/${exerciseId}`, { headers: getAuthHeaders() });
        setLab(res.data);
        if (res.data?.vm_ip && res.data.vm_ip !== 'en-attente') {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch {
        // ignore
      }
    }, 8000);
  };

  const handleStart = async () => {
    setStarting(true);
    try {
      const res = await axios.post(`${API}/labs/start`, { exercise_id: exerciseId }, { headers: getAuthHeaders() });
      setLab(res.data);
      toast.success('Lab en cours de demarrage...');
      if (res.data?.vm_ip === 'en-attente') {
        startPolling();
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors du demarrage du lab');
    }
    setStarting(false);
  };

  const handleStop = async () => {
    if (!window.confirm('Arreter le lab ? La VM sera supprimee.')) return;
    setStopping(true);
    try {
      await axios.post(`${API}/labs/stop/${exerciseId}`, {}, { headers: getAuthHeaders() });
      setLab({ status: 'not_started' });
      toast.success('Lab arrete');
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
    setStopping(false);
  };

  if (loading) return <div className="text-zinc-500 text-center py-20">Chargement...</div>;
  if (!exercise) return null;

  const isRunning = lab?.status === 'running';
  const hasIP = isRunning && lab?.vm_ip && lab.vm_ip !== 'en-attente';
  const hasGuacUrl = isRunning && lab?.guac_url;

  return (
    <div className="space-y-6 max-w-4xl" data-testid="lab-page">
      <Button variant="ghost" className="text-zinc-400 hover:text-cyan-400 -ml-3" onClick={() => navigate('/exercises')}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Retour aux exercices
      </Button>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
            <Monitor className="w-3 h-3 mr-1" /> Lab pratique
          </Badge>
          {exercise.time_limit > 0 && (
            <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700">
              <Clock className="w-3 h-3 mr-1" /> {exercise.time_limit} min
            </Badge>
          )}
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
          {exercise.title}
        </h1>
        <p className="text-zinc-500 mt-1">{exercise.description}</p>
      </div>

      {/* Instructions */}
      {exercise.lab_instructions && (
        <Card className="bg-zinc-900/50 backdrop-blur-md border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-cyan-400" style={{ fontFamily: 'Space Grotesk' }}>
              <AlertCircle className="w-4 h-4" /> Consignes du lab
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap" data-testid="lab-instructions">
              {exercise.lab_instructions}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lab Status */}
      <Card className={`bg-zinc-900/50 backdrop-blur-md ${isRunning ? 'border-emerald-500/30' : 'border-zinc-800'}`}>
        <CardContent className="p-6">
          {!isRunning && lab?.status !== 'running' && (
            <div className="text-center py-8" data-testid="lab-not-started">
              <div className="w-16 h-16 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto mb-4">
                <Monitor className="w-8 h-8 text-zinc-500" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-200 mb-2" style={{ fontFamily: 'Space Grotesk' }}>
                Lab non demarre
              </h3>
              <p className="text-sm text-zinc-500 mb-6 max-w-md mx-auto">
                Cliquez sur le bouton ci-dessous pour provisionner une machine virtuelle Windows Server dediee. Cela prend environ 1 a 3 minutes.
              </p>
              <Button
                data-testid="start-lab-btn"
                onClick={handleStart}
                disabled={starting}
                className="bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white px-8 py-3 text-base shadow-[0_0_20px_rgba(6,182,212,0.2)]"
              >
                {starting ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Provisionnement en cours...</>
                ) : (
                  <><Play className="w-5 h-5 mr-2" /> Demarrer le Lab</>
                )}
              </Button>
            </div>
          )}

          {isRunning && !hasIP && (
            <div className="text-center py-8" data-testid="lab-starting">
              <Loader2 className="w-12 h-12 text-cyan-400 mx-auto mb-4 animate-spin" />
              <h3 className="text-lg font-semibold text-zinc-200 mb-2" style={{ fontFamily: 'Space Grotesk' }}>
                VM en cours de demarrage...
              </h3>
              <p className="text-sm text-zinc-500">
                La machine virtuelle est en cours de preparation. Veuillez patienter (1-3 min).
              </p>
              <div className="mt-4 flex items-center justify-center gap-4 text-xs text-zinc-500">
                <span>VM ID : {lab.vmid}</span>
                <span>Nom : {lab.vm_name}</span>
              </div>
            </div>
          )}

          {isRunning && hasIP && (
            <div data-testid="lab-running">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-lg font-semibold text-emerald-400" style={{ fontFamily: 'Space Grotesk' }}>
                  Lab en cours
                </h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase">VM ID</p>
                  <p className="text-sm font-medium text-zinc-200">{lab.vmid}</p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase">IP</p>
                  <p className="text-sm font-medium text-zinc-200">{lab.vm_ip}</p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase">Nom</p>
                  <p className="text-sm font-medium text-zinc-200 truncate">{lab.vm_name}</p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase">Demarre</p>
                  <p className="text-sm font-medium text-zinc-200">
                    {lab.started_at ? new Date(lab.started_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                {hasGuacUrl && (
                  <Button
                    data-testid="access-lab-btn"
                    onClick={() => window.open(lab.guac_url, '_blank')}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 text-base"
                  >
                    <ExternalLink className="w-5 h-5 mr-2" /> Acceder au Bureau (Guacamole)
                  </Button>
                )}
                <Button
                  data-testid="stop-lab-btn"
                  onClick={handleStop}
                  disabled={stopping}
                  variant="outline"
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  {stopping ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Arret en cours...</>
                  ) : (
                    <><Square className="w-4 h-4 mr-2" /> Arreter le Lab</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Questions associated (if any) */}
      {exercise.questions?.length > 0 && (
        <Card className="bg-zinc-900/50 backdrop-blur-md border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2" style={{ fontFamily: 'Space Grotesk' }}>
              <CheckCircle2 className="w-4 h-4 text-cyan-400" /> Questions associees ({exercise.questions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500 mb-3">
              Ces questions seront evaluees une fois le lab termine. Vous pouvez aussi soumettre cet exercice depuis la page exercices.
            </p>
            <div className="space-y-2">
              {exercise.questions.map((q, i) => (
                <div key={q.id} className="flex items-center gap-3 p-2 bg-zinc-800/30 rounded-md">
                  <span className="text-xs font-mono text-zinc-500 w-6">Q{i + 1}</span>
                  <p className="text-sm text-zinc-300 flex-1 truncate">{q.question_text}</p>
                  <Badge className={q.question_type === 'qcm' ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30 text-[10px]' : 'bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]'}>
                    {q.question_type === 'qcm' ? 'QCM' : 'Ouverte'}
                  </Badge>
                  <span className="text-xs text-zinc-500">{q.points}pts</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
