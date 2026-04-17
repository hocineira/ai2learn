import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, EyeOff, GraduationCap, Shield } from 'lucide-react';
import { toast } from 'sonner';

const LOGO_URL = 'https://customer-assets.emergentagent.com/job_guac-edu-platform/artifacts/i1bnge8a_netbfrs_logo.png';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('etudiant');
  const [formation, setFormation] = useState('bts-sio-sisr');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
        toast.success('Connexion reussie');
      } else {
        await register(email, password, fullName, role, formation);
        toast.success('Compte cree avec succes');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur de connexion');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-grid relative overflow-hidden" data-testid="login-page">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-violet-500/8 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[300px] bg-cyan-500/5 blur-[100px] rounded-full pointer-events-none" />
      
      <div className="w-full max-w-md mx-4 relative z-10">
        {/* Logo & Branding */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="flex items-center justify-center gap-4 mb-3">
            <img src={LOGO_URL} alt="NETBFRS" className="h-14 w-auto rounded-lg" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-1" style={{ fontFamily: 'Space Grotesk' }}>
            <span className="text-gradient">AI2</span><span className="text-gray-800 dark:text-zinc-200">Lean</span>
          </h1>
          <p className="text-gray-500 dark:text-zinc-500 text-sm">Plateforme de formation intelligente</p>
          <p className="text-gray-400 dark:text-zinc-600 text-xs mt-1">par NETBFRS Academy</p>
        </div>

        <Card className="bg-white/95 dark:bg-zinc-900/60 backdrop-blur-xl border-gray-200 dark:border-zinc-800 shadow-2xl animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl" style={{ fontFamily: 'Space Grotesk' }}>
              {isLogin ? 'Connexion' : 'Inscription'}
            </CardTitle>
            <CardDescription className="text-gray-500 dark:text-zinc-500">
              {isLogin ? 'Accedez a votre espace de formation' : 'Creez votre compte AI2Lean'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  <div>
                    <label className="text-xs font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-2 block">Nom complet</label>
                    <Input data-testid="register-fullname" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Votre nom complet" className="bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-cyan-500/20 text-gray-800 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500" required />
                  </div>
                  <div>
                    <label className="text-xs font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-2 block">Formation</label>
                    <Select value={formation} onValueChange={setFormation}>
                      <SelectTrigger data-testid="register-formation" className="bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 text-gray-800 dark:text-zinc-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-50 dark:bg-zinc-900 border-gray-200 dark:border-gray-200 dark:border-zinc-800">
                        <SelectItem value="bts-sio-sisr">
                          <span className="flex items-center gap-2"><GraduationCap className="w-3 h-3 text-cyan-400" /> BTS SIO SISR</span>
                        </SelectItem>
                        <SelectItem value="bachelor-ais">
                          <span className="flex items-center gap-2"><Shield className="w-3 h-3 text-violet-400" /> Bachelor AIS</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div>
                <label className="text-xs font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-2 block">Email</label>
                <Input data-testid="login-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.fr" className="bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-cyan-500/20 text-gray-800 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500" required />
              </div>
              <div>
                <label className="text-xs font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-2 block">Mot de passe</label>
                <div className="relative">
                  <Input data-testid="login-password" type={showPwd ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Votre mot de passe" className="bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-cyan-500/20 text-gray-800 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 pr-10" required />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:text-zinc-300 transition-colors" data-testid="toggle-password">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {!isLogin && (
                <div>
                  <label className="text-xs font-mono text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-2 block">Role</label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger data-testid="register-role" className="bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 text-gray-800 dark:text-zinc-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-50 dark:bg-zinc-900 border-gray-200 dark:border-gray-200 dark:border-zinc-800">
                      <SelectItem value="etudiant">Etudiant</SelectItem>
                      <SelectItem value="formateur">Formateur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button data-testid="login-submit-btn" type="submit" disabled={loading} className="w-full bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white font-medium shadow-[0_0_20px_rgba(6,182,212,0.2)] transition-all duration-300">
                {loading ? 'Chargement...' : isLogin ? 'Se connecter' : "S'inscrire"}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <button data-testid="toggle-auth-mode" onClick={() => setIsLogin(!isLogin)} className="text-sm text-gray-500 dark:text-zinc-500 hover:text-cyan-400 transition-colors">
                {isLogin ? "Pas de compte ? S'inscrire" : 'Deja un compte ? Se connecter'}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
