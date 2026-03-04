import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Clock, CheckCircle2, ArrowLeft, Send, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

export default function ExerciseTake() {
  const { id } = useParams();
  const { getAuthHeaders, API, user } = useAuth();
  const navigate = useNavigate();
  const [exercise, setExercise] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentQ, setCurrentQ] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    const fetchExercise = async () => {
      try {
        const res = await axios.get(`${API}/exercises/${id}`, { headers: getAuthHeaders() });
        setExercise(res.data);
        if (res.data.time_limit > 0) {
          setTimeLeft(res.data.time_limit * 60);
        }
      } catch (err) {
        toast.error('Exercice non trouve');
        navigate('/exercises');
      }
      setLoading(false);
    };
    fetchExercise();
  }, [id, API, getAuthHeaders, navigate]);

  // Timer
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || submitted) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, submitted]);

  const handleSubmit = useCallback(async () => {
    if (submitting || submitted) return;
    setSubmitting(true);
    try {
      const answersList = Object.entries(answers).map(([qId, answer]) => ({
        question_id: qId,
        answer: answer,
      }));
      const res = await axios.post(`${API}/submissions`, {
        exercise_id: id,
        answers: answersList,
      }, { headers: getAuthHeaders() });
      setResult(res.data);
      setSubmitted(true);
      toast.success('Exercice soumis avec succes !');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de la soumission');
    }
    setSubmitting(false);
  }, [answers, id, API, getAuthHeaders, submitting, submitted]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) return <div className="text-zinc-500 text-center py-20">Chargement...</div>;
  if (!exercise) return null;

  const questions = exercise.questions || [];
  const current = questions[currentQ];
  const progress = (Object.keys(answers).length / questions.length) * 100;

  // Result view
  if (submitted && result) {
    return (
      <div className="space-y-6 max-w-3xl" data-testid="exercise-result">
        <Button variant="ghost" className="text-zinc-400 hover:text-cyan-400" onClick={() => navigate('/results')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Retour aux resultats
        </Button>
        
        <Card className="bg-zinc-900/50 backdrop-blur-md border-zinc-800">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-cyan-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk' }}>Exercice soumis !</h2>
            {result.graded ? (
              <>
                <p className="text-5xl font-bold my-4 text-gradient" style={{ fontFamily: 'Space Grotesk' }}>
                  {result.score_20 != null ? result.score_20 : Math.round((result.score / Math.max(result.max_score, 1)) * 200) / 10}/20
                </p>
                <p className="text-zinc-400">
                  {result.score}/{result.max_score} points ({Math.round((result.score / Math.max(result.max_score, 1)) * 100)}%)
                </p>
                {result.ai_feedback && (
                  <div className="mt-6 text-left bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
                    <p className="text-xs font-mono text-cyan-400 mb-2 uppercase">Feedback IA</p>
                    <p className="text-sm text-zinc-300 ai-typing">{result.ai_feedback}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-zinc-400 mt-2">Votre soumission est en cours de correction par l'IA...</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl" data-testid="exercise-take-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" className="text-zinc-400 hover:text-cyan-400 mb-2 -ml-3" onClick={() => navigate('/exercises')}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Retour
          </Button>
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>{exercise.title}</h1>
          <p className="text-zinc-500 text-sm mt-1">{exercise.description}</p>
        </div>
        {timeLeft !== null && (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${timeLeft < 60 ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-zinc-800 border-zinc-700 text-zinc-300'}`}>
            <Clock className="w-4 h-4" />
            <span className="font-mono text-lg" style={{ fontFamily: 'JetBrains Mono' }}>{formatTime(timeLeft)}</span>
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="flex items-center gap-4">
        <Progress value={progress} className="flex-1 h-2 bg-zinc-800 [&>div]:bg-gradient-to-r [&>div]:from-cyan-500 [&>div]:to-indigo-500" />
        <span className="text-xs text-zinc-500 font-mono">{Object.keys(answers).length}/{questions.length}</span>
      </div>

      {/* Question navigation dots */}
      <div className="flex gap-2 flex-wrap">
        {questions.map((q, i) => (
          <button
            key={i}
            onClick={() => setCurrentQ(i)}
            data-testid={`question-dot-${i}`}
            className={`w-8 h-8 rounded-md text-xs font-medium transition-all ${
              i === currentQ
                ? 'bg-cyan-500 text-white shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                : answers[q.id]
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-zinc-800 text-zinc-500 border border-zinc-700 hover:border-zinc-600'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Current question */}
      {current && (
        <Card className="bg-zinc-900/50 backdrop-blur-md border-zinc-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Badge className={current.question_type === 'qcm' ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}>
                {current.question_type === 'qcm' ? 'QCM' : 'Question ouverte'}
              </Badge>
              <span className="text-xs text-zinc-500 font-mono">{current.points} pt{current.points > 1 ? 's' : ''}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-base text-zinc-200 font-medium">{current.question_text}</p>

            {current.question_type === 'qcm' ? (
              <div className="space-y-2">
                {current.options?.map((opt, oIdx) => (
                  <button
                    key={oIdx}
                    data-testid={`answer-option-${oIdx}`}
                    onClick={() => setAnswers({ ...answers, [current.id]: opt })}
                    className={`w-full text-left p-3 rounded-lg border transition-all duration-200 text-sm ${
                      answers[current.id] === opt
                        ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-300'
                        : 'bg-zinc-800/30 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/50'
                    }`}
                  >
                    <span className="font-mono text-xs text-zinc-500 mr-3">{String.fromCharCode(65 + oIdx)}</span>
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <textarea
                data-testid="open-answer"
                value={answers[current.id] || ''}
                onChange={(e) => setAnswers({ ...answers, [current.id]: e.target.value })}
                placeholder="Redigez votre reponse ici..."
                className="w-full min-h-[150px] bg-zinc-950 border border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-zinc-100 placeholder:text-zinc-600 rounded-md px-3 py-2 text-sm resize-none"
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          disabled={currentQ === 0}
          onClick={() => setCurrentQ(currentQ - 1)}
          className="border-zinc-700 text-zinc-300 hover:border-cyan-500 hover:text-cyan-400"
          data-testid="prev-question-btn"
        >
          Precedente
        </Button>
        {currentQ < questions.length - 1 ? (
          <Button
            onClick={() => setCurrentQ(currentQ + 1)}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
            data-testid="next-question-btn"
          >
            Suivante
          </Button>
        ) : (
          <Button
            data-testid="submit-exercise-btn"
            onClick={handleSubmit}
            disabled={submitting || Object.keys(answers).length === 0}
            className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]"
          >
            <Send className="w-4 h-4 mr-2" /> {submitting ? 'Envoi...' : 'Soumettre'}
          </Button>
        )}
      </div>
    </div>
  );
}
