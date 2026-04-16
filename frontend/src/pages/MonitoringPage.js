import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Activity, Shield, AlertTriangle, Users, Database, Server,
  Wifi, Clock, Eye, RefreshCw, Globe, Monitor, Lock, XCircle, CheckCircle2
} from 'lucide-react';

export default function MonitoringPage() {
  const { getAuthHeaders, API } = useAuth();
  const [serverStats, setServerStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [bruteForce, setBruteForce] = useState(null);
  const [loginHistory, setLoginHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchAll = async () => {
    try {
      const headers = getAuthHeaders();
      const [statsRes, sessionsRes, bfRes, historyRes] = await Promise.all([
        axios.get(`${API}/monitoring/server-stats`, { headers }),
        axios.get(`${API}/monitoring/active-sessions`, { headers }),
        axios.get(`${API}/monitoring/brute-force`, { headers }),
        axios.get(`${API}/login-history`, { headers }),
      ]);
      setServerStats(statsRes.data);
      setSessions(sessionsRes.data || []);
      setBruteForce(bfRes.data);
      setLoginHistory(historyRes.data || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const timeAgo = (dateStr) => {
    if (!dateStr) return '-';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "a l'instant";
    if (mins < 60) return `${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}j`;
  };

  if (loading) return <div className="th-text-muted text-center py-20">Chargement du monitoring...</div>;

  const tabs = [
    { id: 'overview', label: 'Vue generale', icon: Activity },
    { id: 'sessions', label: 'Sessions actives', icon: Users },
    { id: 'security', label: 'Securite', icon: Shield },
    { id: 'history', label: 'Historique', icon: Clock },
  ];

  const db = serverStats?.database || {};
  const srv = serverStats?.server || {};
  const bf = bruteForce || {};

  return (
    <div className="space-y-6" data-testid="monitoring-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
            <span className="text-gradient">Monitoring</span> Serveur
          </h1>
          <p className="th-text-muted mt-1">Surveillance technique de la plateforme</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchAll(); }} className="border-gray-300 dark:border-zinc-700 th-text-muted hover:text-cyan-400">
          <RefreshCw className="w-4 h-4 mr-2" /> Actualiser
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-cyan-500/15 text-cyan-500 border border-cyan-500/30'
                : 'bg-gray-100 dark:bg-zinc-800/50 th-text-muted border border-gray-200 dark:border-zinc-800 hover:border-cyan-500/20'
            }`}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Server Info */}
          <Card className="bg-white/90 dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-cyan-400" style={{ fontFamily: 'Space Grotesk' }}>
                <Server className="w-4 h-4" /> Informations Serveur
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg border border-gray-200 dark:border-zinc-700">
                  <p className="text-[10px] font-mono th-text-faint uppercase">OS</p>
                  <p className="text-sm font-medium th-text mt-1">{srv.os || '-'}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg border border-gray-200 dark:border-zinc-700">
                  <p className="text-[10px] font-mono th-text-faint uppercase">Python</p>
                  <p className="text-sm font-medium th-text mt-1">{srv.python_version || '-'}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg border border-gray-200 dark:border-zinc-700">
                  <p className="text-[10px] font-mono th-text-faint uppercase">Hostname</p>
                  <p className="text-sm font-medium th-text mt-1 truncate">{srv.hostname || '-'}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg border border-gray-200 dark:border-zinc-700">
                  <p className="text-[10px] font-mono th-text-faint uppercase">Architecture</p>
                  <p className="text-sm font-medium th-text mt-1">{srv.architecture || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { label: 'Utilisateurs', value: db.total_users, icon: Users, color: 'text-cyan-400' },
              { label: 'Etudiants', value: db.total_students, icon: Users, color: 'text-emerald-400' },
              { label: 'Exercices', value: db.total_exercises, icon: Monitor, color: 'text-violet-400' },
              { label: 'Soumissions', value: db.total_submissions, icon: Database, color: 'text-amber-400' },
              { label: 'Sessions actives', value: db.active_sessions, icon: Wifi, color: 'text-green-400' },
              { label: 'Cours', value: db.total_courses, icon: Globe, color: 'text-blue-400' },
            ].map((s, i) => (
              <Card key={i} className="bg-white/90 dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-800 hover-lift">
                <CardContent className="p-4 text-center">
                  <s.icon className={`w-5 h-5 ${s.color} mx-auto mb-2`} />
                  <p className="text-2xl font-bold th-text" style={{ fontFamily: 'Space Grotesk' }}>{s.value || 0}</p>
                  <p className="text-[10px] font-mono th-text-faint uppercase mt-1">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Security Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className={`border-2 ${bf.total_failed_24h > 10 ? 'border-red-500/30 bg-red-50 dark:bg-red-900/10' : 'border-emerald-500/30 bg-emerald-50 dark:bg-emerald-900/10'}`}>
              <CardContent className="p-5 text-center">
                <Lock className={`w-8 h-8 mx-auto mb-2 ${bf.total_failed_24h > 10 ? 'text-red-500' : 'text-emerald-500'}`} />
                <p className="text-3xl font-bold" style={{ fontFamily: 'Space Grotesk', color: bf.total_failed_24h > 10 ? '#ef4444' : '#10b981' }}>{bf.total_failed_24h || 0}</p>
                <p className="text-sm th-text-muted">Echecs login (24h)</p>
              </CardContent>
            </Card>
            <Card className="border-2 border-cyan-500/30 bg-cyan-50 dark:bg-cyan-900/10">
              <CardContent className="p-5 text-center">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-cyan-500" />
                <p className="text-3xl font-bold text-cyan-500" style={{ fontFamily: 'Space Grotesk' }}>{bf.total_success_24h || 0}</p>
                <p className="text-sm th-text-muted">Connexions reussies (24h)</p>
              </CardContent>
            </Card>
            <Card className={`border-2 ${(bf.suspicious_ips?.length || 0) > 0 ? 'border-red-500/30 bg-red-50 dark:bg-red-900/10' : 'border-emerald-500/30 bg-emerald-50 dark:bg-emerald-900/10'}`}>
              <CardContent className="p-5 text-center">
                <AlertTriangle className={`w-8 h-8 mx-auto mb-2 ${(bf.suspicious_ips?.length || 0) > 0 ? 'text-red-500' : 'text-emerald-500'}`} />
                <p className="text-3xl font-bold" style={{ fontFamily: 'Space Grotesk', color: (bf.suspicious_ips?.length || 0) > 0 ? '#ef4444' : '#10b981' }}>{bf.suspicious_ips?.length || 0}</p>
                <p className="text-sm th-text-muted">IPs suspectes</p>
              </CardContent>
            </Card>
          </div>

          {/* DB Collections */}
          <Card className="bg-white/90 dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-violet-400" style={{ fontFamily: 'Space Grotesk' }}>
                <Database className="w-4 h-4" /> Collections MongoDB
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {Object.entries(db.collections || {}).map(([name, count]) => (
                  <div key={name} className="p-2 bg-gray-50 dark:bg-zinc-800/30 rounded-lg border border-gray-200 dark:border-zinc-700 text-center">
                    <p className="text-lg font-bold th-text" style={{ fontFamily: 'Space Grotesk' }}>{count}</p>
                    <p className="text-[9px] font-mono th-text-faint truncate">{name}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sessions Tab */}
      {activeTab === 'sessions' && (
        <Card className="bg-white/90 dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-green-400" style={{ fontFamily: 'Space Grotesk' }}>
              <Wifi className="w-4 h-4" /> Sessions actives
              <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-[10px]">{sessions.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200 dark:border-zinc-800">
                  <TableHead className="th-text-faint text-xs font-mono uppercase">Utilisateur</TableHead>
                  <TableHead className="th-text-faint text-xs font-mono uppercase">Role</TableHead>
                  <TableHead className="th-text-faint text-xs font-mono uppercase">IP</TableHead>
                  <TableHead className="th-text-faint text-xs font-mono uppercase">User-Agent</TableHead>
                  <TableHead className="th-text-faint text-xs font-mono uppercase">Derniere activite</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s, i) => (
                  <TableRow key={i} className="border-gray-200 dark:border-zinc-800">
                    <TableCell>
                      <p className="text-sm font-medium th-text">{s.user_name}</p>
                      <p className="text-xs th-text-faint">{s.user_email}</p>
                    </TableCell>
                    <TableCell><Badge className="text-xs">{s.role}</Badge></TableCell>
                    <TableCell className="font-mono text-sm th-text-secondary">{s.ip || '-'}</TableCell>
                    <TableCell className="text-xs th-text-faint max-w-[200px] truncate">{s.user_agent || '-'}</TableCell>
                    <TableCell className="text-sm th-text-muted">{timeAgo(s.last_seen)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {sessions.length === 0 && <p className="text-center py-8 th-text-muted">Aucune session active</p>}
          </CardContent>
        </Card>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Brute Force Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-white/90 dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-red-400" style={{ fontFamily: 'Space Grotesk' }}>
                  <AlertTriangle className="w-4 h-4" /> IPs suspectes (3+ echecs / 24h)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bf.suspicious_ips?.length > 0 ? (
                  <div className="space-y-2">
                    {bf.suspicious_ips.map((ip, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-lg">
                        <span className="font-mono text-sm th-text">{ip.ip}</span>
                        <Badge className="bg-red-500/15 text-red-400 border-red-500/30">{ip.attempts} tentatives</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    <p className="text-sm th-text-muted">Aucune IP suspecte detectee</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-white/90 dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-amber-400" style={{ fontFamily: 'Space Grotesk' }}>
                  <Eye className="w-4 h-4" /> Comptes cibles (3+ echecs / 24h)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bf.suspicious_emails?.length > 0 ? (
                  <div className="space-y-2">
                    {bf.suspicious_emails.map((e, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-lg">
                        <span className="text-sm th-text">{e.email}</span>
                        <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">{e.attempts} echecs</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    <p className="text-sm th-text-muted">Aucun compte cible</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Failed Attempts */}
          <Card className="bg-white/90 dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-red-400" style={{ fontFamily: 'Space Grotesk' }}>
                <XCircle className="w-4 h-4" /> Dernieres tentatives echouees
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-200 dark:border-zinc-800">
                    <TableHead className="th-text-faint text-xs font-mono uppercase">Email tente</TableHead>
                    <TableHead className="th-text-faint text-xs font-mono uppercase">IP</TableHead>
                    <TableHead className="th-text-faint text-xs font-mono uppercase">User-Agent</TableHead>
                    <TableHead className="th-text-faint text-xs font-mono uppercase">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(bf.recent_failed || []).map((f, i) => (
                    <TableRow key={i} className="border-gray-200 dark:border-zinc-800">
                      <TableCell className="text-sm th-text font-medium">{f.email}</TableCell>
                      <TableCell className="font-mono text-sm th-text-secondary">{f.ip}</TableCell>
                      <TableCell className="text-xs th-text-faint max-w-[200px] truncate">{f.user_agent}</TableCell>
                      <TableCell className="text-sm th-text-muted">{timeAgo(f.timestamp)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {(bf.recent_failed || []).length === 0 && <p className="text-center py-8 th-text-muted">Aucune tentative echouee recemment</p>}
            </CardContent>
          </Card>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <Card className="bg-white/90 dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-cyan-400" style={{ fontFamily: 'Space Grotesk' }}>
              <Clock className="w-4 h-4" /> Historique des connexions
              <Badge className="bg-cyan-500/15 text-cyan-400 border-cyan-500/30 text-[10px]">{loginHistory.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200 dark:border-zinc-800">
                  <TableHead className="th-text-faint text-xs font-mono uppercase">Utilisateur</TableHead>
                  <TableHead className="th-text-faint text-xs font-mono uppercase">Role</TableHead>
                  <TableHead className="th-text-faint text-xs font-mono uppercase">IP</TableHead>
                  <TableHead className="th-text-faint text-xs font-mono uppercase">Date & Heure</TableHead>
                  <TableHead className="th-text-faint text-xs font-mono uppercase">Il y a</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loginHistory.map((h, i) => (
                  <TableRow key={i} className="border-gray-200 dark:border-zinc-800">
                    <TableCell>
                      <p className="text-sm font-medium th-text">{h.user_name}</p>
                      <p className="text-xs th-text-faint">{h.user_email}</p>
                    </TableCell>
                    <TableCell><Badge className="text-xs">{h.role}</Badge></TableCell>
                    <TableCell className="font-mono text-sm th-text-secondary">{h.ip || '-'}</TableCell>
                    <TableCell className="text-sm th-text-secondary">
                      {new Date(h.logged_at).toLocaleDateString('fr-FR')} {new Date(h.logged_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell className="text-sm th-text-muted">{timeAgo(h.logged_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
