// Leere Förderplan-Vorlage als Datei erzeugen – mit demselben Code, den die App beim Herunterladen benutzt.
// Aufruf (macht build.py): node tools/vorlage.js <Zieldatei.xlsx>
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = path.join(__dirname, '..', 'src');
// mit „upl“ als drittem Argument: die UPL-Vorlage für Copilot/Cowork (13_upl.js)
const upl = process.argv[3] === 'upl';
const code = ['01_util.js', '02_model.js', '04_xlsx.js', '06_vorlage.js', ...(upl ? ['13_upl.js'] : [])].map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');
const ctx = vm.createContext({ Blob, TextEncoder, TextDecoder, DEMO: false, console });
const blob = vm.runInContext(code + (upl ? '\n;uplVorlageBlob();' : '\n;vorlageBlob(null);'), ctx);
const out = process.argv[2] || path.join(__dirname, '..', 'Foerderplan_Vorlage.xlsx');
blob.arrayBuffer().then(buf => { fs.writeFileSync(out, Buffer.from(buf)); console.log('OK', out); });
