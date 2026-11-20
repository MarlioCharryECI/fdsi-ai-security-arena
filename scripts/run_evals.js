// Ejecuta en secuencia los scripts npm de evaluación indicados y registra el avance en
// results/run.log. Pensado para lanzarse como proceso independiente (sobrevive al cierre
// de la terminal):
//   powershell Start-Process -WindowStyle Hidden node -ArgumentList 'scripts/run_evals.js','eval:compare:rs'
// Uso directo: node scripts/run_evals.js eval:guarded:r0 eval:compare:rs ...
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const log = path.join(root, 'results', 'run.log');
const stamp = () => new Date().toLocaleTimeString('es-CO', { hour12: false });
const write = (s) => fs.appendFileSync(log, `${s}\n`);

const scripts = process.argv.slice(2);
write(`== Inicio ${new Date().toISOString()} · ${scripts.join(', ')}`);
for (const s of scripts) {
  write(`[${stamp()}] ${s} …`);
  const r = spawnSync('npm', ['run', '-s', s, '--', '--no-table'], { cwd: root, shell: true, encoding: 'utf8' });
  const lines = `${r.stdout}\n${r.stderr}`.split('\n').filter((l) => /passed|failed|errors|Writing output|Error/i.test(l));
  for (const l of lines) write(`    ${l.trim()}`);
  write(`[${stamp()}] ${s} terminado (código ${r.status})`);
}
write(`== FIN ${new Date().toISOString()}`);
