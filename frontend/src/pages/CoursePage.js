import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BookOpen, Play, ArrowLeft, Clock, Target, CheckCircle2,
  Monitor, AlertCircle, GraduationCap, Video, ChevronRight,
  Loader2, ListChecks, Lightbulb, PlayCircle
} from 'lucide-react';

export default function CoursePage() {
  const { exerciseId } = useParams();
  const { getAuthHeaders, API, user } = useAuth();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [exercise, setExercise] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const videoRef = useRef(null);
  const [videoPlaying, setVideoPlaying] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = getAuthHeaders();
        // Fetch exercise data
        const exRes = await axios.get(`${API}/exercises/${exerciseId}`, { headers });
        setExercise(exRes.data);

        // Fetch course for this exercise
        try {
          const courseRes = await axios.get(`${API}/courses/by-exercise/${exerciseId}`, { headers });
          setCourse(courseRes.data);
        } catch (err) {
          if (err.response?.status === 404) {
            setNotFound(true);
          }
        }
      } catch (err) {
        console.error(err);
        navigate('/labs');
      }
      setLoading(false);
    };
    fetchData();
  }, [exerciseId, API, getAuthHeaders, navigate]);

  const toggleVideo = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setVideoPlaying(true);
      } else {
        videoRef.current.pause();
        setVideoPlaying(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  // If no course found, redirect to lab directly
  if (notFound) {
    navigate(`/labs/${exerciseId}`);
    return null;
  }

  if (!course || !exercise) return null;

  const videoUrl = course.video_filename ? `${API}/videos/${course.video_filename}` : null;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12" data-testid="course-page">
      {/* Back Button */}
      <Button variant="ghost" className="text-zinc-400 hover:text-cyan-400 -ml-3" onClick={() => navigate('/labs')}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Retour aux labs
      </Button>

      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-900/95 to-zinc-900/90 border border-zinc-800">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-violet-500/5" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/3 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-violet-500/3 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative p-8 md:p-10">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Badge className="bg-cyan-500/15 text-cyan-400 border-cyan-500/30">
              <BookOpen className="w-3 h-3 mr-1" /> Cours
            </Badge>
            {exercise.exercise_type === 'lab' && (
              <Badge className="bg-orange-500/15 text-orange-400 border-orange-500/30">
                <Monitor className="w-3 h-3 mr-1" /> Lab pratique
              </Badge>
            )}
            {exercise.time_limit > 0 && (
              <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700">
                <Clock className="w-3 h-3 mr-1" /> {exercise.time_limit} min
              </Badge>
            )}
            {course.duration_estimate && (
              <Badge className="bg-violet-500/15 text-violet-400 border-violet-500/30">
                <Clock className="w-3 h-3 mr-1" /> Lecture: {course.duration_estimate}
              </Badge>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3" style={{ fontFamily: 'Space Grotesk' }}>
            <span className="text-gradient">{course.title}</span>
          </h1>
          
          <p className="text-zinc-400 text-lg max-w-3xl leading-relaxed">
            {exercise.description}
          </p>

          {course.created_by_name && (
            <p className="text-xs text-zinc-600 mt-4">
              Par {course.created_by_name} · {new Date(course.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>
      </div>

      {/* Objectives & Prerequisites */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {course.objectives && course.objectives.length > 0 && (
          <Card className="bg-zinc-900/50 backdrop-blur-md border-zinc-800 hover:border-cyan-500/20 transition-colors">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-cyan-400" style={{ fontFamily: 'Space Grotesk' }}>
                <Target className="w-4 h-4" /> Objectifs du cours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {course.objectives.map((obj, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span>{obj}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {course.prerequisites && course.prerequisites.length > 0 && (
          <Card className="bg-zinc-900/50 backdrop-blur-md border-zinc-800 hover:border-violet-500/20 transition-colors">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-violet-400" style={{ fontFamily: 'Space Grotesk' }}>
                <ListChecks className="w-4 h-4" /> Prerequis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {course.prerequisites.map((pre, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-300">
                    <Lightbulb className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span>{pre}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Video Player */}
      {videoUrl && (
        <Card className="bg-zinc-900/50 backdrop-blur-md border-zinc-800 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-cyan-400" style={{ fontFamily: 'Space Grotesk' }}>
              <Video className="w-4 h-4" /> Video du cours
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative bg-black rounded-b-lg overflow-hidden group">
              <video
                ref={videoRef}
                className="w-full aspect-video"
                controls
                preload="metadata"
                playsInline
                onPlay={() => setVideoPlaying(true)}
                onPause={() => setVideoPlaying(false)}
                data-testid="course-video"
              >
                <source src={videoUrl} type="video/mp4" />
                Votre navigateur ne supporte pas la lecture video.
              </video>
              
              {!videoPlaying && (
                <div
                  className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/30 group-hover:bg-black/20 transition-all"
                  onClick={toggleVideo}
                >
                  <div className="w-20 h-20 rounded-full bg-gradient-to-r from-cyan-600 to-violet-600 flex items-center justify-center shadow-[0_0_40px_rgba(6,182,212,0.3)] hover:shadow-[0_0_60px_rgba(6,182,212,0.5)] transition-all transform hover:scale-105">
                    <PlayCircle className="w-10 h-10 text-white ml-1" />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Course Content */}
      {course.content && (
        <Card className="bg-zinc-900/50 backdrop-blur-md border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-zinc-300" style={{ fontFamily: 'Space Grotesk' }}>
              <BookOpen className="w-4 h-4 text-cyan-400" /> Contenu du cours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className="prose prose-invert prose-sm max-w-none text-zinc-300 leading-relaxed course-content"
              style={{ whiteSpace: 'pre-wrap', lineHeight: '1.8' }}
              data-testid="course-content"
            >
              {course.content.split('\n').map((paragraph, i) => {
                if (!paragraph.trim()) return <br key={i} />;
                
                // Headings (## and ###)
                if (paragraph.startsWith('### ')) {
                  return (
                    <h3 key={i} className="text-base font-semibold text-cyan-400 mt-6 mb-2" style={{ fontFamily: 'Space Grotesk' }}>
                      {paragraph.replace('### ', '')}
                    </h3>
                  );
                }
                if (paragraph.startsWith('## ')) {
                  return (
                    <h2 key={i} className="text-lg font-bold text-zinc-200 mt-8 mb-3" style={{ fontFamily: 'Space Grotesk' }}>
                      {paragraph.replace('## ', '')}
                    </h2>
                  );
                }
                
                // Bullet points
                if (paragraph.startsWith('- ') || paragraph.startsWith('* ')) {
                  return (
                    <div key={i} className="flex items-start gap-2 ml-4 my-1">
                      <span className="text-cyan-500 mt-1.5">•</span>
                      <span>{paragraph.slice(2)}</span>
                    </div>
                  );
                }
                
                // Code blocks (lines starting with `)
                if (paragraph.startsWith('`') && paragraph.endsWith('`')) {
                  return (
                    <code key={i} className="block bg-zinc-800/80 text-emerald-400 px-4 py-2 rounded-lg font-mono text-xs my-2 overflow-x-auto">
                      {paragraph.slice(1, -1)}
                    </code>
                  );
                }

                // Bold text (**text**)
                const parts = paragraph.split(/(\*\*.*?\*\*)/g);
                return (
                  <p key={i} className="my-2">
                    {parts.map((part, j) => {
                      if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={j} className="text-zinc-100 font-semibold">{part.slice(2, -2)}</strong>;
                      }
                      return <span key={j}>{part}</span>;
                    })}
                  </p>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lab instructions if any */}
      {exercise.lab_instructions && (
        <Card className="bg-zinc-900/50 backdrop-blur-md border-amber-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-400" style={{ fontFamily: 'Space Grotesk' }}>
              <AlertCircle className="w-4 h-4" /> Instructions du lab
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {exercise.lab_instructions}
            </div>
          </CardContent>
        </Card>
      )}

      {/* CTA - Start Lab */}
      <div className="sticky bottom-6 z-10">
        <Card className="bg-zinc-950/95 backdrop-blur-xl border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.1)]">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-lg font-semibold text-zinc-200" style={{ fontFamily: 'Space Grotesk' }}>
                  Pret a passer a la pratique ?
                </h3>
                <p className="text-sm text-zinc-500 mt-1">
                  Lancez votre machine virtuelle et mettez en pratique ce que vous avez appris.
                </p>
              </div>
              <Button
                data-testid="start-lab-from-course"
                onClick={() => navigate(`/labs/${exerciseId}`)}
                className="bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white px-8 py-3 text-base shadow-[0_0_20px_rgba(6,182,212,0.25)] hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all min-w-[200px]"
              >
                <Play className="w-5 h-5 mr-2" /> Demarrer le Lab
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
