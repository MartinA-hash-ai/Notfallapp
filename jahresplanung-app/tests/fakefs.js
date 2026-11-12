window.__fs = { files: {}, perm: 'granted', n: 0 };
(() => {
  const nf = () => new DOMException('not found', 'NotFoundError');
  const fileH = (dir, name) => ({ kind: 'file', name,
    getFile: async () => { const f = __fs.files[dir + '/' + name]; if (!f) throw nf(); return new File([f.data], name, { lastModified: f.lm }); },
    createWritable: async () => { const parts = []; return { write: async d => { parts.push(d); }, close: async () => { if (__fs.lock && __fs.lock === name) throw new DOMException('locked', 'NoModificationAllowedError'); const buf = new Uint8Array(await new Blob(parts).arrayBuffer()); __fs.files[dir + '/' + name] = { data: buf, lm: 5000 + (++__fs.n) }; } }; } });
  const dirH = (path, name) => ({ kind: 'directory', name,
    getFileHandle: async (n, o = {}) => { const p = path + '/' + n; if (!__fs.files[p]) { if (o.create) __fs.files[p] = { data: new Uint8Array(), lm: 4000 }; else throw nf(); } return fileH(path, n); },
    entries: async function* () { const seen = new Set(); for (const p of Object.keys(__fs.files)) if (p.startsWith(path + '/')) { const rest = p.slice(path.length + 1), seg = rest.split('/')[0]; if (seen.has(seg)) continue; seen.add(seg); yield [seg, rest.includes('/') ? dirH(path + '/' + seg, seg) : fileH(path, seg)]; } },
    getDirectoryHandle: async (n, o = {}) => { const p = path + '/' + n; if (!o.create && !Object.keys(__fs.files).some(k => k.startsWith(p + '/'))) throw nf(); return dirH(p, n); },
    removeEntry: async n => { const p = path + '/' + n; if (!__fs.files[p]) throw nf(); delete __fs.files[p]; },
    queryPermission: async () => __fs.perm, requestPermission: async () => { __fs.perm = 'granted'; return 'granted'; } });
  window.showDirectoryPicker = async () => dirH('/Mailing', 'Mailing');
})();
