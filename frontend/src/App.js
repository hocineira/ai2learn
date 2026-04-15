import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { Toaster } from '@/components/ui/sonner';
import { Sidebar } from '@/components/Sidebar';
import LoginPage from '@/pages/LoginPage';
import AdminDashboard from '@/pages/AdminDashboard';
import FormateurDashboard from '@/pages/FormateurDashboard';
import EtudiantDashboard from '@/pages/EtudiantDashboard';
import ExercisesPage from '@/pages/ExercisesPage';
import ExerciseCreate from '@/pages/ExerciseCreate';
import ExerciseTake from '@/pages/ExerciseTake';
import UsersPage from '@/pages/UsersPage';
import TrackingPage from '@/pages/TrackingPage';
import ResultsPage from '@/pages/ResultsPage';
import SubmissionsPage from '@/pages/SubmissionsPage';
import LabPage from '@/pages/LabPage';
import LabsListPage from '@/pages/LabsListPage';
import CoursePage from '@/pages/CoursePage';
import CourseCreatePage from '@/pages/CourseCreatePage';
import CoursesListPage from '@/pages/CoursesListPage';
import CourseViewPage from '@/pages/CourseViewPage';
import SettingsPage from '@/pages/SettingsPage';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen th-page flex items-center justify-center th-text-muted">Chargement...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <Sidebar>{children}</Sidebar>;
};

const DashboardRouter = () => {
  const { user } = useAuth();
  if (user?.role === 'admin') return <AdminDashboard />;
  if (user?.role === 'formateur') return <FormateurDashboard />;
  return <EtudiantDashboard />;
};

const AuthGuard = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen th-page flex items-center justify-center th-text-muted">Chargement...</div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
};

const SeedInitializer = () => {
  useEffect(() => {
    axios.post(`${API}/seed`).catch(() => {});
  }, []);
  return null;
};

const ThemedToaster = () => {
  const { isDark } = useTheme();
  return <Toaster theme={isDark ? "dark" : "light"} position="top-right" />;
};

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <SeedInitializer />
          <ThemedToaster />
          <Routes>
            <Route path="/login" element={<AuthGuard><LoginPage /></AuthGuard>} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
            <Route path="/exercises" element={<ProtectedRoute><ExercisesPage /></ProtectedRoute>} />
            <Route path="/exercises/create" element={<ProtectedRoute roles={['admin', 'formateur']}><ExerciseCreate /></ProtectedRoute>} />
            <Route path="/exercises/:id" element={<ProtectedRoute><ExerciseTake /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute roles={['admin']}><UsersPage /></ProtectedRoute>} />
            <Route path="/tracking" element={<ProtectedRoute roles={['admin', 'formateur']}><TrackingPage /></ProtectedRoute>} />
            <Route path="/results" element={<ProtectedRoute><ResultsPage /></ProtectedRoute>} />
            <Route path="/results/:id" element={<ProtectedRoute><ResultsPage /></ProtectedRoute>} />
            <Route path="/submissions" element={<ProtectedRoute roles={['admin', 'formateur']}><SubmissionsPage /></ProtectedRoute>} />
            <Route path="/labs" element={<ProtectedRoute><LabsListPage /></ProtectedRoute>} />
            <Route path="/labs/:exerciseId" element={<ProtectedRoute><LabPage /></ProtectedRoute>} />
            <Route path="/courses" element={<ProtectedRoute><CoursesListPage /></ProtectedRoute>} />
            <Route path="/courses/create" element={<ProtectedRoute roles={['admin', 'formateur']}><CourseCreatePage /></ProtectedRoute>} />
            <Route path="/courses/view/:courseId" element={<ProtectedRoute><CourseViewPage /></ProtectedRoute>} />
            <Route path="/courses/:exerciseId" element={<ProtectedRoute><CoursePage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/stats" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
