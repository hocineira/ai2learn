import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen, Save, ArrowLeft, Upload, Trash2, Plus, Video,
  Target, ListChecks, Clock, Monitor, Loader2, FileVideo, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

export default function CourseCreatePage() {
  const { getAuthHeaders, API, activeFormation } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedExerciseId = searchParams.get('exercise_id');

  const [exercises, setExercises] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState(preselectedExerciseId || '');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [objectives, setObjectives] = useState(['']);
  const [prerequisites, setPrerequisites] = useState(['']);
  const [durationEstimate, setDurationEstimate] = useState('');
  const [videoFilename, setVideoFilename] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [existingCourse, setExistingCourse] = useState(null);
  const fileInputRef = useRef(null);

  const formation = activeFormation || 'bts-sio-sisr';

  useEffect(() => {
    const fetchExercises = async () => {
      try {
        const headers = getAuthHeaders();
        const res = await axios.get(`${API}/exercises?formation=${formation}`, { headers });
        // Filter lab-type exercises
        const labExercises = (res.data || []).filter(e => e.exercise_type === 'lab');
        setExercises(labExercises);
      } catch (err) {
        console.error(err);
      }
    };
    fetchExercises();
  }, [API, getAuthHeaders, formation]);

  // Auto-load existing course when exercise is selected
  useEffect(() => {
    if (!selectedExercise) return;
    const loadCourse = async () => {
      try {
        const headers = getAuthHeaders();
        const res = await axios.get(`${API}/courses/by-exercise/${selectedExercise}`, { headers });
        setExistingCourse(res.data);
        setTitle(res.data.title || '');
        setContent(res.data.content || '');
        setObjectives(res.data.objectives?.length > 0 ? res.data.objectives : ['']);
        setPrerequisites(res.data.prerequisites?.length > 0 ? res.data.prerequisites : ['']);
        setDurationEstimate(res.data.duration_estimate || '');
        setVideoFilename(res.data.video_filename || null);
      } catch {
        setExistingCourse(null);
      }
    };
    loadCourse();
  }, [selectedExercise, API, getAuthHeaders]);

  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      toast.error('Veuillez selectionner un fichier video (MP4, WebM, etc.)');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API}/upload/video`, formData, {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const pct = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
          setUploadProgress(pct);
        },
      });
      setVideoFilename(res.data.filename);
      toast.success(`Video "${file.name}" uploadee avec succes`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de l\'upload');
    }
    setUploading(false);
  };

  const removeVideo = () => {
    setVideoFilename(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addObjective = () => setObjectives([...objectives, '']);
  const removeObjective = (i) => setObjectives(objectives.filter((_, idx) => idx !== i));
  const updateObjective = (i, val) => {
    const updated = [...objectives];
    updated[i] = val;
    setObjectives(updated);
  };

  const addPrerequisite = () => setPrerequisites([...prerequisites, '']);
  const removePrerequisite = (i) => setPrerequisites(prerequisites.filter((_, idx) => idx !== i));
  const updatePrerequisite = (i, val) => {
    const updated = [...prerequisites];
    updated[i] = val;
    setPrerequisites(updated);
  };

  const handleSubmit = async () => {
    if (!selectedExercise || !title.trim()) {
      toast.error('Selectionnez un exercice lab et remplissez le titre');
      return;
    }

    setSaving(true);
    try {
      const headers = getAuthHeaders();
      const payload = {
        exercise_id: selectedExercise,
        title: title.trim(),
        content: content.trim(),
        video_filename: videoFilename,
        objectives: objectives.filter(o => o.trim()),
        prerequisites: prerequisites.filter(p => p.trim()),
        duration_estimate: durationEstimate.trim() || null,
      };

      if (existingCourse) {
        // Update
        await axios.put(`${API}/courses/${existingCourse.id}`, payload, { headers });
        toast.success('Cours mis a jour');
      } else {
        // Create
        await axios.post(`${API}/courses`, payload, { headers });
        toast.success('Cours cree avec succes');
      }
      navigate('/courses');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de la sauvegarde');
    }
    setSaving(false);
  };

  const selectedEx = exercises.find(e => e.id === selectedExercise);

  return (
    <div className="max-w-3xl mx-auto space-y-6" data-testid="course-create-page">
      <Button variant="ghost" className="text-zinc-400 hover:text-cyan-400 -ml-3" onClick={() => navigate('/courses')}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Retour aux cours
      </Button>

      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
          {existingCourse ? 'Modifier le' : 'Creer un'} <span className="text-gradient">cours</span>
        </h1>
        <p className="text-zinc-500 mt-1">
          Associez un contenu pedagogique a un exercice lab
        </p>
      </div>

      {/* Exercise Selection */}
      <Card className="bg-zinc-900/50 backdrop-blur-md border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-cyan-400" style={{ fontFamily: 'Space Grotesk' }}>
            <Monitor className="w-4 h-4" /> Exercice Lab associe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedExercise} onValueChange={setSelectedExercise}>
            <SelectTrigger className="bg-zinc-900 border-zinc-700 text-zinc-200" data-testid="select-exercise">
              <SelectValue placeholder="Choisir un exercice lab..." />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800">
              {exercises.length === 0 ? (
                <SelectItem value="__none" disabled>Aucun exercice lab disponible</SelectItem>
              ) : (
                exercises.map(ex => (
                  <SelectItem key={ex.id} value={ex.id} className="text-zinc-200">
                    <span className="flex items-center gap-2">
                      <Monitor className="w-3 h-3 text-orange-400" />
                      {ex.title}
                    </span>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {selectedEx && (
            <p className="text-xs text-zinc-500 mt-2">
              Categorie: {selectedEx.category} · {selectedEx.questions?.length || 0} questions
            </p>
          )}
        </CardContent>
      </Card>

      {/* Title */}
      <Card className="bg-zinc-900/50 backdrop-blur-md border-zinc-800">
        <CardContent className="pt-6">
          <label className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2 block">Titre du cours</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Introduction au DNS sous Windows Server"
            className="bg-zinc-900 border-zinc-700 text-zinc-200 focus:border-cyan-500"
            data-testid="course-title-input"
          />
        </CardContent>
      </Card>

      {/* Video Upload */}
      <Card className="bg-zinc-900/50 backdrop-blur-md border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-cyan-400" style={{ fontFamily: 'Space Grotesk' }}>
            <Video className="w-4 h-4" /> Video du cours (MP4)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {videoFilename ? (
            <div className="flex items-center gap-3 p-4 bg-zinc-800/50 rounded-lg border border-emerald-500/20">
              <FileVideo className="w-8 h-8 text-emerald-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-200 font-medium truncate">{videoFilename}</p>
                <p className="text-xs text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Video uploadee
                </p>
              </div>
              <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={removeVideo}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/*"
                onChange={handleVideoUpload}
                className="hidden"
                id="video-upload"
              />
              <label
                htmlFor="video-upload"
                className={`flex flex-col items-center gap-3 p-8 border-2 border-dashed ${uploading ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-zinc-700 hover:border-cyan-500/30'} rounded-lg cursor-pointer transition-all`}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
                    <span className="text-sm text-cyan-400">Upload en cours... {uploadProgress}%</span>
                    <div className="w-full max-w-xs bg-zinc-800 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-cyan-500 to-violet-500 h-2 rounded-full transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-zinc-500" />
                    <span className="text-sm text-zinc-400">
                      Cliquez ou glissez un fichier video MP4
                    </span>
                    <span className="text-xs text-zinc-600">
                      Formats acceptes: MP4, WebM, OGG
                    </span>
                  </>
                )}
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Objectives */}
      <Card className="bg-zinc-900/50 backdrop-blur-md border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-cyan-400" style={{ fontFamily: 'Space Grotesk' }}>
            <Target className="w-4 h-4" /> Objectifs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {objectives.map((obj, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={obj}
                onChange={(e) => updateObjective(i, e.target.value)}
                placeholder={`Objectif ${i + 1}`}
                className="bg-zinc-900 border-zinc-700 text-zinc-200 text-sm focus:border-cyan-500"
              />
              {objectives.length > 1 && (
                <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2" onClick={() => removeObjective(i)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          ))}
          <Button variant="ghost" size="sm" className="text-cyan-400 hover:text-cyan-300 text-xs" onClick={addObjective}>
            <Plus className="w-3 h-3 mr-1" /> Ajouter un objectif
          </Button>
        </CardContent>
      </Card>

      {/* Prerequisites */}
      <Card className="bg-zinc-900/50 backdrop-blur-md border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-violet-400" style={{ fontFamily: 'Space Grotesk' }}>
            <ListChecks className="w-4 h-4" /> Prerequis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {prerequisites.map((pre, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={pre}
                onChange={(e) => updatePrerequisite(i, e.target.value)}
                placeholder={`Prerequis ${i + 1}`}
                className="bg-zinc-900 border-zinc-700 text-zinc-200 text-sm focus:border-violet-500"
              />
              {prerequisites.length > 1 && (
                <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2" onClick={() => removePrerequisite(i)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          ))}
          <Button variant="ghost" size="sm" className="text-violet-400 hover:text-violet-300 text-xs" onClick={addPrerequisite}>
            <Plus className="w-3 h-3 mr-1" /> Ajouter un prerequis
          </Button>
        </CardContent>
      </Card>

      {/* Duration */}
      <Card className="bg-zinc-900/50 backdrop-blur-md border-zinc-800">
        <CardContent className="pt-6">
          <label className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2 block">
            <Clock className="w-3 h-3 inline mr-1" /> Duree estimee de lecture
          </label>
          <Input
            value={durationEstimate}
            onChange={(e) => setDurationEstimate(e.target.value)}
            placeholder="Ex: 15 min, 1h30"
            className="bg-zinc-900 border-zinc-700 text-zinc-200 focus:border-cyan-500 max-w-xs"
          />
        </CardContent>
      </Card>

      {/* Content */}
      <Card className="bg-zinc-900/50 backdrop-blur-md border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-zinc-300" style={{ fontFamily: 'Space Grotesk' }}>
            <BookOpen className="w-4 h-4 text-cyan-400" /> Contenu du cours
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-zinc-600 mb-2">
            Supporte le formatage basique: ## Titre, ### Sous-titre, **gras**, - liste, `code`
          </p>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Redigez le contenu du cours ici...

## Introduction

Le DNS (Domain Name System) est un service reseau fondamental...

### Objectifs de ce TP

- Installer le role DNS sur Windows Server
- Configurer une zone de recherche directe
- Tester la resolution avec nslookup

**Important:** Assurez-vous de bien comprendre les concepts avant de demarrer le lab."
            className="w-full min-h-[400px] bg-zinc-900/50 border border-zinc-700 rounded-lg p-4 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none resize-y font-mono"
            data-testid="course-content-input"
          />
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex items-center gap-3 pb-8">
        <Button
          data-testid="save-course-btn"
          onClick={handleSubmit}
          disabled={saving || !selectedExercise || !title.trim()}
          className="bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white px-8 py-3 text-base shadow-[0_0_20px_rgba(6,182,212,0.2)]"
        >
          {saving ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Sauvegarde...</>
          ) : (
            <><Save className="w-5 h-5 mr-2" /> {existingCourse ? 'Mettre a jour' : 'Creer le cours'}</>
          )}
        </Button>
        <Button variant="outline" className="border-zinc-700 text-zinc-400" onClick={() => navigate('/courses')}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
