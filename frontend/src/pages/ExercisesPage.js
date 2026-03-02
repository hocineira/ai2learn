import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, Clock, Server, Network, Shield, Cpu, Database, Terminal, PlusCircle, ShieldCheck, Cloud, Activity, LayoutDashboard, ClipboardList, ScanEye, Cog, GraduationCap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const iconMap = {
  Server, Network, Shield, Cpu, Database, Terminal, ShieldCheck, Cloud, Activity,
  LayoutDashboard, ClipboardList, ScanEye, Cog, BookOpen, GraduationCap,
};

export default function ExercisesPage() {
  const { getAuthHeaders, API, user, activeFormation } = useAuth();
  const navigate = useNavigate();
  const [exercises, setExercises] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(true);

  const formation = user?.role === 'etudiant' ? user.formation : activeFormation;

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const headers = getAuthHeaders();
        const [exRes, catRes] = await Promise.all([
          axios.get(`${API}/exercises?formation=${formation || ''}`, { headers }),
          axios.get(`${API}/categories?formation=${formation || ''}`, { headers }),
        ]);
        setExercises(exRes.data);
        setCategories(catRes.data);
        if (user?.role === 'etudiant') {
          const subRes = await axios.get(`${API}/submissions`, { headers });
          setSubmissions(subRes.data);
        }
      } catch (err) { console.error(err); }
      setLoading(false);
      setActiveCategory('all');
    };
    fetchAll();
  }, [API, getAuthHeaders, user, formation]);

  const filtered = activeCategory === 'all' ? exercises : exercises.filter(e => e.category === activeCategory);
  const completedIds = new Set(submissions.map(s => s.exercise_id));

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cet exercice ?')) return;
    try {
      await axios.delete(`${API}/exercises/${id}`, { headers: getAuthHeaders() });
      setExercises(exercises.filter(e => e.id !== id));
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="text-zinc-500 text-center py-20">Chargement...</div>;

  const formationLabel = formation === 'bachelor-ais' ? 'Bachelor AIS' : 'BTS SIO SISR';

  return (
    <div className="space-y-6" data-testid="exercises-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
            <span className="text-gradient">Exercices</span>
          </h1>
          <p className="text-zinc-500 mt-1">{formationLabel} - {exercises.length} exercice{exercises.length !== 1 ? 's' : ''}</p>
        </div>
        {user?.role !== 'etudiant' && (
          <Button data-testid="create-exercise-btn" onClick={() => navigate('/exercises/create')} className="bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white">
            <PlusCircle className="w-4 h-4 mr-2" /> Creer
          </Button>
        )}
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="bg-zinc-900 border border-zinc-800 p-1 flex-wrap h-auto gap-1">
          <TabsTrigger value="all" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 text-xs">Tous</TabsTrigger>
          {categories.map((cat) => {
            const Icon = iconMap[cat.icon] || BookOpen;
            return (
              <TabsTrigger key={cat.id} value={cat.id} className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 text-xs flex items-center gap-1">
                <Icon className="w-3 h-3" /> {cat.name}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((ex, i) => {
          const catMeta = categories.find(c => c.id === ex.category);
          const Icon = catMeta ? (iconMap[catMeta.icon] || BookOpen) : BookOpen;
          const isCompleted = completedIds.has(ex.id);
          return (
            <Card key={ex.id} className="group relative overflow-hidden bg-zinc-900 border border-zinc-800 hover:border-cyan-500/50 transition-all duration-300 cursor-pointer animate-fade-in-up"
              style={{ animationDelay: `${i * 0.05}s` }} onClick={() => navigate(`/exercises/${ex.id}`)} data-testid={`exercise-card-${ex.id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="flex gap-1">
                    {isCompleted && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">Complete</Badge>}
                    {ex.shared && <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-[10px]">Partage</Badge>}
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-zinc-200 group-hover:text-cyan-400 transition-colors mb-1" style={{ fontFamily: 'Space Grotesk' }}>{ex.title}</h3>
                <p className="text-xs text-zinc-500 line-clamp-2 mb-3">{ex.description}</p>
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <span>{ex.questions?.length} Q</span>
                  {ex.time_limit > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {ex.time_limit}min</span>}
                  <span>{ex.submission_count} soum.</span>
                </div>
                {user?.role !== 'etudiant' && (
                  <div className="mt-3 pt-3 border-t border-zinc-800 flex gap-2">
                    <Button size="sm" variant="ghost" className="text-xs text-zinc-400 hover:text-cyan-400 h-7" onClick={(e) => { e.stopPropagation(); navigate(`/exercises/edit/${ex.id}`); }}>Modifier</Button>
                    <Button size="sm" variant="ghost" className="text-xs text-red-400 hover:text-red-300 h-7" onClick={(e) => { e.stopPropagation(); handleDelete(ex.id); }}>Supprimer</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <BookOpen className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500">Aucun exercice dans cette categorie</p>
        </div>
      )}
    </div>
  );
}
