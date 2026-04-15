import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Settings, Key, Save, Loader2, CheckCircle2, XCircle, Eye, EyeOff, User, Lock } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { getAuthHeaders, API, user } = useAuth();
  const [llmKey, setLlmKey] = useState('');
  const [llmKeyMasked, setLlmKeyMasked] = useState('');
  const [llmKeySet, setLlmKeySet] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [loading, setLoading] = useState(true);

  // Profile state
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [llmProvider, setLlmProvider] = useState('');
  const [llmActive, setLlmActive] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await axios.get(`${API}/settings`, { headers: getAuthHeaders() });
        setLlmKeySet(res.data.llm_key_set);
        setLlmKeyMasked(res.data.llm_key_masked || '');
        setLlmProvider(res.data.llm_provider || 'aucun');
        setLlmActive(res.data.llm_active || false);
      } catch {}
      setLoading(false);
    };
    if (user?.role === 'admin') fetchSettings();
    else setLoading(false);
  }, [API, getAuthHeaders, user]);

  const handleSaveKey = async () => {
    setSavingKey(true);
    try {
      const res = await axios.put(`${API}/settings`, { llm_key: llmKey }, { headers: getAuthHeaders() });
      const provider = res.data.llm_provider || 'inconnu';
      const providerLabel = provider === 'google' ? 'Google Gemini' : provider === 'emergent' ? 'Emergent/OpenAI' : provider;
      toast.success(res.data.llm_active ? `Cle sauvegardee - Provider: ${providerLabel}` : 'Cle sauvegardee (provider non reconnu)');
      setLlmKeySet(!!llmKey);
      setLlmKeyMasked(llmKey ? llmKey.slice(0, 8) + '...' + llmKey.slice(-4) : '');
      setLlmProvider(provider);
      setLlmActive(res.data.llm_active);
      setLlmKey('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
    setSavingKey(false);
  };

  const handleRemoveKey = async () => {
    if (!window.confirm('Supprimer la cle LLM ? La correction IA sera desactivee.')) return;
    setSavingKey(true);
    try {
      await axios.put(`${API}/settings`, { llm_key: '' }, { headers: getAuthHeaders() });
      toast.success('Cle LLM supprimee');
      setLlmKeySet(false);
      setLlmKeyMasked('');
    } catch (err) {
      toast.error('Erreur');
    }
    setSavingKey(false);
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const payload = {};
      if (fullName.trim() && fullName !== user?.full_name) payload.full_name = fullName.trim();
      if (newPwd) { payload.new_password = newPwd; payload.current_password = currentPwd; }
      
      await axios.post(`${API}/profile/update`, payload, { headers: getAuthHeaders() });
      toast.success('Profil mis a jour');
      setCurrentPwd('');
      setNewPwd('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
    setSavingProfile(false);
  };

  if (loading) return <div className="th-text-muted text-center py-20">Chargement...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6" data-testid="settings-page">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
          <span className="text-gradient">Parametres</span>
        </h1>
        <p className="th-text-muted mt-1">Gerez votre profil et la configuration de la plateforme</p>
      </div>

      {/* Profile Section */}
      <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-cyan-600 dark:text-cyan-400" style={{ fontFamily: 'Space Grotesk' }}>
            <User className="w-4 h-4" /> Mon profil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs font-mono th-text-faint uppercase tracking-wider mb-2 block">Email</label>
            <Input value={user?.email || user?.username || ''} disabled className="bg-gray-100 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-500 cursor-not-allowed" />
          </div>
          <div>
            <label className="text-xs font-mono th-text-faint uppercase tracking-wider mb-2 block">Nom complet</label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="bg-gray-50 dark:bg-zinc-900 border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-zinc-100" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-mono th-text-faint uppercase tracking-wider mb-2 block">
                <Lock className="w-3 h-3 inline mr-1" /> Mot de passe actuel
              </label>
              <Input type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} placeholder="Pour changer le mdp" className="bg-gray-50 dark:bg-zinc-900 border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-zinc-100" />
            </div>
            <div>
              <label className="text-xs font-mono th-text-faint uppercase tracking-wider mb-2 block">Nouveau mot de passe</label>
              <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="Nouveau mot de passe" className="bg-gray-50 dark:bg-zinc-900 border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-zinc-100" />
            </div>
          </div>
          <Button onClick={handleSaveProfile} disabled={savingProfile} className="bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white">
            {savingProfile ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sauvegarde...</> : <><Save className="w-4 h-4 mr-2" /> Sauvegarder le profil</>}
          </Button>
        </CardContent>
      </Card>

      {/* LLM Key Section (Admin only) */}
      {user?.role === 'admin' && (
        <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-violet-600 dark:text-violet-400" style={{ fontFamily: 'Space Grotesk' }}>
              <Key className="w-4 h-4" /> Cle API IA (Correction automatique)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm th-text-secondary">Statut :</span>
              {llmKeySet ? (
                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Cle configuree
                </Badge>
              ) : (
                <Badge className="bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30">
                  <XCircle className="w-3 h-3 mr-1" /> Non configuree
                </Badge>
              )}
              {llmKeySet && llmProvider && (
                <Badge className="bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30">
                  {llmProvider === 'google' ? 'Google Gemini' : llmProvider === 'emergent' ? 'Emergent/OpenAI' : llmProvider}
                </Badge>
              )}
            </div>

            {llmKeyMasked && (
              <p className="text-xs font-mono th-text-faint">Cle actuelle : {llmKeyMasked}</p>
            )}

            <div>
              <label className="text-xs font-mono th-text-faint uppercase tracking-wider mb-2 block">
                Nouvelle cle Emergent LLM
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    value={llmKey}
                    onChange={(e) => setLlmKey(e.target.value)}
                    placeholder="sk-emergent-..."
                    className="bg-gray-50 dark:bg-zinc-900 border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-zinc-100 pr-10 font-mono text-sm"
                    data-testid="llm-key-input"
                  />
                  <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 th-text-muted hover:th-text">
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button onClick={handleSaveKey} disabled={savingKey || !llmKey.trim()} className="bg-violet-600 hover:bg-violet-500 text-white" data-testid="save-llm-key">
                  {savingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {llmKeySet && (
              <Button variant="outline" size="sm" className="text-red-500 border-red-500/30 hover:bg-red-500/10" onClick={handleRemoveKey}>
                <XCircle className="w-3 h-3 mr-1" /> Supprimer la cle
              </Button>
            )}

            <p className="text-xs th-text-faint">
              Supports : <strong>Google Gemini</strong> (cle AIzaSy...) ou <strong>Emergent/OpenAI</strong> (cle sk-emergent-...).
              Le provider est detecte automatiquement. Si Google echoue (quota), le systeme basculera sur Emergent comme backup.
              Pour Google Gemini : <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-cyan-500 underline">obtenir une cle gratuite</a>.
              Modeles Gemini supportes : gemini-2.5-flash, gemini-2.0-flash, gemini-2.0-flash-lite.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
