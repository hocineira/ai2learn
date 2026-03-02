import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, BookOpen, Users, BarChart3, LogOut, PlusCircle, ClipboardList, Settings, ChevronLeft, ChevronRight, GraduationCap, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const LOGO_URL = 'https://customer-assets.emergentagent.com/job_formateur-hub/artifacts/z58spqz8_image.png';

const roleColors = {
  admin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  formateur: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  etudiant: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};
const roleLabels = { admin: 'Admin', formateur: 'Formateur', etudiant: 'Etudiant' };

const formationColors = {
  'bts-sio-sisr': { bg: 'bg-cyan-500/10 border-cyan-500/30', text: 'text-cyan-400', icon: GraduationCap },
  'bachelor-ais': { bg: 'bg-violet-500/10 border-violet-500/30', text: 'text-violet-400', icon: Shield },
};

export const Sidebar = ({ children }) => {
  const { user, logout, activeFormation, switchFormation } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const navItems = {
    admin: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
      { to: '/users', icon: Users, label: 'Utilisateurs' },
      { to: '/exercises', icon: BookOpen, label: 'Exercices' },
      { to: '/exercises/create', icon: PlusCircle, label: 'Creer un exercice' },
      { to: '/tracking', icon: BarChart3, label: 'Suivi etudiants' },
      { to: '/submissions', icon: ClipboardList, label: 'Soumissions' },
    ],
    formateur: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
      { to: '/exercises', icon: BookOpen, label: 'Exercices' },
      { to: '/exercises/create', icon: PlusCircle, label: 'Creer un exercice' },
      { to: '/tracking', icon: Users, label: 'Suivi etudiants' },
      { to: '/submissions', icon: ClipboardList, label: 'Soumissions' },
    ],
    etudiant: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
      { to: '/exercises', icon: BookOpen, label: 'Exercices' },
      { to: '/results', icon: BarChart3, label: 'Mes resultats' },
    ],
  };

  const items = navItems[user?.role] || [];
  const canSwitchFormation = user?.role === 'admin' || user?.role === 'formateur';

  return (
    <div className="flex min-h-screen bg-[#09090b]">
      <aside data-testid="sidebar" className={`fixed left-0 top-0 h-full ${collapsed ? 'w-16' : 'w-64'} bg-zinc-950 border-r border-zinc-800 flex flex-col z-50 transition-all duration-300`}>
        {/* Logo */}
        <div className={`p-3 border-b border-zinc-800 flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <img src={LOGO_URL} alt="NETBFRS" className="h-8 w-auto rounded flex-shrink-0" />
          {!collapsed && (
            <div>
              <span className="text-base font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
                <span className="text-gradient">AI2</span><span className="text-zinc-400">Lean</span>
              </span>
              <p className="text-[9px] text-zinc-600 -mt-0.5">NETBFRS Academy</p>
            </div>
          )}
        </div>

        {/* Formation Switcher */}
        {canSwitchFormation && !collapsed && (
          <div className="p-3 border-b border-zinc-800">
            <label className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider mb-1.5 block">Formation active</label>
            <Select value={activeFormation || 'bts-sio-sisr'} onValueChange={switchFormation}>
              <SelectTrigger data-testid="formation-switcher" className="h-8 bg-zinc-900 border-zinc-800 text-xs text-zinc-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="bts-sio-sisr" className="text-xs">
                  <span className="flex items-center gap-2"><GraduationCap className="w-3 h-3 text-cyan-400" /> BTS SIO SISR</span>
                </SelectItem>
                <SelectItem value="bachelor-ais" className="text-xs">
                  <span className="flex items-center gap-2"><Shield className="w-3 h-3 text-violet-400" /> Bachelor AIS</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} data-testid={`nav-${item.to.replace(/\//g, '-').slice(1)}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-200 ${
                  isActive ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                } ${collapsed ? 'justify-center' : ''}`
              }
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-zinc-800">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button data-testid="user-menu-trigger" className={`w-full flex items-center gap-3 p-2 rounded-md hover:bg-zinc-800/50 transition-colors ${collapsed ? 'justify-center' : ''}`}>
                <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0 text-xs font-medium text-zinc-300">
                  {user?.full_name?.charAt(0)?.toUpperCase()}
                </div>
                {!collapsed && (
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">{user?.full_name}</p>
                    <Badge className={`text-[10px] px-1.5 py-0 ${roleColors[user?.role]}`}>{roleLabels[user?.role]}</Badge>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-zinc-900 border-zinc-800 w-48" side="top" align="start">
              <DropdownMenuItem className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer text-xs">
                <Settings className="w-3 h-3 mr-2" /> Profil
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem data-testid="logout-btn" className="text-red-400 focus:bg-red-500/10 focus:text-red-400 cursor-pointer text-xs" onClick={handleLogout}>
                <LogOut className="w-3 h-3 mr-2" /> Deconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <button onClick={() => setCollapsed(!collapsed)} className="absolute -right-3 top-20 w-6 h-6 bg-zinc-800 border border-zinc-700 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors z-50" data-testid="sidebar-toggle">
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      <main className={`flex-1 ${collapsed ? 'ml-16' : 'ml-64'} transition-all duration-300 min-h-screen`}>
        <div className="p-6 md:p-8 max-w-7xl">{children}</div>
      </main>
    </div>
  );
};
