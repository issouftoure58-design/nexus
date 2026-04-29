#!/usr/bin/env node
/**
 * Valide un fichier DSN depuis le terminal
 * Usage: node backend/src/scripts/validate-dsn.js <fichier.dsn>
 */
import { readFileSync } from 'fs';
import { validerDSN, genererRapport, genererRapportXML } from '../services/dsnValidator.js';

const fichier = process.argv[2];
if (!fichier) {
  console.error('Usage: node backend/src/scripts/validate-dsn.js <fichier.dsn> [--xml]');
  process.exit(1);
}

const wantXML = process.argv.includes('--xml');
const contenu = readFileSync(fichier, 'utf-8');
const resultat = validerDSN(contenu);

if (wantXML) {
  console.log(genererRapportXML(resultat));
} else {
  console.log(genererRapport(resultat));
}

process.exit(resultat.valide ? 0 : 1);
