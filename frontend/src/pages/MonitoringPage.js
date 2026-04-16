import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Activity, Shield, AlertTriangle, Users, Database, Server,
  Wifi, Clock, Eye, RefreshCw, Globe, Monitor, Lock, XCircle, CheckCircle2,
  Download, Package, ArrowUpCircle, FileText, ChevronDown, ChevronRight,
  Loader2, HardDrive, Cpu, MemoryStick, History, Search, Play
} from 'lucide-react';

export default function MonitoringPage() {
  const { getAuthHeaders, API } = useAuth();
  const [serverStats, setServerStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [bruteForce, setBruteForce] = useState(null);
  const [loginHistory, setLoginHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // System updates state
  const [updates, setUpdates] = useState(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [applyingUpdates, setApplyingUpdates] = useState(false);
  const [updateHistory, setUpdateHistory] = useState([]);
  const [systemInfo, setSystemInfo] = useState(null);
  const [selectedPackages, setSelectedPackages] = useState([]);
  const [expandedChangelog, setExpandedChangelog] = useState(null);
  const [changelog, setChangelog] = useState(null);
  const [loadingChangelog, setLoadingChangelog] = useState(false);
  const [expandedUpdate, setExpandedUpdate] = useState(null);
  const [updateDetail, setUpdateDetail] = useState(null);

  const fetchAll = useCallback(async () => {
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
  }, [API, getAuthHeaders]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Fetch system info and update history when updates tab is selected
  useEffect(() => {
    if (activeTab === 'updates') {
      fetchSystemInfo();
      fetchUpdateHistory();
    }
  }, [activeTab]);

  const fetchSystemInfo = async () => {
    try {
      const res = await axios.get(`${API}/system/info`, { headers: getAuthHeaders() });
      setSystemInfo(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchUpdateHistory = async () => {
    try {
      const res = await axios.get(`${API}/system/update-history`, { headers: getAuthHeaders() });
      setUpdateHistory(res.data || []);
    } catch (err) { console.error(err); }
  };

  const handleCheckUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const res = await axios.get(`${API}/system/check-updates`, { headers: getAuthHeaders() });
      setUpdates(res.data);
      setSelectedPackages([]);
    } catch (err) { console.error(err); }
    setCheckingUpdates(false);
  };

  const handleApplyUpdates = async (packages = null) => {
    if (!window.confirm(
      packages && packages.length > 0
        ? `Mettre a jour ${packages.length} paquet(s) selectionne(s) ?`
        : 'Mettre a jour TOUS les paquets disponibles ?'
    )) return;

    setApplyingUpdates(true);
    try {
      const res = await axios.post(`${API}/system/apply-updates`, {
        packages: packages && packages.length > 0 ? packages : null,
      }, { headers: getAuthHeaders() });

      setUpdates(null);
      setSelectedPackages([]);
      fetchUpdateHistory();

      // Show result
      if (res.data.status === 'success') {
        alert(`Mise a jour terminee avec succes !\n${res.data.packages_updated} paquet(s) mis a jour.`);
      } else {
        alert(`Erreur lors de la mise a jour.\n${res.data.error}`);
      }
    } catch (err) {
      alert('Erreur: ' + (err.response?.data?.detail || err.message));
    }
    setApplyingUpdates(false);
  };

  const handleFetchChangelog = async (packageName) => {
    if (expandedChangelog === packageName) {
      setExpandedChangelog(null);
      setChangelog(null);
      return;
    }
    setExpandedChangelog(packageName);
    setLoadingChangelog(true);
    try {
      const res = await axios.get(`${API}/system/changelog/${packageName}`, { headers: getAuthHeaders() });
      setChangelog(res.data);
    } catch (err) {
      setChangelog({ available: false, entries: [], changelog_raw: 'Erreur lors du chargement' });
    }
    setLoadingChangelog(false);
  };

  const handleFetchUpdateDetail = async (updateId) => {
    if (expandedUpdate === updateId) {
      setExpandedUpdate(null);
      setUpdateDetail(null);
      return;
    }
    setExpandedUpdate(updateId);
    try {
      const res = await axios.get(`${API}/system/update-detail/${updateId}`, { headers: getAuthHeaders() });
      setUpdateDetail(res.data);
    } catch (err) { console.error(err); }
  };

  const togglePackageSelection = (pkgName) => {
    setSelectedPackages(prev =>
      prev.includes(pkgName) ? prev.filter(p => p !== pkgName) : [...prev, pkgName]
    );
  };

  const selectAllPackages = () => {
    if (!updates?.packages) return;
    if (selectedPackages.length === updates.packages.length) {
      setSelectedPackages([]);
    } else {
      setSelectedPackages(updates.packages.map(p => p.name));
    }
  };

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
    { id: 'updates', label: 'Mises a jour', icon: ArrowUpCircle },
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
            data-testid={`tab-${tab.id}`}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-cyan-500/15 text-cyan-500 border border-cyan-500/30'
                : 'bg-gray-100 dark:bg-zinc-800/50 th-text-muted border border-gray-200 dark:border-zinc-800 hover:border-cyan-500/20'
            }`}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
            {tab.id === 'updates' && updates?.total_upgradable > 0 && (
              <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] ml-1">{updates.total_upgradable}</Badge>
            )}
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

      {/* UPDATES TAB */}
      {activeTab === 'updates' && (
        <div className="space-y-6">
          {/* System Info Cards */}
          {systemInfo && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              <Card className="bg-white/90 dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Server className="w-4 h-4 text-cyan-400" />
                    <p className="text-[10px] font-mono th-text-faint uppercase">Systeme</p>
                  </div>
                  <p className="text-sm font-medium th-text">{systemInfo.os_description || systemInfo.os}</p>
                  <p className="text-xs th-text-faint mt-1">Kernel {systemInfo.kernel || '-'}</p>
                </CardContent>
              </Card>
              <Card className="bg-white/90 dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <p className="text-[10px] font-mono th-text-faint uppercase">Uptime</p>
                  </div>
                  <p className="text-sm font-medium th-text">{systemInfo.uptime || '-'}</p>
                </CardContent>
              </Card>
              <Card className="bg-white/90 dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <HardDrive className="w-4 h-4 text-violet-400" />
                    <p className="text-[10px] font-mono th-text-faint uppercase">Disque</p>
                  </div>
                  <p className="text-sm font-medium th-text">{systemInfo.disk?.used || '-'} / {systemInfo.disk?.total || '-'}</p>
                  <p className="text-xs th-text-faint mt-1">{systemInfo.disk?.usage_percent || '-'} utilise</p>
                </CardContent>
              </Card>
              <Card className="bg-white/90 dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Cpu className="w-4 h-4 text-amber-400" />
                    <p className="text-[10px] font-mono th-text-faint uppercase">Memoire</p>
                  </div>
                  <p className="text-sm font-medium th-text">{systemInfo.memory?.used || '-'} / {systemInfo.memory?.total || '-'}</p>
                </CardContent>
              </Card>
              <Card className="bg-white/90 dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-4 h-4 text-blue-400" />
                    <p className="text-[10px] font-mono th-text-faint uppercase">Paquets</p>
                  </div>
                  <p className="text-sm font-medium th-text">{systemInfo.installed_packages || '-'}</p>
                  <p className="text-xs th-text-faint mt-1">installes</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Check for Updates */}
          <Card className="bg-white/90 dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle className="text-sm flex items-center gap-2 text-cyan-400" style={{ fontFamily: 'Space Grotesk' }}>
                  <Search className="w-4 h-4" /> Rechercher des mises a jour
                </CardTitle>
                <div className="flex items-center gap-2">
                  {updates && updates.total_upgradable > 0 && (
                    <>
                      {selectedPackages.length > 0 && (
                        <Button
                          size="sm"
                          onClick={() => handleApplyUpdates(selectedPackages)}
                          disabled={applyingUpdates}
                          className="bg-violet-600 hover:bg-violet-500 text-white h-8"
                        >
                          {applyingUpdates ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1" />}
                          Installer ({selectedPackages.length})
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => handleApplyUpdates(null)}
                        disabled={applyingUpdates}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white h-8"
                        data-testid="apply-all-updates"
                      >
                        {applyingUpdates ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <ArrowUpCircle className="w-3.5 h-3.5 mr-1" />}
                        Tout mettre a jour
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCheckUpdates}
                    disabled={checkingUpdates}
                    className="border-cyan-500/30 text-cyan-500 hover:bg-cyan-500/10 h-8"
                    data-testid="check-updates"
                  >
                    {checkingUpdates ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
                    Rechercher
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!updates && !checkingUpdates && (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 th-text-faint mx-auto mb-4" />
                  <p className="th-text-muted text-sm">Cliquez sur "Rechercher" pour verifier les mises a jour disponibles</p>
                  <p className="th-text-faint text-xs mt-1">Cela va executer apt update et lister les paquets disponibles</p>
                </div>
              )}

              {checkingUpdates && (
                <div className="text-center py-12">
                  <Loader2 className="w-10 h-10 text-cyan-400 mx-auto mb-4 animate-spin" />
                  <p className="th-text-muted text-sm">Recherche des mises a jour en cours...</p>
                  <p className="th-text-faint text-xs mt-1">Execution de apt update...</p>
                </div>
              )}

              {applyingUpdates && (
                <div className="text-center py-12">
                  <Loader2 className="w-10 h-10 text-emerald-400 mx-auto mb-4 animate-spin" />
                  <p className="th-text-muted text-sm">Installation des mises a jour en cours...</p>
                  <p className="th-text-faint text-xs mt-1">Cela peut prendre quelques minutes...</p>
                </div>
              )}

              {updates && !checkingUpdates && !applyingUpdates && (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                      updates.total_upgradable > 0
                        ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/30'
                        : 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/30'
                    }`}>
                      {updates.total_upgradable > 0 ? (
                        <ArrowUpCircle className="w-5 h-5 text-amber-500" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      )}
                      <span className="text-sm font-medium th-text">
                        {updates.total_upgradable > 0
                          ? `${updates.total_upgradable} mise(s) a jour disponible(s)`
                          : 'Systeme a jour'}
                      </span>
                    </div>
                    {updates.last_cache_update && (
                      <p className="text-xs th-text-faint">
                        Derniere verification : {timeAgo(updates.last_cache_update)}
                      </p>
                    )}
                  </div>

                  {/* Packages Table */}
                  {updates.packages.length > 0 && (
                    <div className="border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/30">
                            <TableHead className="w-10">
                              <input
                                type="checkbox"
                                checked={selectedPackages.length === updates.packages.length && updates.packages.length > 0}
                                onChange={selectAllPackages}
                                className="rounded border-gray-300 dark:border-zinc-600"
                              />
                            </TableHead>
                            <TableHead className="th-text-faint text-xs font-mono uppercase">Paquet</TableHead>
                            <TableHead className="th-text-faint text-xs font-mono uppercase">Version actuelle</TableHead>
                            <TableHead className="th-text-faint text-xs font-mono uppercase">Nouvelle version</TableHead>
                            <TableHead className="th-text-faint text-xs font-mono uppercase">Source</TableHead>
                            <TableHead className="th-text-faint text-xs font-mono uppercase w-24">Patch notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {updates.packages.map((pkg) => (
                            <React.Fragment key={pkg.name}>
                              <TableRow className="border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/20">
                                <TableCell>
                                  <input
                                    type="checkbox"
                                    checked={selectedPackages.includes(pkg.name)}
                                    onChange={() => togglePackageSelection(pkg.name)}
                                    className="rounded border-gray-300 dark:border-zinc-600"
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Package className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                                    <span className="text-sm font-medium th-text font-mono">{pkg.name}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="font-mono text-xs th-text-muted">{pkg.current_version}</TableCell>
                                <TableCell>
                                  <span className="font-mono text-xs text-emerald-500 dark:text-emerald-400">{pkg.new_version}</span>
                                </TableCell>
                                <TableCell>
                                  <Badge className="bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 border-gray-200 dark:border-zinc-700 text-[10px]">
                                    {pkg.source}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleFetchChangelog(pkg.name)}
                                    className="h-7 px-2 text-xs th-text-muted hover:text-cyan-400"
                                  >
                                    {expandedChangelog === pkg.name ? (
                                      <ChevronDown className="w-3.5 h-3.5 mr-1" />
                                    ) : (
                                      <ChevronRight className="w-3.5 h-3.5 mr-1" />
                                    )}
                                    <FileText className="w-3.5 h-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                              {/* Changelog expanded row */}
                              {expandedChangelog === pkg.name && (
                                <TableRow className="border-gray-200 dark:border-zinc-800">
                                  <TableCell colSpan={6} className="p-0">
                                    <div className="p-4 bg-gray-50 dark:bg-zinc-800/30 border-t border-gray-200 dark:border-zinc-700">
                                      {loadingChangelog ? (
                                        <div className="flex items-center gap-2 py-4 justify-center">
                                          <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                                          <span className="text-sm th-text-muted">Chargement du changelog...</span>
                                        </div>
                                      ) : changelog ? (
                                        <div className="space-y-3">
                                          <h4 className="text-sm font-semibold th-text flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-cyan-400" />
                                            Patch notes - {pkg.name}
                                          </h4>
                                          {changelog.entries && changelog.entries.length > 0 ? (
                                            <div className="space-y-3 max-h-80 overflow-y-auto">
                                              {changelog.entries.map((entry, idx) => (
                                                <div key={idx} className="p-3 bg-white dark:bg-zinc-900/50 rounded-lg border border-gray-200 dark:border-zinc-700">
                                                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                    <Badge className="bg-cyan-500/15 text-cyan-500 border-cyan-500/30 text-[10px]">
                                                      v{entry.version}
                                                    </Badge>
                                                    <Badge className={`text-[10px] ${
                                                      entry.urgency === 'high' || entry.urgency === 'critical'
                                                        ? 'bg-red-500/15 text-red-400 border-red-500/30'
                                                        : entry.urgency === 'medium'
                                                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                                          : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border-gray-200 dark:border-zinc-700'
                                                    }`}>
                                                      {entry.urgency}
                                                    </Badge>
                                                    {entry.distribution && (
                                                      <span className="text-[10px] th-text-faint">{entry.distribution}</span>
                                                    )}
                                                  </div>
                                                  {entry.changes.length > 0 && (
                                                    <ul className="space-y-1 ml-2">
                                                      {entry.changes.map((change, ci) => (
                                                        <li key={ci} className="text-xs th-text-secondary flex gap-2">
                                                          <span className="text-cyan-400 flex-shrink-0">•</span>
                                                          <span>{change}</span>
                                                        </li>
                                                      ))}
                                                    </ul>
                                                  )}
                                                  {entry.date && (
                                                    <p className="text-[10px] th-text-faint mt-2">{entry.date}</p>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <div className="p-3 bg-white dark:bg-zinc-900/50 rounded-lg border border-gray-200 dark:border-zinc-700">
                                              <pre className="text-xs th-text-secondary whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
                                                {changelog.changelog_raw || 'Aucun changelog disponible'}
                                              </pre>
                                            </div>
                                          )}
                                        </div>
                                      ) : null}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Update History */}
          <Card className="bg-white/90 dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-violet-400" style={{ fontFamily: 'Space Grotesk' }}>
                <History className="w-4 h-4" /> Historique des mises a jour
                {updateHistory.length > 0 && (
                  <Badge className="bg-violet-500/15 text-violet-400 border-violet-500/30 text-[10px]">{updateHistory.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {updateHistory.length === 0 ? (
                <div className="text-center py-8">
                  <History className="w-8 h-8 th-text-faint mx-auto mb-2" />
                  <p className="text-sm th-text-muted">Aucune mise a jour appliquee depuis le panel</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {updateHistory.map((upd) => (
                    <div key={upd.id} className="border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                      <button
                        onClick={() => handleFetchUpdateDetail(upd.id)}
                        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-zinc-800/20 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {upd.status === 'success' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                          ) : upd.status === 'error' ? (
                            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                          ) : (
                            <Loader2 className="w-5 h-5 text-amber-400 animate-spin flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium th-text">
                              {upd.packages_count || 0} paquet(s) mis a jour
                            </p>
                            <p className="text-xs th-text-faint">
                              Par {upd.applied_by_name || 'Admin'} - {upd.started_at ? new Date(upd.started_at).toLocaleDateString('fr-FR') + ' ' + new Date(upd.started_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`text-[10px] ${
                            upd.status === 'success' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                            upd.status === 'error' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
                            'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          }`}>
                            {upd.status === 'success' ? 'Succes' : upd.status === 'error' ? 'Erreur' : 'En cours'}
                          </Badge>
                          {expandedUpdate === upd.id ? <ChevronDown className="w-4 h-4 th-text-faint" /> : <ChevronRight className="w-4 h-4 th-text-faint" />}
                        </div>
                      </button>
                      {expandedUpdate === upd.id && updateDetail && (
                        <div className="p-4 bg-gray-50 dark:bg-zinc-800/20 border-t border-gray-200 dark:border-zinc-700 space-y-3">
                          {updateDetail.updated_packages && updateDetail.updated_packages.length > 0 && (
                            <div>
                              <p className="text-xs font-mono th-text-faint uppercase mb-2">Paquets mis a jour</p>
                              <div className="flex flex-wrap gap-2">
                                {updateDetail.updated_packages.map((p, i) => (
                                  <Badge key={i} className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] font-mono">
                                    {p.name} ({p.version})
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {updateDetail.output && (
                            <div>
                              <p className="text-xs font-mono th-text-faint uppercase mb-2">Sortie</p>
                              <pre className="text-[11px] th-text-secondary font-mono bg-white dark:bg-zinc-900 p-3 rounded-lg border border-gray-200 dark:border-zinc-700 max-h-48 overflow-y-auto whitespace-pre-wrap">
                                {updateDetail.output}
                              </pre>
                            </div>
                          )}
                          {updateDetail.error && (
                            <div>
                              <p className="text-xs font-mono text-red-400 uppercase mb-2">Erreurs</p>
                              <pre className="text-[11px] text-red-400 font-mono bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-200 dark:border-red-800/30 max-h-32 overflow-y-auto whitespace-pre-wrap">
                                {updateDetail.error}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
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
