import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Monitor, Play, Square, ExternalLink, ArrowLeft, Loader2, AlertCircle, CheckCircle2, Clock, Send, Cpu } from 'lucide-react';
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
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
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

      const s = labRes.data?.status;
      if (s === 'cloning' || s === 'starting' || (s === 'running' && labRes.data?.vm_ip === 'en-attente')) {
        startPolling();
      }

      // Check if already submitted
      try {
        const subRes = await axios.get(`${API}/submissions`, { headers });
        const existing = (subRes.data || []).find(sub => sub.exercise_id === exerciseId);
        if (existing) setSubmitted(existing);
      } catch {}
    } catch (err) {
      toast.error('Exercice non trouve');
      navigate('/labs');
    }
    setLoading(false);
  };

  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/labs/status/${exerciseId}`, { headers: getAuthHeaders() });
        setLab(res.data);
        // Stop polling when lab is fully ready (running + has IP) or errored
        if (res.data?.status === 'error' || (res.data?.status === 'running' && res.data?.vm_ip && res.data.vm_ip !== 'en-attente')) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          if (res.data?.status === 'running') {
            toast.success('Lab pret ! Vous pouvez acceder a la VM.');
          }
        }
      } catch {
        // ignore
      }
    }, 5000);
  };

  const handleStart = async () => {
    setStarting(true);
    try {
      const res = await axios.post(`${API}/labs/start`, { exercise_id: exerciseId }, { headers: getAuthHeaders() });
      setLab(res.data);
      toast.success('Provisionnement lance !');
      // Always start polling after launch
      startPolling();
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

  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmitLab = async () => {
    if (!exercise?.questions?.length) return;
    
    const unanswered = exercise.questions.filter(q => !answers[q.id]?.trim());
    if (unanswered.length > 0) {
      toast.error(`Repondez a toutes les questions (${unanswered.length} manquante${unanswered.length > 1 ? 's' : ''})`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        exercise_id: exerciseId,
        answers: exercise.questions.map(q => ({
          question_id: q.id,
          answer: answers[q.id] || '',
        })),
      };
      const res = await axios.post(`${API}/submissions`, payload, { headers: getAuthHeaders() });
      setSubmitted(res.data);
      toast.success('Lab soumis ! Correction IA en cours...');
      
      // Trigger AI grading
      try {
        await axios.post(`${API}/grade/${res.data.id}`, {}, { headers: getAuthHeaders() });
        // Refresh submission
        const updatedSub = await axios.get(`${API}/submissions/${res.data.id}`, { headers: getAuthHeaders() });
        setSubmitted(updatedSub.data);
        toast.success('Correction terminee !');
      } catch {
        toast.info('Correction IA en attente - un formateur la validera.');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de la soumission');
    }
    setSubmitting(false);
  };

  const openGuacamole = async () => {
    try {
      const res = await axios.get(`${API}/labs/guac-url/${exerciseId}`, { headers: getAuthHeaders() });
      window.open(res.data.url, '_blank');
    } catch {
      // Fallback: use stored URL
      if (lab?.guac_url) window.open(lab.guac_url, '_blank');
    }
  };

  const isRunning = lab?.status === 'running';
  const isCloning = lab?.status === 'cloning';
  const isStarting = lab?.status === 'starting';
  const isProvisioning = isCloning || isStarting;
  const isError = lab?.status === 'error';
  const hasIP = isRunning && lab?.vm_ip && lab.vm_ip !== 'en-attente' && lab.vm_ip !== 'no-agent';
  const hasNoAgent = isRunning && lab?.vm_ip === 'no-agent';
  const hasGuacUrl = isRunning && lab?.guac_url;
  const hasAccess = hasIP || hasNoAgent; // Can access via RDP or noVNC

  // Auto-poll when provisioning
  useEffect(() => {
    if (isProvisioning || (isRunning && !hasIP)) {
      if (!pollRef.current) startPolling();
    }
  }, [lab?.status, hasIP]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="text-gray-500 dark:text-zinc-500 text-center py-20">Chargement...</div>;
  if (!exercise) return null;

  return (
    <div className="space-y-6 max-w-4xl" data-testid="lab-page">
      <Button variant="ghost" className="text-gray-500 dark:text-zinc-400 hover:text-cyan-400 -ml-3" onClick={() => navigate('/labs')}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Retour aux labs
      </Button>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
            <Monitor className="w-3 h-3 mr-1" /> Lab pratique
          </Badge>
          {exercise.time_limit > 0 && (
            <Badge className="bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border-gray-300 dark:border-zinc-700">
              <Clock className="w-3 h-3 mr-1" /> {exercise.time_limit} min
            </Badge>
          )}
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
          {exercise.title}
        </h1>
        <p className="text-gray-500 dark:text-zinc-500 mt-1">{exercise.description}</p>
      </div>

      {/* Instructions */}
      {exercise.lab_instructions && (
        <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-cyan-400" style={{ fontFamily: 'Space Grotesk' }}>
              <AlertCircle className="w-4 h-4" /> Consignes du lab
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap" data-testid="lab-instructions">
              {exercise.lab_instructions}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lab Status */}
      <Card className={`bg-white dark:bg-zinc-900/50 backdrop-blur-md ${isRunning && hasIP ? 'border-emerald-500/30' : isProvisioning ? 'border-cyan-500/30' : isError ? 'border-red-500/30' : 'border-gray-200 dark:border-zinc-800'}`}>
        <CardContent className="p-6">

          {/* Error state */}
          {isError && (
            <div className="text-center py-8" data-testid="lab-error">
              <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-red-400 mb-2" style={{ fontFamily: 'Space Grotesk' }}>
                Erreur de provisionnement
              </h3>
              <p className="text-sm text-gray-500 dark:text-zinc-500 mb-6">
                {lab?.vm_ip || 'Une erreur est survenue. Veuillez reessayer.'}
              </p>
              <Button
                onClick={handleStart}
                disabled={starting}
                className="bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white px-8 py-3"
              >
                <Play className="w-5 h-5 mr-2" /> Reessayer
              </Button>
            </div>
          )}

          {/* Not started */}
          {!isRunning && !isProvisioning && !isError && (
            <div className="text-center py-8" data-testid="lab-not-started">
              <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 flex items-center justify-center mx-auto mb-4">
                <Monitor className="w-8 h-8 text-gray-500 dark:text-zinc-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-zinc-200 mb-2" style={{ fontFamily: 'Space Grotesk' }}>
                Lab non demarre
              </h3>
              <p className="text-sm text-gray-500 dark:text-zinc-500 mb-6 max-w-md mx-auto">
                Cliquez sur le bouton ci-dessous pour provisionner une machine virtuelle Windows Server dediee. Cela prend environ 2 a 4 minutes.
              </p>
              <Button
                data-testid="start-lab-btn"
                onClick={handleStart}
                disabled={starting}
                className="bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white px-8 py-3 text-base shadow-[0_0_20px_rgba(6,182,212,0.2)]"
              >
                {starting ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Lancement...</>
                ) : (
                  <><Play className="w-5 h-5 mr-2" /> Demarrer le Lab</>
                )}
              </Button>
            </div>
          )}

          {/* Cloning / Starting */}
          {isProvisioning && (
            <div className="text-center py-8" data-testid="lab-provisioning">
              <Loader2 className="w-14 h-14 text-cyan-400 mx-auto mb-4 animate-spin" />
              <h3 className="text-lg font-semibold text-gray-800 dark:text-zinc-200 mb-2" style={{ fontFamily: 'Space Grotesk' }}>
                {isCloning ? 'Clonage de la VM en cours...' : 'Demarrage de la VM...'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-zinc-500 mb-4">
                {isCloning
                  ? 'Les fichiers de la machine virtuelle sont en cours de copie. Veuillez patienter (1-3 min).'
                  : 'La VM demarre et configure le reseau. Encore quelques instants...'}
              </p>
              <div className="flex items-center justify-center gap-6 text-xs text-gray-500 dark:text-zinc-500">
                <span>VM ID : {lab?.vmid}</span>
                <span>Nom : {lab?.vm_name}</span>
                <Badge className={isCloning ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]' : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[10px]'}>
                  {isCloning ? 'Clonage' : 'Demarrage'}
                </Badge>
              </div>
              {/* Progress steps */}
              <div className="mt-6 flex items-center justify-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isCloning ? 'bg-cyan-500 animate-pulse' : 'bg-emerald-500'}`} />
                <div className="w-16 h-0.5 bg-zinc-700"><div className={`h-full ${isCloning ? 'bg-cyan-500 w-1/2' : 'bg-emerald-500 w-full'} transition-all duration-1000`} /></div>
                <div className={`w-3 h-3 rounded-full ${isStarting ? 'bg-cyan-500 animate-pulse' : 'bg-zinc-700'}`} />
                <div className="w-16 h-0.5 bg-zinc-700" />
                <div className="w-3 h-3 rounded-full bg-zinc-700" />
              </div>
              <div className="mt-2 flex items-center justify-center gap-8 text-[10px] text-gray-400 dark:text-zinc-600">
                <span>Clone</span>
                <span>Boot</span>
                <span>Pret</span>
              </div>
            </div>
          )}

          {/* Running but waiting for IP */}
          {isRunning && !hasAccess && (
            <div className="text-center py-8" data-testid="lab-starting">
              <Loader2 className="w-12 h-12 text-cyan-400 mx-auto mb-4 animate-spin" />
              <h3 className="text-lg font-semibold text-gray-800 dark:text-zinc-200 mb-2" style={{ fontFamily: 'Space Grotesk' }}>
                En attente de l'adresse IP...
              </h3>
              <p className="text-sm text-gray-500 dark:text-zinc-500">
                La VM est demarree, le reseau se configure. Encore quelques secondes.
              </p>
              <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-500 dark:text-zinc-500">
                <span>VM ID : {lab.vmid}</span>
                <span>Nom : {lab.vm_name}</span>
              </div>
            </div>
          )}

          {isRunning && hasAccess && (
            <div data-testid="lab-running">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-lg font-semibold text-emerald-400" style={{ fontFamily: 'Space Grotesk' }}>
                  Lab en cours
                </h3>
                {hasNoAgent && (
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">Console noVNC</Badge>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="bg-gray-100 dark:bg-zinc-800/50 rounded-lg p-3">
                  <p className="text-[10px] font-mono text-gray-500 dark:text-zinc-500 uppercase">VM ID</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-zinc-200">{lab.vmid}</p>
                </div>
                <div className="bg-gray-100 dark:bg-zinc-800/50 rounded-lg p-3">
                  <p className="text-[10px] font-mono text-gray-500 dark:text-zinc-500 uppercase">IP</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-zinc-200">{hasIP ? lab.vm_ip : 'Console directe'}</p>
                </div>
                <div className="bg-gray-100 dark:bg-zinc-800/50 rounded-lg p-3">
                  <p className="text-[10px] font-mono text-gray-500 dark:text-zinc-500 uppercase">Nom</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-zinc-200 truncate">{lab.vm_name}</p>
                </div>
                <div className="bg-gray-100 dark:bg-zinc-800/50 rounded-lg p-3">
                  <p className="text-[10px] font-mono text-gray-500 dark:text-zinc-500 uppercase">Demarre</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-zinc-200">
                    {lab.started_at ? new Date(lab.started_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </p>
                </div>
              </div>

              {hasNoAgent && (
                <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400">
                  <AlertCircle className="w-4 h-4 inline mr-2" />
                  Le QEMU Guest Agent n'est pas installe sur cette VM. L'acces se fait via la console noVNC de Proxmox.
                  Pour le RDP automatique, installez le <a href="https://pve.proxmox.com/wiki/Qemu-guest-agent" target="_blank" rel="noreferrer" className="underline">QEMU Guest Agent</a> sur le template.
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                {hasGuacUrl && (
                  <Button
                    data-testid="access-lab-btn"
                    onClick={openGuacamole}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 text-base"
                  >
                    <ExternalLink className="w-5 h-5 mr-2" /> {hasNoAgent ? 'Acceder a la console (noVNC)' : 'Acceder au Bureau (Guacamole)'}
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

      {/* Questions & Soumission */}
      {exercise.questions?.length > 0 && (
        <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2" style={{ fontFamily: 'Space Grotesk' }}>
              <CheckCircle2 className="w-4 h-4 text-cyan-400" /> Validation du Lab ({exercise.questions.length} question{exercise.questions.length > 1 ? 's' : ''})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {submitted ? (
              /* Already submitted - show results */
              <div data-testid="lab-results">
                <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-sm font-medium text-emerald-400">Lab soumis !</p>
                    {submitted.graded && (
                      <p className="text-lg font-bold text-gray-800 dark:text-zinc-200" style={{ fontFamily: 'Space Grotesk' }}>
                        Score : {submitted.score_20 != null ? submitted.score_20 : Math.round((submitted.score / Math.max(submitted.max_score, 1)) * 200) / 10}/20
                        <span className="text-sm text-gray-500 dark:text-zinc-500 ml-2">({submitted.score}/{submitted.max_score} pts)</span>
                      </p>
                    )}
                    {!submitted.graded && <p className="text-xs text-gray-500 dark:text-zinc-500">En attente de correction...</p>}
                  </div>
                </div>
                {submitted.ai_feedback && (
                  <div className="mb-4 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <Cpu className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-medium text-cyan-400">Feedback IA</span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-zinc-300">{submitted.ai_feedback}</p>
                  </div>
                )}
                {submitted.vm_validation && submitted.vm_validation.length > 0 && (
                  <div className="mb-4 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Monitor className="w-4 h-4 text-violet-400" />
                      <span className="text-xs font-medium text-violet-400">Validation VM (PowerShell)</span>
                    </div>
                    <div className="space-y-1.5">
                      {submitted.vm_validation.map((v, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          {v.passed
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                            : <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                          }
                          <span className={v.passed ? 'text-emerald-400' : 'text-red-400'}>{v.name}</span>
                          <span className="text-gray-400 dark:text-zinc-600 ml-auto font-mono truncate max-w-[200px]">{v.actual}</span>
                        </div>
                      ))}
                    </div>
                    {submitted.vm_validation_summary && (
                      <p className="text-xs text-violet-400/80 mt-2 pt-2 border-t border-violet-500/20">{submitted.vm_validation_summary}</p>
                    )}
                  </div>
                )}
                <div className="space-y-3">
                  {submitted.answers?.map((a, i) => (
                    <div key={i} className="p-3 rounded-lg bg-gray-50 dark:bg-zinc-800/30 border border-gray-200 dark:border-zinc-800/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono text-gray-500 dark:text-zinc-500">Q{i + 1}</span>
                        <span className={`text-sm font-bold ${(a.points_earned || 0) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {a.points_earned || 0} pts
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-zinc-300 mb-1">{exercise.questions[i]?.question_text}</p>
                      <p className="text-xs text-gray-500 dark:text-zinc-400 italic">Votre reponse : {a.answer}</p>
                      {a.ai_feedback && (
                        <p className="text-xs text-cyan-400/80 mt-1"><Cpu className="w-3 h-3 inline mr-1" />{a.ai_feedback}</p>
                      )}
                    </div>
                  ))}
                </div>
                <Button className="mt-4 w-full bg-gray-200 dark:bg-gray-200 dark:bg-zinc-800 hover:bg-gray-300 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300" onClick={() => navigate(`/results/${submitted.id}`)}>
                  Voir le detail du resultat
                </Button>
              </div>
            ) : (
              /* Answer form */
              <div data-testid="lab-questions-form">
                <p className="text-xs text-gray-500 dark:text-zinc-500 mb-4">
                  Repondez aux questions ci-dessous pour valider votre lab. La correction IA sera lancee automatiquement.
                </p>
                <div className="space-y-4">
                  {exercise.questions.map((q, i) => (
                    <div key={q.id} className="p-4 rounded-lg bg-gray-50 dark:bg-zinc-800/30 border border-gray-200 dark:border-zinc-800/50">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-mono text-gray-500 dark:text-zinc-500">Q{i + 1}</span>
                        <Badge className={q.question_type === 'qcm' ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30 text-[10px]' : 'bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]'}>
                          {q.question_type === 'qcm' ? 'QCM' : 'Ouverte'}
                        </Badge>
                        <span className="text-xs text-gray-500 dark:text-zinc-500 ml-auto">{q.points} pts</span>
                      </div>
                      <p className="text-sm text-gray-800 dark:text-zinc-200 mb-3">{q.question_text}</p>

                      {q.question_type === 'qcm' ? (
                        <div className="space-y-2">
                          {q.options?.map((opt, oi) => (
                            <label key={oi} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${answers[q.id] === opt ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300' : 'bg-zinc-900/30 border-gray-300 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:border-zinc-600'}`}>
                              <input
                                type="radio"
                                name={`q-${q.id}`}
                                value={opt}
                                checked={answers[q.id] === opt}
                                onChange={() => handleAnswerChange(q.id, opt)}
                                className="hidden"
                              />
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${answers[q.id] === opt ? 'border-cyan-400' : 'border-zinc-600'}`}>
                                {answers[q.id] === opt && <div className="w-2 h-2 rounded-full bg-cyan-400" />}
                              </div>
                              <span className="text-sm">{opt}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <textarea
                          className="w-full bg-white dark:bg-zinc-900/50 border border-gray-300 dark:border-zinc-700 rounded-lg p-3 text-sm text-gray-800 dark:text-zinc-200 placeholder:text-gray-400 dark:text-zinc-600 focus:border-cyan-500/50 focus:outline-none resize-none"
                          rows={3}
                          placeholder="Votre reponse..."
                          value={answers[q.id] || ''}
                          onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                        />
                      )}
                    </div>
                  ))}
                </div>

                <Button
                  data-testid="submit-lab-btn"
                  onClick={handleSubmitLab}
                  disabled={submitting}
                  className="mt-6 w-full bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white py-3 text-base"
                >
                  {submitting ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Soumission et correction IA...</>
                  ) : (
                    <><Send className="w-5 h-5 mr-2" /> Soumettre le Lab</>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
