import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, GraduationCap, Shield } from 'lucide-react';
import { toast } from 'sonner';

const roleColors = {
  admin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  formateur: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  etudiant: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};
const formationBadge = {
  'bts-sio-sisr': { label: 'BTS SISR', cls: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' },
  'bachelor-ais': { label: 'Bachelor AIS', cls: 'bg-violet-500/15 text-violet-400 border-violet-500/30' },
};

export default function UsersPage() {
  const { getAuthHeaders, API, user: currentUser, activeFormation } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterFormation, setFilterFormation] = useState('all');

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API}/users`, { headers: getAuthHeaders() });
      setUsers(res.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const updateUser = async (userId, data) => {
    try {
      await axios.put(`${API}/users/${userId}`, data, { headers: getAuthHeaders() });
      toast.success('Utilisateur mis a jour');
      fetchUsers();
    } catch (err) { toast.error(err.response?.data?.detail || 'Erreur'); }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm('Supprimer cet utilisateur ?')) return;
    try {
      await axios.delete(`${API}/users/${userId}`, { headers: getAuthHeaders() });
      toast.success('Utilisateur supprime');
      setUsers(users.filter(u => u.id !== userId));
    } catch (err) { toast.error(err.response?.data?.detail || 'Erreur'); }
  };

  if (loading) return <div className="text-gray-500 dark:text-zinc-500 text-center py-20">Chargement...</div>;

  const filtered = filterFormation === 'all' ? users : users.filter(u => u.formation === filterFormation);

  return (
    <div className="space-y-6" data-testid="users-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
            <span className="text-gradient">Utilisateurs</span>
          </h1>
          <p className="text-gray-500 dark:text-zinc-500 mt-1">{users.length} utilisateur{users.length !== 1 ? 's' : ''}</p>
        </div>
        <Select value={filterFormation} onValueChange={setFilterFormation}>
          <SelectTrigger className="w-48 bg-gray-50 dark:bg-zinc-900 border-gray-200 dark:border-gray-200 dark:border-zinc-800 text-sm text-gray-800 dark:text-zinc-200" data-testid="filter-formation">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-50 dark:bg-zinc-900 border-gray-200 dark:border-gray-200 dark:border-zinc-800">
            <SelectItem value="all">Toutes les formations</SelectItem>
            <SelectItem value="bts-sio-sisr"><span className="flex items-center gap-2"><GraduationCap className="w-3 h-3 text-cyan-400" /> BTS SIO SISR</span></SelectItem>
            <SelectItem value="bachelor-ais"><span className="flex items-center gap-2"><Shield className="w-3 h-3 text-violet-400" /> Bachelor AIS</span></SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-200 dark:border-zinc-800 hover:bg-transparent">
                <TableHead className="text-gray-500 dark:text-zinc-500 text-xs font-mono uppercase">Utilisateur</TableHead>
                <TableHead className="text-gray-500 dark:text-zinc-500 text-xs font-mono uppercase">Formation</TableHead>
                <TableHead className="text-gray-500 dark:text-zinc-500 text-xs font-mono uppercase">Role</TableHead>
                <TableHead className="text-gray-500 dark:text-zinc-500 text-xs font-mono uppercase">Inscription</TableHead>
                <TableHead className="text-gray-500 dark:text-zinc-500 text-xs font-mono uppercase text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const fBadge = formationBadge[u.formation] || { label: u.formation, cls: 'bg-zinc-800 text-gray-500 dark:text-zinc-400' };
                return (
                  <TableRow key={u.id} className="border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:bg-zinc-800/30" data-testid={`user-row-${u.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 flex items-center justify-center text-xs font-medium text-gray-700 dark:text-zinc-300">{u.full_name?.charAt(0)?.toUpperCase()}</div>
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-zinc-200">{u.full_name}</p>
                          <p className="text-xs text-gray-500 dark:text-zinc-500">@{u.username}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {currentUser?.role === 'admin' && u.id !== currentUser.id ? (
                        <Select value={u.formation || 'bts-sio-sisr'} onValueChange={(val) => updateUser(u.id, { formation: val })}>
                          <SelectTrigger className="w-36 h-7 bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-gray-50 dark:bg-zinc-900 border-gray-200 dark:border-gray-200 dark:border-zinc-800">
                            <SelectItem value="bts-sio-sisr">BTS SIO SISR</SelectItem>
                            <SelectItem value="bachelor-ais">Bachelor AIS</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={fBadge.cls}>{fBadge.label}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {currentUser?.role === 'admin' && u.id !== currentUser.id ? (
                        <Select value={u.role} onValueChange={(val) => updateUser(u.id, { role: val })}>
                          <SelectTrigger className="w-32 h-7 bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-gray-50 dark:bg-zinc-900 border-gray-200 dark:border-gray-200 dark:border-zinc-800">
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="formateur">Formateur</SelectItem>
                            <SelectItem value="etudiant">Etudiant</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={roleColors[u.role]}>{u.role}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500 dark:text-zinc-400">{u.created_at ? new Date(u.created_at).toLocaleDateString('fr-FR') : '-'}</TableCell>
                    <TableCell className="text-right">
                      {currentUser?.role === 'admin' && u.id !== currentUser.id && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => deleteUser(u.id)} data-testid={`delete-user-${u.id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
