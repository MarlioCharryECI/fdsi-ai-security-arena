// Genera report/informe.pdf a partir de report/informe.md.
// 1. Markdown → HTML con `marked` (vía npx, sin dependencias en el repo).
// 2. Envuelve el HTML con estilos de impresión (A4).
// 3. Imprime a PDF con Microsoft Edge o Google Chrome en modo headless.
// Uso: node scripts/build_pdf.js
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const md = path.join(root, 'report', 'informe.md');
const body = path.join(root, 'report', 'informe.body.html');
const html = path.join(root, 'report', 'informe.html');
const pdf = path.join(root, 'report', 'informe.pdf');

execFileSync('npx', ['--yes', 'marked@15.0.12', '--gfm', '-i', md, '-o', body], { stdio: 'inherit', shell: true });
const content = fs.readFileSync(body, 'utf8');
fs.unlinkSync(body);

const css = `
@page { size: A4; margin: 18mm 16mm 18mm 16mm; }
:root { --ink: #1d232a; --muted: #5b6672; --line: #d5dae0; --accent: #8a1c2b; --soft: #f4f6f8; }
* { box-sizing: border-box; }
html { font-size: 10.2pt; }
body { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; color: var(--ink); line-height: 1.45; margin: 0; }
h1, h2, h3, h4 { font-family: Georgia, "Times New Roman", serif; color: var(--ink); line-height: 1.2; break-after: avoid; }
h2 { font-size: 16pt; margin: 22pt 0 8pt; padding-bottom: 4pt; border-bottom: 2px solid var(--accent); }
h3 { font-size: 12.5pt; margin: 14pt 0 6pt; }
h4 { font-size: 11pt; margin: 10pt 0 4pt; color: var(--accent); }
p, li { orphans: 3; widows: 3; }
a { color: var(--accent); text-decoration: none; }
code { font-family: Consolas, "Cascadia Mono", monospace; font-size: 0.88em; background: var(--soft); padding: 0 3px; border-radius: 3px; }
pre { background: var(--soft); border: 1px solid var(--line); border-radius: 4px; padding: 7pt 9pt; font-size: 8.4pt; white-space: pre-wrap; word-break: break-word; break-inside: avoid; }
pre code { background: none; padding: 0; }
table { border-collapse: collapse; width: 100%; margin: 8pt 0 12pt; font-size: 8.6pt; break-inside: auto; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
th, td { border: 1px solid var(--line); padding: 3.5pt 5pt; vertical-align: top; text-align: left; }
th { background: #e9edf1; font-weight: 600; }
tbody tr:nth-child(even) td { background: #fafbfc; }
blockquote { margin: 8pt 0; padding: 6pt 10pt; border-left: 3px solid var(--accent); background: var(--soft); color: #333; }
.portada { height: 255mm; display: flex; flex-direction: column; justify-content: center; break-after: page; border-left: 6px solid var(--accent); padding-left: 16mm; }
.portada h1 { font-size: 34pt; margin: 0 0 10pt; border: none; }
.portada h2 { font-size: 15pt; font-weight: normal; border: none; color: var(--muted); margin: 0 0 30pt; }
.portada p { font-size: 11.5pt; margin: 3pt 0; }
.salto { break-before: page; }
.lamina { break-before: page; border: 1px solid var(--line); border-top: 8px solid var(--accent); border-radius: 6px; padding: 14mm 14mm; min-height: 118mm; margin-bottom: 8mm; }
.lamina + .lamina { break-before: auto; }
.lamina h3 { font-size: 20pt; margin-top: 0; }
.lamina p, .lamina li { font-size: 12pt; }
.lamina table { font-size: 10pt; }
.nota { color: var(--muted); font-size: 8.6pt; }
img { max-width: 100%; border: 1px solid var(--line); border-radius: 4px; }
figure { margin: 8pt 0 12pt; break-inside: avoid; }
figcaption { color: var(--muted); font-size: 8.6pt; margin-top: 3pt; }
`;

fs.writeFileSync(
  html,
  `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>AI Security Arena — Informe</title><style>${css}</style></head><body>${content}</body></html>`,
);

const browsers = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];
const browser = browsers.find((b) => fs.existsSync(b));
if (!browser) {
  console.error(`No se encontró Edge ni Chrome. Abre ${html} en un navegador e imprime a PDF.`);
  process.exit(1);
}
execFileSync(browser, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${pdf}`, `file:///${html.replace(/\\/g, '/')}`], { stdio: 'ignore' });
console.log(`PDF generado: ${pdf}`);
