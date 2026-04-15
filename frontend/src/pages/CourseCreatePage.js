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
  Target, ListChecks, Clock, Monitor, Loader2, FileVideo, CheckCircle2,
  GraduationCap, Shield, Link2, ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';

export default function CourseCreatePage() {
  const { getAuthHeaders, API, activeFormation } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedExerciseId = searchParams.get('exercise_id');

  const [exercises, setExercises] = useState([]);
  const [formations, setFormations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState(preselectedExerciseId || '');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [objectives, setObjectives] = useState(['']);
  const [prerequisites, setPrerequisites] = useState(['']);
  const [durationEstimate, setDurationEstimate] = useState('');
  const [formation, setFormation] = useState(activeFormation || 'bts-sio-sisr');
  const [category, setCategory] = useState('');
  const [videoFilename, setVideoFilename] = useState(null);
  const [coverImage, setCoverImage] = useState(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [images, setImages] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [existingCourse, setExistingCourse] = useState(null);
  const fileInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const imageInputRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = getAuthHeaders();
        const [exRes, fRes, catRes] = await Promise.all([
          axios.get(`${API}/exercises?formation=${formation}`, { headers }),
          axios.get(`${API}/formations`, { headers }),
          axios.get(`${API}/categories?formation=${formation}`, { headers }),
        ]);
        // Show all exercises (not just labs) for optional linking
        const labExercises = (exRes.data || []).filter(e => e.exercise_type === 'lab');
        setExercises(labExercises);
        setFormations(fRes.data || []);
        setCategories(catRes.data || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, [API, getAuthHeaders, formation]);

  // Auto-load existing course when exercise is selected
  useEffect(() => {
    if (!selectedExercise) {
      setExistingCourse(null);
      return;
    }
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
        setImages(res.data.images || []);
        setCoverImage(res.data.cover_image || null);
        if (res.data.formation) setFormation(res.data.formation);
        if (res.data.category) setCategory(res.data.category);
      } catch {
        setExistingCourse(null);
      }
    };
    loadCourse();
  }, [selectedExercise, API, getAuthHeaders]);

  // Also check if we're editing an existing course by course_id param
  const courseIdParam = searchParams.get('course_id');
  useEffect(() => {
    if (!courseIdParam) return;
    const loadCourseById = async () => {
      try {
        const headers = getAuthHeaders();
        const res = await axios.get(`${API}/courses/${courseIdParam}`, { headers });
        setExistingCourse(res.data);
        setTitle(res.data.title || '');
        setContent(res.data.content || '');
        setObjectives(res.data.objectives?.length > 0 ? res.data.objectives : ['']);
        setPrerequisites(res.data.prerequisites?.length > 0 ? res.data.prerequisites : ['']);
        setDurationEstimate(res.data.duration_estimate || '');
        setVideoFilename(res.data.video_filename || null);
        setImages(res.data.images || []);
        setCoverImage(res.data.cover_image || null);
        if (res.data.exercise_id) setSelectedExercise(res.data.exercise_id);
        if (res.data.formation) setFormation(res.data.formation);
        if (res.data.category) setCategory(res.data.category);
      } catch {
        // not found
      }
    };
    loadCourseById();
  }, [courseIdParam, API, getAuthHeaders]);

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
      toast.error(err.response?.data?.detail || "Erreur lors de l'upload");
    }
    setUploading(false);
  };

  const removeVideo = () => {
    setVideoFilename(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez selectionner une image (JPEG, PNG, etc.)');
      return;
    }
    setUploadingCover(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(`${API}/upload/image`, formData, {
        headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' },
      });
      setCoverImage(res.data.filename);
      toast.success('Image de couverture uploadee');
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors de l'upload");
    }
    setUploadingCover(false);
    if (coverInputRef.current) coverInputRef.current.value = '';
  };

  const removeCover = () => {
    setCoverImage(null);
    if (coverInputRef.current) coverInputRef.current.value = '';
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    
    setUploadingImage(true);
    const newImages = [...images];
    
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        toast.error(`"${file.name}" n'est pas une image`);
        continue;
      }
      
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const res = await axios.post(`${API}/upload/image`, formData, {
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'multipart/form-data',
          },
        });
        newImages.push(res.data.filename);
        toast.success(`Image "${file.name}" uploadee`);
      } catch (err) {
        toast.error(err.response?.data?.detail || `Erreur upload "${file.name}"`);
      }
    }
    
    setImages(newImages);
    setUploadingImage(false);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
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
    if (!title.trim()) {
      toast.error('Remplissez au minimum le titre du cours');
      return;
    }

    setSaving(true);
    try {
      const headers = getAuthHeaders();
      const payload = {
        exercise_id: selectedExercise || null,
        title: title.trim(),
        content: content.trim(),
        cover_image: coverImage,
        video_filename: videoFilename,
        images: images,
        objectives: objectives.filter(o => o.trim()),
        prerequisites: prerequisites.filter(p => p.trim()),
        duration_estimate: durationEstimate.trim() || null,
        formation: formation,
        category: category || null,
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

  const handleUnlinkExercise = () => {
    setSelectedExercise('');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6" data-testid="course-create-page">
      <Button variant="ghost" className="text-gray-500 dark:text-zinc-400 hover:text-cyan-400 -ml-3" onClick={() => navigate('/courses')}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Retour aux cours
      </Button>

      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
          {existingCourse ? 'Modifier le' : 'Creer un'} <span className="text-gradient">cours</span>
        </h1>
        <p className="text-gray-500 dark:text-zinc-500 mt-1">
          Creez un contenu pedagogique, avec ou sans exercice lab associe
        </p>
      </div>

      {/* Title */}
      <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
        <CardContent className="pt-6">
          <label className="text-xs font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-2 block">Titre du cours *</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Introduction au DNS sous Windows Server"
            className="bg-gray-50 dark:bg-zinc-900 border-gray-300 dark:border-gray-300 dark:border-zinc-700 text-gray-800 dark:text-zinc-200 focus:border-cyan-500"
            data-testid="course-title-input"
          />
        </CardContent>
      </Card>

      {/* Cover Image / Image de couverture */}
      <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-violet-500 dark:text-violet-400" style={{ fontFamily: 'Space Grotesk' }}>
            <ImageIcon className="w-4 h-4" /> Image de couverture
            <Badge className="bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500 border-gray-300 dark:border-zinc-700 text-[10px] ml-2">Recommande</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-3">
            Cette image sera affichee comme vignette du cours dans la liste et en banniere dans la page du cours.
          </p>
          {coverImage ? (
            <div className="relative group rounded-xl overflow-hidden border border-violet-500/20 bg-gray-100 dark:bg-zinc-800/50">
              <img
                src={`${API}/images/${coverImage}`}
                alt="Couverture du cours"
                className="w-full h-48 object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 text-white bg-red-500/80 hover:bg-red-600 transition-all"
                  onClick={removeCover}
                >
                  <Trash2 className="w-4 h-4 mr-1" /> Supprimer
                </Button>
              </div>
              <div className="absolute bottom-2 left-2">
                <Badge className="bg-violet-600/80 text-white border-0 text-[10px]">Image de couverture</Badge>
              </div>
            </div>
          ) : (
            <div className="relative">
              <input
                ref={coverInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleCoverUpload}
                className="hidden"
                id="cover-upload"
              />
              <label
                htmlFor="cover-upload"
                className={`flex flex-col items-center gap-3 p-8 border-2 border-dashed ${uploadingCover ? 'border-violet-500/30 bg-violet-500/5' : 'border-gray-300 dark:border-zinc-700 hover:border-violet-500/30'} rounded-xl cursor-pointer transition-all`}
              >
                {uploadingCover ? (
                  <>
                    <Loader2 className="w-10 h-10 text-violet-400 animate-spin" />
                    <span className="text-sm text-violet-400">Upload en cours...</span>
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-10 h-10 text-gray-400 dark:text-zinc-600" />
                    <span className="text-sm text-gray-500 dark:text-zinc-400">
                      Cliquez pour ajouter une image de couverture
                    </span>
                    <span className="text-xs text-gray-400 dark:text-zinc-600">
                      JPEG, PNG, GIF, WebP - Format paysage recommande (16:9)
                    </span>
                  </>
                )}
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Formation & Category */}
      <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-cyan-400" style={{ fontFamily: 'Space Grotesk' }}>
            <GraduationCap className="w-4 h-4" /> Formation et categorie
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Formation</label>
              <Select value={formation} onValueChange={setFormation}>
                <SelectTrigger className="bg-gray-50 dark:bg-zinc-900 border-gray-300 dark:border-gray-300 dark:border-zinc-700 text-gray-800 dark:text-zinc-200 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-50 dark:bg-zinc-900 border-gray-200 dark:border-gray-200 dark:border-zinc-800">
                  {formations.map(f => (
                    <SelectItem key={f.id} value={f.id} className="text-gray-800 dark:text-zinc-200 text-sm">
                      <span className="flex items-center gap-2">
                        {f.id === 'bts-sio-sisr'
                          ? <GraduationCap className="w-3 h-3 text-cyan-400" />
                          : <Shield className="w-3 h-3 text-violet-400" />
                        }
                        {f.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-zinc-500 mb-1 block">Categorie (optionnel)</label>
              <Select value={category || '__none'} onValueChange={(v) => setCategory(v === '__none' ? '' : v)}>
                <SelectTrigger className="bg-gray-50 dark:bg-zinc-900 border-gray-300 dark:border-gray-300 dark:border-zinc-700 text-gray-800 dark:text-zinc-200 text-sm">
                  <SelectValue placeholder="Choisir une categorie..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-50 dark:bg-zinc-900 border-gray-200 dark:border-gray-200 dark:border-zinc-800">
                  <SelectItem value="__none" className="text-gray-500 dark:text-zinc-500 text-sm">Aucune categorie</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-gray-800 dark:text-zinc-200 text-sm">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exercise Link (Optional) */}
      <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-orange-400" style={{ fontFamily: 'Space Grotesk' }}>
            <Link2 className="w-4 h-4" /> Exercice Lab associe
            <Badge className="bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500 border-gray-300 dark:border-zinc-700 text-[10px] ml-2">Optionnel</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-3">
            Vous pouvez associer ce cours a un exercice lab maintenant ou plus tard.
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Select value={selectedExercise || '__none'} onValueChange={(v) => setSelectedExercise(v === '__none' ? '' : v)}>
                <SelectTrigger className="bg-gray-50 dark:bg-zinc-900 border-gray-300 dark:border-gray-300 dark:border-zinc-700 text-gray-800 dark:text-zinc-200" data-testid="select-exercise">
                  <SelectValue placeholder="Aucun exercice lab (cours independant)" />
                </SelectTrigger>
                <SelectContent className="bg-gray-50 dark:bg-zinc-900 border-gray-200 dark:border-gray-200 dark:border-zinc-800">
                  <SelectItem value="__none" className="text-gray-500 dark:text-zinc-500">
                    Aucun exercice (cours independant)
                  </SelectItem>
                  {exercises.map(ex => (
                    <SelectItem key={ex.id} value={ex.id} className="text-gray-800 dark:text-zinc-200">
                      <span className="flex items-center gap-2">
                        <Monitor className="w-3 h-3 text-orange-400" />
                        {ex.title}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedExercise && selectedExercise !== '__none' && (
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-500 dark:text-zinc-500 hover:text-red-400 px-2"
                onClick={handleUnlinkExercise}
                title="Dissocier l'exercice"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
          {selectedExercise && selectedExercise !== '__none' && (
            <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Ce cours apparaitra avant le lab "{exercises.find(e => e.id === selectedExercise)?.title || '...'}"
            </p>
          )}
        </CardContent>
      </Card>

      {/* Video Upload */}
      <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-cyan-400" style={{ fontFamily: 'Space Grotesk' }}>
            <Video className="w-4 h-4" /> Video du cours (MP4)
            <Badge className="bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500 border-gray-300 dark:border-zinc-700 text-[10px] ml-2">Optionnel</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {videoFilename ? (
            <div className="flex items-center gap-3 p-4 bg-gray-100 dark:bg-zinc-800/50 rounded-lg border border-emerald-500/20">
              <FileVideo className="w-8 h-8 text-emerald-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 dark:text-zinc-200 font-medium truncate">{videoFilename}</p>
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
                className={`flex flex-col items-center gap-3 p-8 border-2 border-dashed ${uploading ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-gray-300 dark:border-zinc-700 hover:border-cyan-500/30'} rounded-lg cursor-pointer transition-all`}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
                    <span className="text-sm text-cyan-400">Upload en cours... {uploadProgress}%</span>
                    <div className="w-full max-w-xs bg-gray-200 dark:bg-zinc-800 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-cyan-500 to-violet-500 h-2 rounded-full transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-gray-500 dark:text-zinc-500" />
                    <span className="text-sm text-gray-500 dark:text-zinc-400">
                      Cliquez ou glissez un fichier video MP4
                    </span>
                    <span className="text-xs text-gray-400 dark:text-zinc-600">
                      Formats acceptes: MP4, WebM, OGG
                    </span>
                  </>
                )}
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Images d'illustration */}
      <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-emerald-500 dark:text-emerald-400" style={{ fontFamily: 'Space Grotesk' }}>
            <ImageIcon className="w-4 h-4" /> Images d'illustration
            <Badge className="bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500 border-gray-300 dark:border-zinc-700 text-[10px] ml-2">Optionnel</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Display existing images */}
          {images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {images.map((imgFilename, idx) => (
                <div key={idx} className="relative group rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800/50">
                  <img
                    src={`${API}/images/${imgFilename}`}
                    alt={`Illustration ${idx + 1}`}
                    className="w-full h-32 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 text-white bg-red-500/80 hover:bg-red-600 transition-all"
                      onClick={() => removeImage(idx)}
                    >
                      <Trash2 className="w-4 h-4 mr-1" /> Supprimer
                    </Button>
                  </div>
                  <div className="absolute top-1 left-1">
                    <Badge className="bg-black/60 text-white border-0 text-[10px]">{idx + 1}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Upload zone */}
          <div className="relative">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
              onChange={handleImageUpload}
              className="hidden"
              id="image-upload"
              multiple
            />
            <label
              htmlFor="image-upload"
              className={`flex flex-col items-center gap-3 p-6 border-2 border-dashed ${uploadingImage ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-gray-300 dark:border-zinc-700 hover:border-emerald-500/30'} rounded-lg cursor-pointer transition-all`}
            >
              {uploadingImage ? (
                <>
                  <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                  <span className="text-sm text-emerald-400">Upload en cours...</span>
                </>
              ) : (
                <>
                  <ImageIcon className="w-8 h-8 text-gray-500 dark:text-zinc-500" />
                  <span className="text-sm text-gray-500 dark:text-zinc-400">
                    Cliquez pour ajouter des images d'illustration
                  </span>
                  <span className="text-xs text-gray-400 dark:text-zinc-600">
                    JPEG, PNG, GIF, WebP, SVG - Selection multiple possible
                  </span>
                </>
              )}
            </label>
          </div>
          
          {images.length > 0 && (
            <p className="text-xs text-emerald-500 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> {images.length} image{images.length > 1 ? 's' : ''} ajoutee{images.length > 1 ? 's' : ''}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Objectives */}
      <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
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
                className="bg-gray-50 dark:bg-zinc-900 border-gray-300 dark:border-gray-300 dark:border-zinc-700 text-gray-800 dark:text-zinc-200 text-sm focus:border-cyan-500"
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
      <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
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
                className="bg-gray-50 dark:bg-zinc-900 border-gray-300 dark:border-gray-300 dark:border-zinc-700 text-gray-800 dark:text-zinc-200 text-sm focus:border-violet-500"
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
      <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
        <CardContent className="pt-6">
          <label className="text-xs font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-2 block">
            <Clock className="w-3 h-3 inline mr-1" /> Duree estimee de lecture
          </label>
          <Input
            value={durationEstimate}
            onChange={(e) => setDurationEstimate(e.target.value)}
            placeholder="Ex: 15 min, 1h30"
            className="bg-gray-50 dark:bg-zinc-900 border-gray-300 dark:border-gray-300 dark:border-zinc-700 text-gray-800 dark:text-zinc-200 focus:border-cyan-500 max-w-xs"
          />
        </CardContent>
      </Card>

      {/* Content */}
      <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-gray-700 dark:text-zinc-300" style={{ fontFamily: 'Space Grotesk' }}>
            <BookOpen className="w-4 h-4 text-cyan-400" /> Contenu du cours
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-400 dark:text-zinc-600 mb-2">
            Supporte le formatage basique: ## Titre, ### Sous-titre, **gras**, - liste, `code`
          </p>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={"Redigez le contenu du cours ici...\n\n## Introduction\n\nLe DNS (Domain Name System) est un service reseau fondamental...\n\n### Objectifs de ce TP\n\n- Installer le role DNS sur Windows Server\n- Configurer une zone de recherche directe\n- Tester la resolution avec nslookup\n\n**Important:** Assurez-vous de bien comprendre les concepts avant de demarrer le lab."}
            className="w-full min-h-[400px] bg-white dark:bg-zinc-900/50 border border-gray-300 dark:border-zinc-700 rounded-lg p-4 text-sm text-gray-800 dark:text-zinc-200 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:border-cyan-500/50 focus:outline-none resize-y font-mono"
            data-testid="course-content-input"
          />
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex items-center gap-3 pb-8">
        <Button
          data-testid="save-course-btn"
          onClick={handleSubmit}
          disabled={saving || !title.trim()}
          className="bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white px-8 py-3 text-base shadow-[0_0_20px_rgba(6,182,212,0.2)]"
        >
          {saving ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Sauvegarde...</>
          ) : (
            <><Save className="w-5 h-5 mr-2" /> {existingCourse ? 'Mettre a jour' : 'Creer le cours'}</>
          )}
        </Button>
        <Button variant="outline" className="border-gray-300 dark:border-zinc-700 text-gray-500 dark:text-zinc-400" onClick={() => navigate('/courses')}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
