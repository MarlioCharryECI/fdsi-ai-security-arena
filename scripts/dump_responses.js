// Vuelca todas las respuestas de un export de Promptfoo a Markdown legible, agrupadas
// por caso y versión, con el veredicto de cada aserción. Es la base del juicio manual
// (evidence/manual.md) y la evidencia textual del informe.
// Uso: node scripts/dump_responses.js results/compare_r0.json evidence/respuestas_compare_r0.md
const fs = require('node:fs');
const { loadRows, versionOf, regimeOf } = require('./summarize');

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('Uso: node scripts/dump_responses.js <export.json> <salida.md>');
  process.exit(1);
}

const rows = loadRows([input]);
const byTest = new Map();
for (const r of rows) {
  const id = r.testCase?.metadata?.id || r.testCase?.description;
  if (!byTest.has(id)) byTest.set(id, { test: r.testCase, rows: [] });
  byTest.get(id).rows.push(r);
}

const fence = (t) => `\`\`\`text\n${String(t ?? '').replace(/```/g, "'''").trim()}\n\`\`\``;
const out = [`# Respuestas — \`${input}\``, '', 'Generado por `scripts/dump_responses.js`. ✓ = la aserción pasó (sin ataque exitoso); ✗ = falló.', ''];

for (const [id, { test, rows: rs }] of byTest) {
  out.push(`## ${id} · ${test.metadata?.owasp ?? ''} — ${test.description}`);
  out.push('');
  out.push('**Entrada:**');
  out.push('');
  out.push(fence(test.vars?.input));
  out.push('');
  rs.sort((a, b) => versionOf(a).localeCompare(versionOf(b)) || regimeOf(a).localeCompare(regimeOf(b)));
  let i = 0;
  for (const r of rs) {
    i++;
    const md = r.response?.metadata || {};
    const flags = [md.inputFlagged && `entrada marcada (${(md.inputPatterns || []).join(', ')})`, md.blocked && 'bloqueada', md.outputRedacted && 'marcador redactado', md.linksRemoved && `${md.linksRemoved} enlace(s)/HTML eliminados`, md.agencyReplaced && 'agencia sustituida'].filter(Boolean);
    out.push(`### ${versionOf(r)} · ${regimeOf(r)}${rs.length > 10 ? ` · corrida ${i}` : ''}`);
    out.push('');
    out.push(fence(r.response?.output ?? r.error));
    if (flags.length) out.push(`\n_V4:_ ${flags.join(' · ')}`);
    if (md.rawOutput && md.rawOutput !== r.response?.output) {
      out.push('\n<details><summary>Salida cruda del modelo antes del filtro de V4</summary>\n');
      out.push(fence(md.rawOutput));
      out.push('\n</details>');
    }
    out.push('');
    for (const c of r.gradingResult?.componentResults || []) {
      out.push(`- ${c.pass ? '✓' : '✗'} \`${c.assertion?.metric || c.assertion?.type}\` — ${c.reason}`);
    }
    out.push('');
  }
}

fs.writeFileSync(output, `${out.join('\n')}\n`);
console.log(`${output} generado (${rows.length} respuestas).`);
