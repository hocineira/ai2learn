# AI2Lean - Plateforme de Formation NETBFRS Academy

## Problem Statement
Plateforme multi-formations de formation IT avec suivi temps reel, exercices interactifs et correction IA. Academie NETBFRS.

## Architecture
- Frontend: React + Tailwind + Shadcn UI (dark theme Cyan/Violet)
- Backend: FastAPI + MongoDB + JWT
- AI: OpenAI GPT-5.2 via Emergent Integrations

## Formations
1. **BTS SIO SISR** - Bac+2 : Admin Systeme, Reseaux, Cyber, Virtualisation, Services Infra, Scripting
2. **Bachelor AIS** - Bac+3 : Admin & Securisation, Conception Infra, Cyber, Cloud, Supervision, Automatisation, Reseaux Avances, Gestion Projet

## What's Implemented (01/03/2026)
- [x] Multi-formations (BTS SISR + Bachelor AIS) avec switcher
- [x] Auth JWT 3 roles (admin, formateur, etudiant)
- [x] Exercices interactifs (QCM + questions ouvertes) par formation
- [x] Correction IA automatique (OpenAI GPT)
- [x] Suivi etudiants temps reel filtrable par formation
- [x] Dashboard admin avec vue multi-formations
- [x] Branding AI2Lean + logo NETBFRS
- [x] Script deploiement VPS Debian 12 + procedure

## Backlog
### P0
- Exercices lab VM (lien Proxmox + upload resultat)
- Edition d'exercices existants

### P1
- Graphiques de progression (recharts)
- Notifications temps reel (WebSocket)
- Export resultats (CSV/PDF)

### P2
- Progression par competences referentiel
- Commentaires formateur sur soumissions
- Systeme de badges/gamification

## Credentials Demo
- admin/admin123 | formateur/formateur123
- etudiant1, etudiant2/etudiant123 (BTS)
- ais_student1, ais_student2/etudiant123 (AIS)
