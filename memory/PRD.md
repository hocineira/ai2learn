# SISR.io - Plateforme de Formation BTS SIO SISR

## Problem Statement
Plateforme web de formation pour BTS SIO SISR permettant aux formateurs de suivre leurs étudiants en temps réel, avec des exercices interactifs (QCM + questions ouvertes) et correction automatique par IA (OpenAI GPT).

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI (dark theme "Cyber-Lite")
- **Backend**: FastAPI + MongoDB + JWT Auth
- **AI**: OpenAI GPT-5.2 via Emergent Integrations (auto-grading)
- **Theme**: Dark mode only, Cyan/Indigo accents

## User Personas
1. **Administrateur** - Gestion complète (utilisateurs, exercices, stats)
2. **Formateur** - Création d'exercices, suivi étudiants temps réel, correction IA
3. **Étudiant** - Passage d'exercices, consultation résultats

## Core Requirements
- Auth JWT (username/password)
- 3 rôles: admin, formateur, étudiant
- Exercices interactifs: QCM + questions ouvertes
- Correction IA automatique (OpenAI GPT)
- Suivi étudiants en temps réel
- Interface française
- Catégories SISR: Admin Système, Réseaux, Cyber, Virtualisation, Services Infra, Scripting

## What's Been Implemented (01/03/2026)
- [x] Auth system (register/login/JWT)
- [x] 3 rôles avec dashboards spécifiques
- [x] CRUD exercices (QCM + questions ouvertes)
- [x] Système de soumission avec auto-correction QCM
- [x] Correction IA (OpenAI GPT) pour questions ouvertes
- [x] Suivi étudiants temps réel
- [x] Gestion utilisateurs (admin)
- [x] Données de démonstration (seed)
- [x] Interface française dark theme
- [x] Filtrage par catégories

## Prioritized Backlog
### P0 (Next)
- Édition d'exercices existants (page /exercises/edit/:id)
- Profil utilisateur

### P1
- Exercices avec lien VM (upload résultat + correction IA)
- Dashboard stats avancées (graphiques recharts)
- Notification temps réel (WebSocket)

### P2
- Export résultats (CSV/PDF)
- Mode hors-ligne pour exercices
- Système de commentaires formateur
- Progression par compétences SISR

## Demo Credentials
- Admin: admin / admin123
- Formateur: formateur / formateur123
- Étudiants: etudiant1, etudiant2, etudiant3 / etudiant123
