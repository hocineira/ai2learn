import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, BookOpen, Users, BarChart3, LogOut, Terminal, PlusCircle, ClipboardList, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useState } from 'react';

const roleColors = {
  admin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  formateur: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  etudiant: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

const roleLabels = {
  admin: 'Administrateur',
  formateur: 'Formateur',
  etudiant: 'Etudiant',
};

export const Sidebar = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = {
    admin: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
      { to: '/users', icon: Users, label: 'Utilisateurs' },
      { to: '/exercises', icon: BookOpen, label: 'Exercices' },
      { to: '/stats', icon: BarChart3, label: 'Statistiques' },
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

  return (
    <div className="flex min-h-screen bg-[#09090b]">
      {/* Sidebar */}
      <aside
        data-testid="sidebar"
        className={`fixed left-0 top-0 h-full ${collapsed ? 'w-16' : 'w-64'} bg-zinc-950 border-r border-zinc-800 flex flex-col z-50 transition-all duration-300`}
      >
        {/* Logo */}
        <div className={`p-4 border-b border-zinc-800 flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
            <Terminal className="w-5 h-5 text-cyan-400" />
          </div>
          {!collapsed && (
            <span className="text-lg font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
              <span className="text-gradient">SISR</span><span className="text-zinc-400">.io</span>
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              data-testid={`nav-${item.to.replace(/\//g, '-').slice(1)}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-200 group ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
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
              <button
                data-testid="user-menu-trigger"
                className={`w-full flex items-center gap-3 p-2 rounded-md hover:bg-zinc-800/50 transition-colors ${collapsed ? 'justify-center' : ''}`}
              >
                <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0 text-xs font-medium text-zinc-300">
                  {user?.full_name?.charAt(0)?.toUpperCase()}
                </div>
                {!collapsed && (
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">{user?.full_name}</p>
                    <Badge className={`text-[10px] px-1.5 py-0 ${roleColors[user?.role]}`}>
                      {roleLabels[user?.role]}
                    </Badge>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-zinc-900 border-zinc-800 w-48" side="top" align="start">
              <DropdownMenuItem className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer" onClick={() => navigate('/profile')}>
                <Settings className="w-4 h-4 mr-2" /> Profil
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem data-testid="logout-btn" className="text-red-400 focus:bg-red-500/10 focus:text-red-400 cursor-pointer" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" /> Deconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Collapse button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 bg-zinc-800 border border-zinc-700 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors z-50"
          data-testid="sidebar-toggle"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Main content */}
      <main className={`flex-1 ${collapsed ? 'ml-16' : 'ml-64'} transition-all duration-300 min-h-screen`}>
        <div className="p-6 md:p-8 max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  );
};
