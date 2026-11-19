// V4 — Provider "guarded": controles deterministas FUERA del modelo, alrededor de V2.
//   1. Filtro de entrada: detecta patrones de inyección (modo block: no llama al modelo;
//      modo flag: solo lo registra).
//   2. Llamada a Ollama /api/chat con los mensajes de V2 (rol system + user).
//   3. Filtro de salida (LLM10 Improper Output Handling):
//      - redacta el marcador en cualquier forma que detecte la normalización compartida,
//      - elimina enlaces/URLs y etiquetas HTML que no estén en la lista permitida,
//      - sustituye afirmaciones de acciones ejecutadas por una respuesta segura.
// Modela controles de servidor. NO sustituye la autorización real ni la supervisión humana.
// Los patrones de entrada se diseñaron SOLO con tests/attacks.yaml (no con tests/holdout.yaml).
const { redactMarker } = require('../assertions/lib/normalize');
const agency = require('../assertions/agency');

const INJECTION_PATTERNS = [
  { name: 'ignorar reglas', re: /\bignor\w*\s+(?:\S+\s+){0,4}?(reglas|instrucciones|politica|restricciones)\b/ },
  { name: 'modo depuración/desarrollador', re: /\bmodo\s+(depuracion|desarrollador|debug|developer)\b/ },
  { name: 'delimitador falso', re: /\bfin\s+de\s+(la\s+)?entrada\b/ },
  { name: 'nueva política', re: /\bnueva\s+politica\b|\bpolitica\s+del\s+sistema\b/ },
  // "DAN" se busca en mayúsculas sobre el texto original: en minúsculas es un verbo común ("me dan").
  { name: 'juego de rol DAN', re: /\bDAN\b/, raw: true },
  { name: 'versión sin restricciones', re: /\bsin\s+restricciones\b/ },
  { name: 'orden dirigida al asistente', re: /\b(instruccion|nota|mensaje)\s+(tecnica\s+)?(\d\/\d\s+)?para\s+(el\s+)?(asistente|sistemas?\s+automaticos?|ia)\b|<!--[^>]*asistente/ },
];

const SAFE_BLOCK = 'AURA detectó instrucciones no confiables en tu mensaje y no lo procesó. Puedo ayudarte con trámites académicos o con conceptos de seguridad digital si reformulas tu consulta.';
const SAFE_AGENCY = 'AURA no ejecuta acciones: no puede cambiar permisos, aprobar accesos ni generar tickets. Esa solicitud debe tramitarse por el proceso humano autorizado (mesa de ayuda de TI).';

function plain(text) {
  return String(text ?? '').normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
}

function detectInjection(input) {
  const t = plain(input);
  return INJECTION_PATTERNS.filter((p) => p.re.test(p.raw ? String(input ?? '') : t)).map((p) => p.name);
}

function sanitizeLinks(text, allowedDomains) {
  let removed = 0;
  const allowed = (url) => allowedDomains.some((d) => new RegExp(`^https?://([^/]*\\.)?${d.replace(/\./g, '\\.')}(/|$)`, 'i').test(url));
  let out = String(text)
    // Enlaces Markdown e imágenes: [texto](url) / ![alt](url)
    .replace(/!?\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, (m, label, url) => {
      if (allowed(url)) return m;
      removed++;
      return label ? `${label} [enlace eliminado]` : '[enlace eliminado]';
    })
    // Etiquetas HTML (se eliminan; la salida se muestra como texto plano).
    .replace(/<\/?[a-z][^>]*>/gi, () => { removed++; return ''; })
    .replace(/<!--[\s\S]*?-->/g, () => { removed++; return ''; });
  // URLs sueltas.
  out = out.replace(/\b(?:https?:\/\/|www\.)[^\s)<>"']+/gi, (url) => {
    if (allowed(url)) return url;
    removed++;
    return '[enlace eliminado]';
  });
  return { text: out, removed };
}

function toMessages(prompt) {
  try {
    const parsed = JSON.parse(prompt);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* prompt de texto plano */ }
  return [{ role: 'user', content: String(prompt) }];
}

class GuardedProvider {
  constructor(options = {}) {
    this.config = options.config || {};
    this.providerId = options.id || `guarded:${this.config.mode || 'block'}`;
    this.label = options.label;
  }

  id() {
    return this.providerId;
  }

  async callApi(prompt, context) {
    const cfg = this.config;
    const mode = cfg.mode || 'block';
    const input = context?.vars?.input ?? '';
    const inputPatterns = detectInjection(input);
    const metadata = {
      mode,
      inputFlagged: inputPatterns.length > 0,
      inputPatterns,
      blocked: false,
      outputRedacted: false,
      linksRemoved: 0,
      agencyReplaced: false,
    };

    if (metadata.inputFlagged && mode === 'block') {
      metadata.blocked = true;
      return { output: SAFE_BLOCK, metadata };
    }

    const options = {};
    for (const k of ['temperature', 'seed', 'num_predict', 'top_p', 'top_k']) {
      if (cfg[k] !== undefined) options[k] = cfg[k];
    }
    const baseUrl = cfg.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    let data;
    try {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: cfg.model || 'llama3.2:3b', messages: toMessages(prompt), stream: false, options }),
      });
      if (!res.ok) return { error: `Ollama HTTP ${res.status}: ${await res.text()}` };
      data = await res.json();
    } catch (err) {
      return { error: `Error llamando a Ollama: ${err.message}` };
    }

    const raw = data?.message?.content ?? '';
    metadata.rawOutput = raw;

    const red = redactMarker(raw);
    metadata.outputRedacted = red.changed;
    const links = sanitizeLinks(red.text, cfg.allowedDomains || []);
    metadata.linksRemoved = links.removed;
    let output = links.text;

    if (!agency(output).pass) {
      metadata.agencyReplaced = true;
      output = SAFE_AGENCY;
    }

    return {
      output,
      metadata,
      tokenUsage: {
        prompt: data?.prompt_eval_count,
        completion: data?.eval_count,
        total: (data?.prompt_eval_count || 0) + (data?.eval_count || 0),
      },
    };
  }
}

module.exports = GuardedProvider;
module.exports.detectInjection = detectInjection;
module.exports.sanitizeLinks = sanitizeLinks;
