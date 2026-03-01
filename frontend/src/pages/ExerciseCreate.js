import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2, GripVertical, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function ExerciseCreate() {
  const { getAuthHeaders, API } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [timeLimit, setTimeLimit] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`${API}/categories`, { headers: getAuthHeaders() })
      .then(res => setCategories(res.data))
      .catch(console.error);
  }, [API, getAuthHeaders]);

  const addQuestion = (type) => {
    setQuestions([...questions, {
      id: crypto.randomUUID(),
      question_text: '',
      question_type: type,
      options: type === 'qcm' ? ['', '', '', ''] : [],
      correct_answer: '',
      points: 2,
    }]);
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

  const removeQuestion = (idx) => {
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const addOption = (qIdx) => {
    const updated = [...questions];
    updated[qIdx].options.push('');
    setQuestions(updated);
  };

  const handleSubmit = async () => {
    if (!title || !category || questions.length === 0) {
      toast.error('Remplissez le titre, la categorie et ajoutez au moins une question');
      return;
    }
    setSaving(true);
    try {
      await axios.post(`${API}/exercises`, {
        title, description, category,
        time_limit: parseInt(timeLimit) || 0,
        questions: questions.map(q => ({
          ...q,
          points: parseInt(q.points) || 1,
        })),
      }, { headers: getAuthHeaders() });
      toast.success('Exercice cree avec succes');
      navigate('/exercises');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de la creation');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6 max-w-3xl" data-testid="exercise-create-page">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
          <span className="text-gradient">Creer</span> un exercice
        </h1>
        <p className="text-zinc-500 mt-1">Definissez les questions et parametres</p>
      </div>

      {/* Basic info */}
      <Card className="bg-zinc-900/50 backdrop-blur-md border-zinc-800">
        <CardContent className="p-6 space-y-4">
          <div>
            <label className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2 block">Titre</label>
            <Input
              data-testid="exercise-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Les bases du reseau TCP/IP"
              className="bg-zinc-950 border-zinc-800 focus:border-cyan-500 text-zinc-100 placeholder:text-zinc-600"
            />
          </div>
          <div>
            <label className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2 block">Description</label>
            <textarea
              data-testid="exercise-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description de l'exercice..."
              className="w-full min-h-[80px] bg-zinc-950 border border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-zinc-100 placeholder:text-zinc-600 rounded-md px-3 py-2 text-sm resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2 block">Categorie</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger data-testid="exercise-category" className="bg-zinc-950 border-zinc-800 text-zinc-100">
                  <SelectValue placeholder="Choisir..." />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2 block">Temps limite (min)</label>
              <Input
                data-testid="exercise-time-limit"
                type="number"
                value={timeLimit}
                onChange={(e) => setTimeLimit(e.target.value)}
                min={0}
                placeholder="0 = illimite"
                className="bg-zinc-950 border-zinc-800 focus:border-cyan-500 text-zinc-100 placeholder:text-zinc-600"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((q, idx) => (
          <Card key={q.id} className="bg-zinc-900/50 backdrop-blur-md border-zinc-800 animate-fade-in-up">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-zinc-600" />
                <CardTitle className="text-sm" style={{ fontFamily: 'Space Grotesk' }}>
                  Question {idx + 1}
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded ${q.question_type === 'qcm' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {q.question_type === 'qcm' ? 'QCM' : 'Ouverte'}
                  </span>
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={q.points}
                  onChange={(e) => updateQuestion(idx, 'points', e.target.value)}
                  className="w-16 h-7 bg-zinc-950 border-zinc-800 text-zinc-100 text-xs text-center"
                  min={1}
                />
                <span className="text-xs text-zinc-500">pts</span>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-300" onClick={() => removeQuestion(idx)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                data-testid={`question-text-${idx}`}
                value={q.question_text}
                onChange={(e) => updateQuestion(idx, 'question_text', e.target.value)}
                placeholder="Texte de la question..."
                className="w-full min-h-[60px] bg-zinc-950 border border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-zinc-100 placeholder:text-zinc-600 rounded-md px-3 py-2 text-sm resize-none"
              />
              {q.question_type === 'qcm' && (
                <div className="space-y-2">
                  <label className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Options</label>
                  {q.options.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500 w-6">{String.fromCharCode(65 + oIdx)}.</span>
                      <Input
                        data-testid={`option-${idx}-${oIdx}`}
                        value={opt}
                        onChange={(e) => updateOption(idx, oIdx, e.target.value)}
                        placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                        className="bg-zinc-950 border-zinc-800 focus:border-cyan-500 text-zinc-100 placeholder:text-zinc-600 flex-1"
                      />
                    </div>
                  ))}
                  <Button size="sm" variant="ghost" className="text-xs text-zinc-400 hover:text-cyan-400" onClick={() => addOption(idx)}>
                    + Ajouter une option
                  </Button>
                </div>
              )}
              <div>
                <label className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2 block">
                  {q.question_type === 'qcm' ? 'Reponse correcte' : 'Reponse attendue (guide pour l\'IA)'}
                </label>
                <Input
                  data-testid={`correct-answer-${idx}`}
                  value={q.correct_answer}
                  onChange={(e) => updateQuestion(idx, 'correct_answer', e.target.value)}
                  placeholder={q.question_type === 'qcm' ? 'Ex: DNS' : 'Elements de reponse attendus...'}
                  className="bg-zinc-950 border-zinc-800 focus:border-cyan-500 text-zinc-100 placeholder:text-zinc-600"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add question buttons */}
      <div className="flex gap-3">
        <Button
          data-testid="add-qcm-btn"
          onClick={() => addQuestion('qcm')}
          className="bg-indigo-600 hover:bg-indigo-500 text-white"
        >
          <PlusCircle className="w-4 h-4 mr-2" /> Question QCM
        </Button>
        <Button
          data-testid="add-open-btn"
          onClick={() => addQuestion('open')}
          className="bg-amber-600 hover:bg-amber-500 text-white"
        >
          <PlusCircle className="w-4 h-4 mr-2" /> Question ouverte
        </Button>
      </div>

      {/* Save */}
      <div className="flex justify-end pt-4 border-t border-zinc-800">
        <Button
          data-testid="save-exercise-btn"
          onClick={handleSubmit}
          disabled={saving}
          className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)] px-6"
        >
          <Save className="w-4 h-4 mr-2" /> {saving ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </div>
    </div>
  );
}
