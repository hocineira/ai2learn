import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Terminal, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('etudiant');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await login(username, password);
        toast.success('Connexion reussie');
      } else {
        await register(username, password, fullName, role);
        toast.success('Compte cree avec succes');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur de connexion');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-grid relative overflow-hidden" data-testid="login-page">
      {/* Glow effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="w-full max-w-md mx-4 relative z-10">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center glow-cyan">
              <Terminal className="w-6 h-6 text-cyan-400" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
              <span className="text-gradient">SISR</span><span className="text-zinc-400">.io</span>
            </h1>
          </div>
          <p className="text-zinc-500 text-sm">Plateforme de formation BTS SIO SISR</p>
        </div>

        <Card className="bg-zinc-900/60 backdrop-blur-xl border-zinc-800 shadow-2xl animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl" style={{ fontFamily: 'Space Grotesk' }}>
              {isLogin ? 'Connexion' : 'Inscription'}
            </CardTitle>
            <CardDescription className="text-zinc-500">
              {isLogin ? 'Connectez-vous a votre compte' : 'Creez votre compte'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <label className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2 block">Nom complet</label>
                  <Input
                    data-testid="register-fullname"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Votre nom complet"
                    className="bg-zinc-950 border-zinc-800 focus:border-cyan-500 focus:ring-cyan-500/20 text-zinc-100 placeholder:text-zinc-600"
                    required
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2 block">Nom d'utilisateur</label>
                <Input
                  data-testid="login-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="votre_username"
                  className="bg-zinc-950 border-zinc-800 focus:border-cyan-500 focus:ring-cyan-500/20 text-zinc-100 placeholder:text-zinc-600"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2 block">Mot de passe</label>
                <div className="relative">
                  <Input
                    data-testid="login-password"
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Votre mot de passe"
                    className="bg-zinc-950 border-zinc-800 focus:border-cyan-500 focus:ring-cyan-500/20 text-zinc-100 placeholder:text-zinc-600 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    data-testid="toggle-password"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {!isLogin && (
                <div>
                  <label className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2 block">Role</label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger data-testid="register-role" className="bg-zinc-950 border-zinc-800 text-zinc-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="etudiant">Etudiant</SelectItem>
                      <SelectItem value="formateur">Formateur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button
                data-testid="login-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-medium shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all duration-300"
              >
                {loading ? 'Chargement...' : isLogin ? 'Se connecter' : "S'inscrire"}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <button
                data-testid="toggle-auth-mode"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-zinc-500 hover:text-cyan-400 transition-colors"
              >
                {isLogin ? "Pas de compte ? S'inscrire" : 'Deja un compte ? Se connecter'}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Quick access info */}
        <div className="mt-4 text-center animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <p className="text-xs text-zinc-600">
            Demo: admin/admin123 | formateur/formateur123 | etudiant1/etudiant123
          </p>
        </div>
      </div>
    </div>
  );
}
