import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, ArrowLeft, CheckCircle2, XCircle, Clock, Cpu, Download, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function ResultsPage() {
  const { id } = useParams();
  const { getAuthHeaders, API, user } = useAuth();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const headers = getAuthHeaders();
        if (id) {
          const res = await axios.get(`${API}/submissions/${id}`, { headers });
          setDetail(res.data);
        } else {
          const res = await axios.get(`${API}/submissions`, { headers });
          setSubmissions(res.data);
        }
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    fetch();
  }, [id, API, getAuthHeaders]);

  const handleExportCSV = async (submissionId) => {
    try {
      const res = await axios.get(`${API}/export/result-csv/${submissionId}`, {
        headers: getAuthHeaders(),
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `resultat-${submissionId.slice(0, 8)}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) { console.error(err); }
  };

  const handleExportPDF = (sub) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFillColor(9, 9, 11);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(6, 182, 212);
    doc.setFontSize(20);
    doc.text('AI2Lean - NETBFRS Academy', 14, 18);
    doc.setTextColor(161, 161, 170);
    doc.setFontSize(10);
    doc.text('Rapport de resultat', 14, 28);
    doc.text(`Genere le ${new Date().toLocaleDateString('fr-FR')}`, 14, 34);
    
    // Student info
    doc.setTextColor(39, 39, 42);
    doc.setFontSize(14);
    doc.text(sub.exercise_title || 'Exercice', 14, 52);
    doc.setFontSize(10);
    doc.setTextColor(113, 113, 122);
    doc.text(`Etudiant: ${sub.student_name || user?.full_name || ''}`, 14, 60);
    doc.text(`Soumis le: ${sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}`, 14, 66);
    
    // Score
    const score20 = sub.score_20 != null ? sub.score_20 : (sub.graded ? Math.round((sub.score / Math.max(sub.max_score, 1)) * 200) / 10 : '-');
    doc.setFontSize(18);
    doc.setTextColor(sub.graded && (sub.score / Math.max(sub.max_score, 1)) * 100 >= 50 ? [16, 185, 129] : [244, 63, 94]);
    doc.text(`Score: ${sub.graded ? `${sub.score}/${sub.max_score} (${score20}/20)` : 'En attente de correction'}`, 14, 80);
    
    // Answers table
    if (sub.answers && sub.answers.length > 0) {
      const tableData = sub.answers.map((a, i) => [
        `Q${i + 1}`,
        a.correct !== null && a.correct !== undefined ? 'QCM' : 'Ouverte',
        (a.answer || '').substring(0, 60) + ((a.answer || '').length > 60 ? '...' : ''),
        `${a.points_earned || 0} pts`,
        (a.ai_feedback || '').substring(0, 80) + ((a.ai_feedback || '').length > 80 ? '...' : ''),
      ]);
      
      doc.autoTable({
        startY: 90,
        head: [['#', 'Type', 'Reponse', 'Points', 'Feedback IA']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [6, 182, 212], textColor: [255, 255, 255], fontSize: 9 },
        bodyStyles: { fontSize: 8, textColor: [63, 63, 70] },
        columnStyles: {
          0: { cellWidth: 12 },
          1: { cellWidth: 18 },
          2: { cellWidth: 55 },
          3: { cellWidth: 18 },
          4: { cellWidth: 'auto' },
        },
        margin: { left: 14, right: 14 },
      });
    }
    
    // AI General feedback
    if (sub.ai_feedback) {
      const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 90;
      doc.setFontSize(10);
      doc.setTextColor(6, 182, 212);
      doc.text('Feedback general IA:', 14, finalY);
      doc.setTextColor(63, 63, 70);
      doc.setFontSize(9);
      const splitText = doc.splitTextToSize(sub.ai_feedback, pageWidth - 28);
      doc.text(splitText, 14, finalY + 6);
    }
    
    doc.save(`resultat-${sub.exercise_title?.replace(/[^a-zA-Z0-9]/g, '-') || 'exercice'}.pdf`);
  };

  if (loading) return <div className="text-gray-500 dark:text-zinc-500 text-center py-20">Chargement...</div>;

  // Detail view
  if (detail) {
    return (
      <div className="space-y-6 max-w-3xl" data-testid="result-detail">
        <div className="flex items-center justify-between">
          <Button variant="ghost" className="text-gray-500 dark:text-zinc-400 hover:text-cyan-400 -ml-3" onClick={() => navigate('/results')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="bg-gray-50 dark:bg-zinc-900 border-gray-300 dark:border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-800 hover:text-cyan-400" onClick={() => handleExportCSV(detail.id)} data-testid="export-result-csv">
              <Download className="w-4 h-4 mr-1" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="bg-gray-50 dark:bg-zinc-900 border-gray-300 dark:border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-800 hover:text-violet-400" onClick={() => handleExportPDF(detail)} data-testid="export-result-pdf">
              <FileText className="w-4 h-4 mr-1" /> PDF
            </Button>
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>{detail.exercise_title}</h1>
          <p className="text-gray-500 dark:text-zinc-500 text-sm mt-1">
            Soumis le {new Date(detail.submitted_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Score card */}
        <Card className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-mono text-gray-500 dark:text-zinc-500 uppercase mb-1">Score total</p>
                <div className="flex items-end gap-4">
                  <p className="text-4xl font-bold" style={{
                    fontFamily: 'Space Grotesk',
                    color: detail.graded ? ((detail.score / Math.max(detail.max_score, 1)) * 100 >= 50 ? '#10b981' : '#f43f5e') : '#71717a'
                  }}>
                    {detail.graded ? `${detail.score}/${detail.max_score}` : 'En attente'}
                  </p>
                  {detail.graded && detail.score != null && (
                    <div className="mb-1">
                      <p className="text-2xl font-bold text-gradient" style={{ fontFamily: 'Space Grotesk' }}>
                        {detail.score_20 != null ? detail.score_20 : Math.round((detail.score / Math.max(detail.max_score, 1)) * 200) / 10}/20
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <Badge className={detail.graded ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}>
                {detail.graded ? 'Corrige' : 'En cours'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* AI Feedback */}
        {detail.ai_feedback && (
          <Card className="bg-white dark:bg-zinc-900/50 backdrop-blur-md border-cyan-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-cyan-400" style={{ fontFamily: 'Space Grotesk' }}>
                <Cpu className="w-4 h-4" /> Feedback IA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700 dark:text-zinc-300 leading-relaxed ai-typing">{detail.ai_feedback}</p>
            </CardContent>
          </Card>
        )}

        {/* Answers detail */}
        <div className="space-y-3">
          {detail.answers?.map((answer, i) => {
            const isQcm = answer.correct !== null && answer.correct !== undefined;
            const isOpen = !isQcm;
            const pts = answer.points_earned || 0;
            return (
              <Card key={i} className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-500 dark:text-zinc-500">Question {i + 1}</span>
                      <Badge className={isQcm ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30 text-[10px]' : 'bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]'}>
                        {isQcm ? 'QCM' : 'Ouverte'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {answer.correct === true && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      {answer.correct === false && <XCircle className="w-4 h-4 text-red-400" />}
                      {isOpen && pts > 0 && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      {isOpen && pts === 0 && detail.graded && <XCircle className="w-4 h-4 text-red-400" />}
                      <span className={`text-sm font-bold ${pts > 0 ? 'text-emerald-400' : 'text-gray-500 dark:text-zinc-500'}`} style={{ fontFamily: 'Space Grotesk' }}>
                        {pts} pts
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-zinc-300 mb-2">{answer.answer}</p>
                  {answer.ai_feedback && (
                    <div className="mt-2 border-t border-gray-200 dark:border-zinc-800 pt-2 flex gap-2">
                      <Cpu className="w-3 h-3 text-cyan-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-cyan-400/80">{answer.ai_feedback}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6" data-testid="results-page">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
          Mes <span className="text-gradient">resultats</span>
        </h1>
        <p className="text-gray-500 dark:text-zinc-500 mt-1">{submissions.length} soumission{submissions.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="space-y-3">
        {submissions.map((sub, i) => (
          <Card
            key={sub.id}
            className="bg-white/90 dark:bg-zinc-900/50 backdrop-blur-md border-gray-200 dark:border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none hover:border-gray-300 dark:border-zinc-700 transition-all cursor-pointer animate-fade-in-up"
            style={{ animationDelay: `${i * 0.03}s` }}
            onClick={() => navigate(`/results/${sub.id}`)}
            data-testid={`submission-row-${sub.id}`}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-zinc-200">{sub.exercise_title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500 dark:text-zinc-500">
                      {new Date(sub.submitted_at).toLocaleDateString('fr-FR')}
                    </span>
                    {user?.role !== 'etudiant' && (
                      <span className="text-xs text-gray-500 dark:text-zinc-500">par {sub.student_name}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {sub.graded ? (
                  <div className="text-right">
                    <p className="text-lg font-bold" style={{
                      fontFamily: 'Space Grotesk',
                      color: (sub.score / Math.max(sub.max_score, 1)) * 100 >= 50 ? '#10b981' : '#f43f5e'
                    }}>
                      {sub.score_20 != null ? sub.score_20 : Math.round((sub.score / Math.max(sub.max_score, 1)) * 200) / 10}/20
                    </p>
                    <p className="text-xs text-gray-500 dark:text-zinc-500">{sub.score}/{sub.max_score} pts</p>
                  </div>
                ) : (
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                    <Clock className="w-3 h-3 mr-1" /> En attente
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {submissions.length === 0 && (
        <div className="text-center py-16">
          <BarChart3 className="w-12 h-12 text-gray-300 dark:text-zinc-700 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-zinc-500">Aucun resultat pour le moment</p>
          <Button className="mt-4 bg-cyan-600 hover:bg-cyan-500 text-white" onClick={() => navigate('/exercises')}>
            Commencer un exercice
          </Button>
        </div>
      )}
    </div>
  );
}
