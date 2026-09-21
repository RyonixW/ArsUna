# Ars Una Picking

Application de préparation des listes scolaires pour la librairie Ars Una. Elle permet de photographier une liste, de vérifier les articles reconnus puis de suivre leur collecte dans le magasin.

## Fonctionnalités

- reconnaissance des références à partir de photos avec OCR ;
- vérification et correction des articles détectés ;
- parcours de préparation avec plan du magasin, gestion des articles pris ou manquants et historique d'annulation ;
- utilisation hors connexion sous forme de PWA ;
- version Android générée avec Capacitor.

## Technologies

- React ;
- Vite ;
- Tesseract.js ;
- Capacitor.

## Installation

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Pour synchroniser le build avec le projet Android :

```bash
npm run android:sync
```

## Déploiement

Chaque envoi sur la branche `main` déclenche le workflow GitHub Actions qui construit l'application et publie le dossier `dist` sur GitHub Pages.
