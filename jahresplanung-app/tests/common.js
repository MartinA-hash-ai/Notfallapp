// Gemeinsame Pfade und Werte für alle Tests (laufen gegen die gebaute Datei im Ordner darüber)
const path = require('path');
const HTML = path.join(__dirname, '..', 'Jahresplanung_Aussenkommunikation.html');
const CHANGELOG = require('../src/changelog.json');
module.exports = {
  HTML, URL: 'file://' + HTML, FAKEFS: path.join(__dirname, 'fakefs.js'), FIXTURES: path.join(__dirname, 'fixtures'),
  VERSION: CHANGELOG[0].version, CHANGELOG_N: CHANGELOG.length,
  NEWER: '99.0',                                   // gilt in den Update-Tests als „neuere Version“
};
