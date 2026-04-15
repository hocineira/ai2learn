import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Monitor, Play, Clock, CheckCircle2, Server, BookOpen } from 'lucide-react';

export default function LabsListPage() {
  const { getAuthHeaders, API, user } = useAuth();
  const navigate = useNavigate();
  const [labs, setLabs] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [courses, setCourses] = useState({});
  const [loading, setLoading] = useState(true);

  const formation = user?.formation || 'bts-sio-sisr';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = getAuthHeaders();
        const exRes = await axios.get(`${API}/exercises?formation=${formation}`, { headers });
        const labExercises = (exRes.data || []).filter(e => e.exercise_type === 'lab');
        setExercises(labExercises);

        // Check active labs for each
        const labStatuses = await Promise.all(
          labExercises.map(async (ex) => {
            try {
              const res = await axios.get(`${API}/labs/status/${ex.id}`, { headers });
              return { exerciseId: ex.id, ...res.data };
            } catch {
              return { exerciseId: ex.id, status: 'not_started' };
            }
          })
        );
        setLabs(labStatuses);

        // Check which exercises have courses
        const courseMap = {};
        await Promise.all(
          labExercises.map(async (ex) => {
            try {
              await axios.get(`${API}/courses/by-exercise/${ex.id}`, { headers });
              courseMap[ex.id] = true;
            } catch {
              courseMap[ex.id] = false;
            }
          })
        );
        setCourses(courseMap);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    fetchData();
  }, [API, getAuthHeaders, formation]);

  if (loading) return <div className="text-zinc-500 text-center py-20">Chargement...</div>;

  const getLabStatus = (exerciseId) => {
    return labs.find(l => l.exerciseId === exerciseId) || { status: 'not_started' };
  };

  return (
    <div className="space-y-6" data-testid="labs-list-page">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
          Labs <span className="text-gradient">pratiques</span>
        </h1>
        <p className="text-zinc-500 mt-1">
          Environnements virtuels Windows Server pour vos travaux pratiques
        </p>
      </div>

      {exercises.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {exercises.map((ex, i) => {
            const labStatus = getLabStatus(ex.id);
            const isRunning = labStatus.status === 'running';
            const hasCourse = courses[ex.id] === true;

            return (
              <Card
                key={ex.id}
                className={`bg-zinc-900/50 backdrop-blur-md border-zinc-800 hover:border-orange-500/30 transition-all cursor-pointer animate-fade-in-up ${isRunning ? 'border-emerald-500/30' : ''}`}
                style={{ animationDelay: `${i * 0.05}s` }}
                onClick={() => {
                  // If course exists and lab not yet running, go to course first
                  if (hasCourse && !isRunning) {
                    navigate(`/courses/${ex.id}`);
                  } else {
                    navigate(`/labs/${ex.id}`);
                  }
                }}
                data-testid={`lab-card-${ex.id}`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-lg ${isRunning ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-orange-500/10 border-orange-500/30'} border flex items-center justify-center flex-shrink-0`}>
                      <Monitor className={`w-6 h-6 ${isRunning ? 'text-emerald-400' : 'text-orange-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-semibold text-zinc-200 truncate" style={{ fontFamily: 'Space Grotesk' }}>
                          {ex.title}
                        </h3>
                      </div>
                      <p className="text-sm text-zinc-500 line-clamp-2 mb-3">{ex.description}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px]">
                          <Server className="w-3 h-3 mr-1" /> VM Windows
                        </Badge>
                        {hasCourse && (
                          <Badge className="bg-cyan-500/15 text-cyan-400 border-cyan-500/30 text-[10px]">
                            <BookOpen className="w-3 h-3 mr-1" /> Cours disponible
                          </Badge>
                        )}
                        <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700 text-[10px]">
                          {ex.category}
                        </Badge>
                        {ex.time_limit > 0 && (
                          <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700 text-[10px]">
                            <Clock className="w-3 h-3 mr-1" /> {ex.time_limit} min
                          </Badge>
                        )}
                        {isRunning && (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> En cours
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className={isRunning ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : hasCourse ? 'bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white' : 'bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white'}
                    >
                      {isRunning ? (
                        <><CheckCircle2 className="w-4 h-4 mr-1" /> Acceder</>
                      ) : hasCourse ? (
                        <><BookOpen className="w-4 h-4 mr-1" /> Cours</>
                      ) : (
                        <><Play className="w-4 h-4 mr-1" /> Demarrer</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="bg-zinc-900/50 backdrop-blur-md border-zinc-800">
          <CardContent className="py-16 text-center">
            <Monitor className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-zinc-300 mb-2" style={{ fontFamily: 'Space Grotesk' }}>
              Aucun lab disponible
            </h3>
            <p className="text-sm text-zinc-500 max-w-md mx-auto">
              Les labs pratiques avec des machines virtuelles Windows Server seront bientot disponibles pour votre formation.
              Contactez votre formateur pour plus d'informations.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
