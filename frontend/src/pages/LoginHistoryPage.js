import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Clock, LogIn, GraduationCap, Shield } from 'lucide-react';

const roleColors = {
  admin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  formateur: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  etudiant: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

export default function LoginHistoryPage() {
  const { getAuthHeaders, API } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await axios.get(`${API}/login-history`, { headers: getAuthHeaders() });
        setHistory(res.data || []);
      } catch {}
      setLoading(false);
    };
    fetch();
  }, [API, getAuthHeaders]);

  if (loading) return <div className="th-text-muted text-center py-20">Chargement...</div>;

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "a l'instant";
    if (mins < 60) return `il y a ${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    return `il y a ${days}j`;
  };

  return (
    <div className="space-y-6" data-testid="login-history-page">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
          Historique des <span className="text-gradient">connexions</span>
        </h1>
        <p className="th-text-muted mt-1">{history.length} connexion{history.length !== 1 ? 's' : ''} enregistree{history.length !== 1 ? 's' : ''}</p>
      </div>

      <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-200 dark:border-zinc-800 hover:bg-transparent">
                <TableHead className="th-text-faint text-xs font-mono uppercase">Utilisateur</TableHead>
                <TableHead className="th-text-faint text-xs font-mono uppercase">Role</TableHead>
                <TableHead className="th-text-faint text-xs font-mono uppercase">Date & Heure</TableHead>
                <TableHead className="th-text-faint text-xs font-mono uppercase">Il y a</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((h) => (
                <TableRow key={h.id} className="border-gray-200 dark:border-zinc-800">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 flex items-center justify-center text-xs font-medium th-text-secondary">
                        {h.user_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="text-sm font-medium th-text">{h.user_name}</p>
                        <p className="text-xs th-text-faint">{h.user_email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={roleColors[h.role] || 'th-badge'}>{h.role}</Badge>
                  </TableCell>
                  <TableCell className="text-sm th-text-secondary">
                    {new Date(h.logged_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })} a {new Date(h.logged_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                  <TableCell className="text-sm th-text-muted">
                    {timeAgo(h.logged_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {history.length === 0 && (
            <div className="text-center py-12">
              <LogIn className="w-10 h-10 th-text-faint mx-auto mb-2" />
              <p className="th-text-muted">Aucune connexion enregistree</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
