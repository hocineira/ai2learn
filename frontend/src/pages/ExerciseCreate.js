import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2, GripVertical, Save, GraduationCap, Shield, Monitor, BookOpen } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

export default function ExerciseCreate() {
  const { getAuthHeaders, API, activeFormation } = useAuth();
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const isEdit = Boolean(editId);
  const [categories, setCategories] = useState([]);
  const [formations, setFormations] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [formation, setFormation] = useState(activeFormation || 'bts-sio-sisr');
  const [shared, setShared] = useState(false);
  const [timeLimit, setTimeLimit] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [exerciseType, setExerciseType] = useState('standard');
  const [labInstructions, setLabInstructions] = useState('');
  const [labUsername, setLabUsername] = useState('Administrator');
  const [labPassword, setLabPassword] = useState('');
  const [loadingExercise, setLoadingExercise] = useState(false);

  useEffect(() => {
    const headers = getAuthHeaders();
    Promise.all([
      axios.get(`${API}/categories?formation=${formation}`, { headers }),
      axios.get(`${API}/formations`, { headers }),
    ]).then(([catRes, fRes]) => {
      setCategories(catRes.data);
      setFormations(fRes.data);
    }).catch(console.error);
  }, [API, getAuthHeaders, formation]);

  // Load existing exercise in edit mode
  useEffect(() => {
    if (!editId) return;
    setLoadingExercise(true);
    const loadExercise = async () => {
      try {
        const res = await axios.get(`${API}/exercises/${editId}`, { headers: getAuthHeaders() });
        const ex = res.data;
        setTitle(ex.title || '');
        setDescription(ex.description || '');
        setCategory(ex.category || '');
        setFormation(ex.formation || 'bts-sio-sisr');
        setShared(ex.shared || false);
        setTimeLimit(ex.time_limit || 0);
        setExerciseType(ex.exercise_type || 'standard');
        setLabInstructions(ex.lab_instructions || '');
        setLabUsername(ex.lab_username || 'Administrator');
        setLabPassword(ex.lab_password || '');
        setQuestions(ex.questions || []);
      } catch (err) {
        toast.error('Exercice introuvable');
        navigate('/exercises');
      }
      setLoadingExercise(false);
    };
    loadExercise();
  }, [editId, API, getAuthHeaders, navigate]);

  const generateId = () => {
    try { return crypto.randomUUID(); } catch { return 'q-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now(); }
  };

  const addQuestion = (type) => {
    setQuestions([...questions, { id: generateId(), question_text: '', question_type: type, options: type === 'qcm' ? ['', '', '', ''] : [], correct_answer: '', points: 2 }]);
  };

  const updateQuestion = (idx, field, value) => {
    const updated = [...questions];
    updated[idx] = { ...updated[idx], [field]: value };
    setQuestions(updated);
  };

  const updateOption = (qIdx, oIdx, value) => {
    const updated = [...questions];
    updated[qIdx].options[oIdx] = value;
    setQuestions(updated);
  };

  const removeQuestion = (idx) => setQuestions(questions.filter((_, i) => i !== idx));
  const addOption = (qIdx) => { const updated = [...questions]; updated[qIdx].options.push(''); setQuestions(updated); };

  const handleSubmit = async () => {
    if (!title || !category || questions.length === 0) {
      toast.error('Remplissez le titre, la categorie et ajoutez au moins une question');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title, description, category, formation, shared,
        time_limit: parseInt(timeLimit) || 0,
        exercise_type: exerciseType,
        lab_instructions: exerciseType === 'lab' ? labInstructions : undefined,
        lab_username: exerciseType === 'lab' ? labUsername : undefined,
        lab_password: exerciseType === 'lab' ? labPassword : undefined,
        questions: questions.map(q => ({ ...q, points: parseInt(q.points) || 1 })),
      };
      if (isEdit) {
        await axios.put(`${API}/exercises/${editId}`, payload, { headers: getAuthHeaders() });
        toast.success('Exercice modifie avec succes');
      } else {
        await axios.post(`${API}/exercises`, payload, { headers: getAuthHeaders() });
        toast.success('Exercice cree avec succes');
      }
      navigate('/exercises');
    } catch (err) { toast.error(err.response?.data?.detail || 'Erreur'); }
    setSaving(false);
  };

  if (loadingExercise) return <div className="th-text-muted text-center py-20">Chargement de l'exercice...</div>;

  return (
    <div className="space-y-6 max-w-5xl" data-testid="exercise-create-page">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
          <span className="text-gradient">{isEdit ? 'Modifier' : 'Creer'}</span> un exercice
        </h1>
        <p className="text-gray-500 dark:text-zinc-500 mt-1">{isEdit ? 'Modifiez les questions et parametres' : 'Definissez les questions et parametres'}</p>
      </div>

      <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
        <CardContent className="p-6 space-y-4">
          <div>
            <label className="text-xs font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-2 block">Titre</label>
            <Input data-testid="exercise-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Les bases du reseau TCP/IP" className="bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 focus:border-cyan-500 text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500" />
          </div>
          <div>
            <label className="text-xs font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-2 block">Description</label>
            <textarea data-testid="exercise-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description de l'exercice..."
              className="w-full min-h-[80px] bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 rounded-md px-3 py-2 text-sm resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-2 block">Formation</label>
              <Select value={formation} onValueChange={(v) => { setFormation(v); setCategory(''); }}>
                <SelectTrigger data-testid="exercise-formation" className="bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-zinc-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-50 dark:bg-zinc-900 border-gray-200 dark:border-gray-200 dark:border-zinc-800">
                  {formations.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      <span className="flex items-center gap-2">
                        {f.id === 'bachelor-ais' ? <Shield className="w-3 h-3 text-violet-400" /> : <GraduationCap className="w-3 h-3 text-cyan-400" />}
                        {f.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-2 block">Categorie</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger data-testid="exercise-category" className="bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-zinc-100">
                  <SelectValue placeholder="Choisir..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-50 dark:bg-zinc-900 border-gray-200 dark:border-gray-200 dark:border-zinc-800">
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-2 block">Temps limite (min)</label>
              <Input data-testid="exercise-time-limit" type="number" value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} min={0} placeholder="0 = illimite" className="bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 focus:border-cyan-500 text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer p-2">
                <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="rounded border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-cyan-500 focus:ring-cyan-500" />
                <span className="text-sm text-gray-500 dark:text-zinc-400">Partager entre formations</span>
              </label>
            </div>
          </div>

          {/* Exercise Type */}
          <div>
            <label className="text-xs font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-2 block">Type d'exercice</label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setExerciseType('standard')} data-testid="type-standard-btn"
                className={`flex-1 p-3 rounded-lg border text-sm transition-all ${exerciseType === 'standard' ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-300' : 'bg-gray-50 dark:bg-zinc-800/30 border-gray-200 dark:border-zinc-800 text-gray-500 dark:text-zinc-400 hover:border-gray-300 dark:border-zinc-700'}`}>
                <BookOpen className="w-4 h-4 mx-auto mb-1" /> Standard (QCM/Ouvert)
              </button>
              <button type="button" onClick={() => setExerciseType('lab')} data-testid="type-lab-btn"
                className={`flex-1 p-3 rounded-lg border text-sm transition-all ${exerciseType === 'lab' ? 'bg-orange-500/10 border-orange-500/50 text-orange-300' : 'bg-gray-50 dark:bg-zinc-800/30 border-gray-200 dark:border-zinc-800 text-gray-500 dark:text-zinc-400 hover:border-gray-300 dark:border-zinc-700'}`}>
                <Monitor className="w-4 h-4 mx-auto mb-1" /> Lab Pratique (VM)
              </button>
            </div>
          </div>

          {/* Lab-specific fields */}
          {exerciseType === 'lab' && (
            <div className="space-y-4 p-4 border border-orange-500/20 rounded-lg bg-orange-500/5">
              <p className="text-xs font-mono text-orange-400 uppercase tracking-wider">Configuration Lab VM</p>
              <div>
                <label className="text-xs font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-2 block">Consignes du lab</label>
                <textarea data-testid="lab-instructions" value={labInstructions} onChange={(e) => setLabInstructions(e.target.value)}
                  placeholder="Decrivez les etapes que l'etudiant doit realiser dans la VM..."
                  className="w-full min-h-[120px] bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 rounded-md px-3 py-2 text-sm resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-2 block">Utilisateur RDP</label>
                  <Input data-testid="lab-username" value={labUsername} onChange={(e) => setLabUsername(e.target.value)} className="bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 focus:border-orange-500 text-gray-900 dark:text-zinc-100" />
                </div>
                <div>
                  <label className="text-xs font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-2 block">Mot de passe RDP</label>
                  <Input data-testid="lab-password" value={labPassword} onChange={(e) => setLabPassword(e.target.value)} className="bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 focus:border-orange-500 text-gray-900 dark:text-zinc-100" />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {questions.map((q, idx) => (
          <Card key={q.id} className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none animate-fade-in-up">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-gray-400 dark:text-zinc-600" />
                <CardTitle className="text-sm" style={{ fontFamily: 'Space Grotesk' }}>
                  Question {idx + 1}
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded ${q.question_type === 'qcm' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {q.question_type === 'qcm' ? 'QCM' : 'Ouverte'}
                  </span>
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Input type="number" value={q.points} onChange={(e) => updateQuestion(idx, 'points', e.target.value)} className="w-16 h-7 bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-zinc-100 text-xs text-center" min={1} />
                <span className="text-xs text-gray-500 dark:text-zinc-500">pts</span>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-300" onClick={() => removeQuestion(idx)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea data-testid={`question-text-${idx}`} value={q.question_text} onChange={(e) => updateQuestion(idx, 'question_text', e.target.value)} placeholder="Texte de la question..."
                className="w-full min-h-[60px] bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 rounded-md px-3 py-2 text-sm resize-none" />
              {q.question_type === 'qcm' && (
                <div className="space-y-2">
                  <label className="text-xs font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-wider">Options</label>
                  {q.options.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-zinc-500 w-6">{String.fromCharCode(65 + oIdx)}.</span>
                      <Input data-testid={`option-${idx}-${oIdx}`} value={opt} onChange={(e) => updateOption(idx, oIdx, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + oIdx)}`} className="bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 focus:border-cyan-500 text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 flex-1" />
                    </div>
                  ))}
                  <Button size="sm" variant="ghost" className="text-xs text-gray-500 dark:text-zinc-400 hover:text-cyan-400" onClick={() => addOption(idx)}>+ Ajouter une option</Button>
                </div>
              )}
              <div>
                <label className="text-xs font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-2 block">{q.question_type === 'qcm' ? 'Reponse correcte' : "Reponse attendue (guide pour l'IA)"}</label>
                <Input data-testid={`correct-answer-${idx}`} value={q.correct_answer} onChange={(e) => updateQuestion(idx, 'correct_answer', e.target.value)} placeholder={q.question_type === 'qcm' ? 'Ex: DNS' : 'Elements de reponse attendus...'} className="bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 focus:border-cyan-500 text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-3">
        <Button data-testid="add-qcm-btn" onClick={() => addQuestion('qcm')} className="bg-indigo-600 hover:bg-indigo-500 text-white">
          <PlusCircle className="w-4 h-4 mr-2" /> Question QCM
        </Button>
        <Button data-testid="add-open-btn" onClick={() => addQuestion('open')} className="bg-amber-600 hover:bg-amber-500 text-white">
          <PlusCircle className="w-4 h-4 mr-2" /> Question ouverte
        </Button>
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-zinc-800">
        <Button data-testid="save-exercise-btn" onClick={handleSubmit} disabled={saving} className="bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white px-6">
          <Save className="w-4 h-4 mr-2" /> {saving ? 'Enregistrement...' : isEdit ? 'Sauvegarder' : 'Enregistrer'}
        </Button>
      </div>
    </div>
  );
}
