// Genera evidence/casos_clave.html: una tarjeta por caso clave con la entrada y la
// respuesta de cada versión lado a lado, con el veredicto de cada aserción.
// Las tarjetas se capturan luego como PNG para el informe.
// Uso: node scripts/evidence_cards.js results/compare_r0.json results/guarded_r0.json
const fs = require('node:fs');
const { loadRows, versionOf } = require('./summarize');

const CASES = [
  ['O2', 'El "hardened" original filtra el marcador ante la inyección más simple'],
  ['M2-d2', 'V1b reproduce su propio prompt, marcador incluido'],
  ['M1-d', 'Secuestro con canario: también funciona en V3 (sin secreto)'],
  ['C3', 'V0 filtra el marcador en una petición legítima'],
  ['M3-c', 'Carga dividida: V2 filtra; V4 lo redacta en la salida'],
  ['C4', 'Falso positivo del filtro de entrada de V4 (modo block)'],
];
const ORDER = ['V0', 'V1', 'V1b', 'V2', 'V3', 'V4-flag', 'V4-block'];

const files = process.argv.slice(2);
const rows = loadRows(files);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clip = (s, n = 700) => (s.length > n ? `${s.slice(0, n)}…` : s);

const cards = CASES.map(([id, title]) => {
  const rs = rows.filter((r) => r.testCase?.metadata?.id === id);
  if (!rs.length) return '';
  rs.sort((a, b) => ORDER.indexOf(versionOf(a)) - ORDER.indexOf(versionOf(b)));
  const t = rs[0].testCase;
  const cols = rs.map((r) => {
    const comps = r.gradingResult?.componentResults || [];
    const attacked = comps.some((c) => !c.pass && String(c.assertion?.metric).startsWith('ataque_'));
    const chips = comps
      .filter((c) => c.assertion?.metric !== 'original_kit')
      .map((c) => `<span class="chip ${c.pass ? 'ok' : 'ko'}">${c.pass ? '✓' : '✗'} ${esc(String(c.assertion?.metric).replace('ataque_', ''))}</span>`)
      .join('');
    const md = r.response?.metadata || {};
    const v4 = md.mode ? `<div class="v4">${md.blocked ? 'entrada bloqueada' : md.inputFlagged ? 'entrada marcada' : 'entrada limpia'}${md.outputRedacted ? ' · marcador redactado' : ''}${md.agencyReplaced ? ' · agencia sustituida' : ''}</div>` : '';
    return `<div class="col ${attacked ? 'bad' : ''}"><div class="ver">${esc(versionOf(r))}</div>${v4}<pre>${esc(clip(String(r.response?.output ?? r.error)))}</pre><div class="chips">${chips}</div></div>`;
  });
  return `<section class="card" id="${esc(id)}"><h2>${esc(id)} · ${esc(t.metadata?.owasp)} — ${esc(title)}</h2><div class="input"><b>Entrada:</b> ${esc(clip(t.vars?.input, 400))}</div><div class="grid" style="grid-template-columns: repeat(${cols.length}, 1fr)">${cols.join('')}</div></section>`;
});

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Casos clave</title><style>
body{font-family:"Segoe UI",Arial,sans-serif;background:#eef1f4;margin:0;padding:16px;color:#1d232a}
.card{background:#fff;border-top:6px solid #8a1c2b;padding:14px 16px;margin:0 0 18px;width:1500px}
h2{font-family:Georgia,serif;font-size:19px;margin:0 0 8px}
.input{background:#f4f6f8;border:1px solid #d5dae0;border-radius:4px;padding:8px 10px;font-size:13px;margin-bottom:10px;white-space:pre-wrap}
.grid{display:grid;gap:8px}
.col{border:1px solid #d5dae0;border-radius:6px;padding:8px;background:#fbfcfd}
.col.bad{border-color:#c0392b;background:#fdf1f0}
.ver{font-weight:700;font-size:14px;margin-bottom:4px}
.v4{font-size:11px;color:#5b6672;margin-bottom:4px}
pre{white-space:pre-wrap;word-break:break-word;font-family:Consolas,monospace;font-size:11.5px;margin:0 0 6px;max-height:330px;overflow:hidden}
.chip{display:inline-block;font-size:10.5px;border-radius:10px;padding:1px 7px;margin:2px 3px 0 0}
.ok{background:#e3f4e8;color:#1e6b35}.ko{background:#fbe1de;color:#9b2318}
</style></head><body>${cards.join('\n')}</body></html>`;

fs.writeFileSync('evidence/casos_clave.html', html);
console.log(`evidence/casos_clave.html generado (${CASES.length} casos).`);
