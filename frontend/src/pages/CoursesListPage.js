import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BookOpen, Play, PlusCircle, Monitor, Video, Clock,
  Target, Trash2, Pencil, ChevronRight, GraduationCap, ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';

export default function CoursesListPage() {
  const { getAuthHeaders, API, user, activeFormation } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  const formation = user?.role === 'etudiant' ? (user?.formation || 'bts-sio-sisr') : (activeFormation || 'bts-sio-sisr');
  const isAdmin = user?.role === 'admin' || user?.role === 'formateur';

  const fetchCourses = async () => {
    try {
      const headers = getAuthHeaders();
      const res = await axios.get(`${API}/courses?formation=${formation}`, { headers });
      setCourses(res.data || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCourses();
  }, [API, getAuthHeaders, formation]);

  const handleDelete = async (courseId) => {
    if (!window.confirm('Supprimer ce cours ?')) return;
    try {
      await axios.delete(`${API}/courses/${courseId}`, { headers: getAuthHeaders() });
      toast.success('Cours supprime');
      fetchCourses();
    } catch (err) {
      toast.error('Erreur lors de la suppression');
    }
  };

  if (loading) return <div className="text-gray-500 dark:text-zinc-500 text-center py-20">Chargement...</div>;

  return (
    <div className="space-y-6" data-testid="courses-list-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
            Cours <span className="text-gradient">pedagogiques</span>
          </h1>
          <p className="text-gray-500 dark:text-zinc-500 mt-1">
            Consultez les cours avant de demarrer vos travaux pratiques
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => navigate('/courses/create')}
            className="bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white"
            data-testid="create-course-btn"
          >
            <PlusCircle className="w-4 h-4 mr-2" /> Creer un cours
          </Button>
        )}
      </div>

      {courses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {courses.map((course, i) => {
            const courseUrl = course.exercise_id ? `/courses/${course.exercise_id}` : `/courses/view/${course.id}`;
            const editUrl = course.exercise_id
              ? `/courses/create?exercise_id=${course.exercise_id}`
              : `/courses/create?course_id=${course.id}`;
            const categoryLabel = course.exercise_category || course.category || '';

            return (
            <Card
              key={course.id}
              className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none hover:border-cyan-500/30 transition-all cursor-pointer animate-fade-in-up group overflow-hidden"
              style={{ animationDelay: `${i * 0.05}s` }}
              onClick={() => navigate(courseUrl)}
              data-testid={`course-card-${course.id}`}
            >
              {/* Cover Image */}
              {course.cover_image ? (
                <div className="relative h-40 overflow-hidden">
                  <img
                    src={`${API}/images/${course.cover_image}`}
                    alt={course.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4">
                    <h3 className="text-base font-semibold text-white truncate drop-shadow-lg" style={{ fontFamily: 'Space Grotesk' }}>
                      {course.title}
                    </h3>
                    {course.exercise_title ? (
                      <p className="text-xs text-white/70 flex items-center gap-1 mt-0.5">
                        <Monitor className="w-3 h-3" /> Lab: {course.exercise_title}
                      </p>
                    ) : (
                      <p className="text-xs text-white/50 italic mt-0.5">Cours independant</p>
                    )}
                  </div>
                </div>
              ) : null}
              
              <CardContent className={course.cover_image ? "p-4" : "p-5"}>
                <div className="flex items-start gap-4">
                  {!course.cover_image && (
                    <div className="w-12 h-12 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center flex-shrink-0 group-hover:bg-cyan-500/20 transition-colors">
                      <BookOpen className="w-6 h-6 text-cyan-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {!course.cover_image && (
                      <>
                        <h3 className="text-base font-semibold text-gray-800 dark:text-zinc-200 truncate mb-1" style={{ fontFamily: 'Space Grotesk' }}>
                          {course.title}
                        </h3>
                        {course.exercise_title ? (
                          <p className="text-xs text-gray-500 dark:text-zinc-500 mb-2 flex items-center gap-1">
                            <Monitor className="w-3 h-3" /> Lab: {course.exercise_title}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 dark:text-zinc-600 mb-2 italic">Cours independant (pas de lab associe)</p>
                        )}
                      </>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      {course.exercise_id && (
                        <Badge className="bg-orange-500/15 text-orange-400 border-orange-500/30 text-[10px]">
                          <Monitor className="w-3 h-3 mr-1" /> Lab lie
                        </Badge>
                      )}
                      {course.video_filename && (
                        <Badge className="bg-violet-500/15 text-violet-400 border-violet-500/30 text-[10px]">
                          <Video className="w-3 h-3 mr-1" /> Video
                        </Badge>
                      )}
                      {course.images && course.images.length > 0 && (
                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">
                          <ImageIcon className="w-3 h-3 mr-1" /> {course.images.length} img
                        </Badge>
                      )}
                      {course.duration_estimate && (
                        <Badge className="bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border-gray-300 dark:border-zinc-700 text-[10px]">
                          <Clock className="w-3 h-3 mr-1" /> {course.duration_estimate}
                        </Badge>
                      )}
                      {course.objectives?.length > 0 && (
                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                          <Target className="w-3 h-3 mr-1" /> {course.objectives.length} objectif{course.objectives.length > 1 ? 's' : ''}
                        </Badge>
                      )}
                      {categoryLabel && (
                        <Badge className="bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border-gray-300 dark:border-zinc-700 text-[10px]">
                          {categoryLabel}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Button
                      size="sm"
                      className="bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(courseUrl);
                      }}
                    >
                      <Play className="w-3.5 h-3.5 mr-1" /> Voir
                      <ChevronRight className="w-3 h-3 ml-0.5" />
                    </Button>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-500 dark:text-zinc-500 hover:text-cyan-400 px-1.5 h-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(editUrl);
                          }}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-500 dark:text-zinc-500 hover:text-red-400 px-1.5 h-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(course.id);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )})}
        </div>
      ) : (
        <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
          <CardContent className="py-16 text-center">
            <GraduationCap className="w-16 h-16 text-gray-300 dark:text-zinc-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 dark:text-zinc-300 mb-2" style={{ fontFamily: 'Space Grotesk' }}>
              Aucun cours disponible
            </h3>
            <p className="text-sm text-gray-500 dark:text-zinc-500 max-w-md mx-auto">
              {isAdmin
                ? 'Creez des cours pedagogiques pour accompagner vos exercices labs.'
                : 'Les cours pedagogiques seront bientot disponibles pour votre formation.'}
            </p>
            {isAdmin && (
              <Button
                onClick={() => navigate('/courses/create')}
                className="mt-4 bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white"
              >
                <PlusCircle className="w-4 h-4 mr-2" /> Creer un cours
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
