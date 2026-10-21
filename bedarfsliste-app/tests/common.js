// Gemeinsame Pfade und Werte für alle Tests (laufen gegen die gebaute Datei im Ordner darüber)
const path = require('path');
const HTML = path.join(__dirname, '..', 'Bedarfsliste.html');
const CHANGELOG = require('../src/changelog.json');
module.exports = {
  HTML, PREVIEW: path.join(__dirname, '..', 'vorschau', 'Bedarfsliste_Vorschau.html'), VORLAGE: path.join(__dirname, '..', 'Foerderplan_Vorlage.xlsx'),
  FAKEFS: path.join(__dirname, 'fakefs.js'), VERSION: CHANGELOG[0].version, NEWER: '99.0',
};
