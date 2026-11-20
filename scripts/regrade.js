// Re-evalúa las aserciones JavaScript (file://…/assertions/*.js) sobre las salidas YA
// guardadas en un export de Promptfoo, sin volver a llamar al modelo. Las salidas no
// cambian; solo los veredictos. Sirve para que todos los resultados queden evaluados
// con la misma versión de las aserciones cuando una se corrige (y se documenta).
// Las aserciones nativas de Promptfoo (not-contains del kit) no se tocan.
// Uso: node scripts/regrade.js results/compare_rs.json [más archivos]
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const configsDir = path.join(root, 'configs');

// Lee el `config` vigente de cada aserción JavaScript en tests/*.yaml, indexado por
// "<id del test>|<metric>". Los configs usan YAML en línea (`{ keywords: ['a', 'b'], min: 1 }`),
// que se convierte a JSON sin depender de un parser de YAML.
function loadCurrentConfigs() {
  const map = new Map();
  const testsDir = path.join(root, 'tests');
  for (const f of fs.readdirSync(testsDir).filter((x) => x.endsWith('.yaml'))) {
    const text = fs.readFileSync(path.join(testsDir, f), 'utf8');
    for (const block of text.split(/\n(?=- description:)/)) {
      const id = block.match(/\bid: ([\w-]+)/)?.[1];
      if (!id) continue;
      const re = /- type: javascript\s*\n\s*value: file:\/\/\S+\s*\n(?:\s*config: (\{.*\})\s*\n)?\s*metric: (\w+)/g;
      for (const m of block.matchAll(re)) {
        if (!m[1]) continue;
        const json = m[1]
          .replace(/'((?:[^'\\]|\\.)*)'/g, (_, s) => JSON.stringify(s))
          .replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":');
        map.set(`${id}|${m[2]}`, JSON.parse(json));
      }
    }
  }
  return map;
}
const currentConfigs = loadCurrentConfigs();

function loadAssertion(value) {
  const rel = value.slice('file://'.length);
  return require(path.resolve(configsDir, rel));
}

function regradeFile(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  let changed = 0;
  let total = 0;
  for (const row of data.results?.results || []) {
    const comps = row.gradingResult?.componentResults;
    if (!comps || row.response?.output === undefined) continue;
    for (const comp of comps) {
      const a = comp.assertion || {};
      if (a.type !== 'javascript' || typeof a.value !== 'string' || !a.value.startsWith('file://')) continue;
      const fn = loadAssertion(a.value);
      const fresh = currentConfigs.get(`${row.testCase?.metadata?.id}|${a.metric}`);
      if (fresh) a.config = fresh;
      const context = {
        prompt: row.prompt?.raw,
        vars: row.vars || row.testCase?.vars || {},
        test: row.testCase,
        ...(a.config ? { config: a.config } : {}),
        ...(row.response?.metadata ? { metadata: row.response.metadata } : {}),
      };
      const r = fn(String(row.response.output), context);
      total++;
      if (r.pass !== comp.pass || r.reason !== comp.reason) changed++;
      comp.pass = r.pass;
      comp.score = r.score;
      comp.reason = r.reason;
    }
    const pass = comps.every((c) => c.pass);
    row.gradingResult.pass = pass;
    row.success = pass;
    row.gradingResult.reason = pass ? 'All assertions passed' : comps.filter((c) => !c.pass).map((c) => c.reason).join(' | ');
  }
  data.regradedAt = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return { changed, total };
}

const files = process.argv.slice(2).filter((f) => fs.existsSync(f));
if (files.length === 0) {
  console.error('Uso: node scripts/regrade.js <export.json> [...]');
  process.exit(1);
}
for (const f of files) {
  const { changed, total } = regradeFile(f);
  console.log(`${f}: ${total} aserciones re-evaluadas, ${changed} con veredicto o motivo distinto.`);
}
