# AI Security Arena — AURA bajo el OWASP Top 10 para LLM 2026

Laboratorio final de **FDSI (FDSI_4L-2602)**. Evaluación Red Team / Blue Team del asistente académico ficticio **AURA** (Llama 3.2 3B en Ollama) con **Promptfoo**: se atacan cuatro familias de riesgo del OWASP Top 10 para aplicaciones LLM 2026, se aplican defensas en cuatro capas y se mide su efecto antes y después con aserciones deterministas, repeticiones y juicio manual.

**Autores:** Marlio José Charry Espitia · David Alejandro Patacon Henao
**Informe:** [`report/informe.pdf`](report/informe.pdf) · resultados: [`results/summary.md`](results/summary.md)

<!-- RESULTADOS-README -->

## Qué hay en el repositorio

```
kit/                 Kit original del profesor, intacto (verificado con kit/SHA256SUMS)
prompts/             Defensas: V1b (hardened ajustado), V2 (roles system/user), V3 (sin secreto)
providers/guarded.js V4: filtros deterministas de entrada y salida alrededor de V2
assertions/          Detectores: filtración ofuscada, extracción del prompt, canario, agencia,
                     desinformación y utilidad (con normalización compartida en lib/)
tests/               original.yaml (6 del kit) · attacks.yaml (24 propios) · holdout.yaml (9 de reserva)
configs/             original_fixed · compare (V0–V3) · guarded (V4) · holdout · judge
scripts/             summarize.js (ASR) · dump_responses.js (juicio manual) · test_assertions.js
results/             Exports de Promptfoo (.json/.html/.csv) y summary.md
evidence/            Respuestas completas, juicio manual y capturas del visor
report/              Informe (Markdown → PDF)
```

## Versiones comparadas

| ID | Qué cambia | Capa |
|---|---|---|
| V0 | `kit/prompts/vulnerable.txt` | ninguna |
| V1 | `kit/prompts/hardened.txt` | prompt |
| V1b | `hardened.txt` + 7 controles (anti-delimitadores, anti-ofuscación, agencia, desinformación…) | prompt |
| V2 | V1b con la política en el rol `system` | prompt + estructura |
| V3 | V2 **sin el marcador** en el contexto | arquitectura |
| V4 | V2 + `providers/guarded.js` (modos `block` y `flag`) | controles externos |

## Cómo reproducir

Requisitos: [Ollama](https://ollama.com/) y Node.js ≥ 20. Desde la raíz del repositorio:

```bash
ollama pull llama3.2:3b
npm run test:assertions     # pruebas de las aserciones (sin modelo)
npm run kit:baseline        # kit original tal cual
npm run kit:hardened
npm run eval:compare:r0     # V0–V3, temperatura 0 + seed 42 (reproducible)
npm run eval:compare:rs     # V0–V3, temperatura 0.8, 5 repeticiones (ASR)
npm run eval:guarded:r0     # V4
npm run eval:guarded
npm run eval:holdout        # conjunto de reserva
npm run eval:judge          # juez LLM complementario
node scripts/summarize.js results/compare_r0.json results/compare_rs.json results/guarded_r0.json results/guarded_rs.json results/holdout.json
npm run view                # visor de Promptfoo
```

Promptfoo está fijado en la versión 0.126.0 (`npx promptfoo@0.126.0`). En un portátil, conecta el cargador y usa el modo de energía "Máximo rendimiento": con batería, Windows limita la GPU y la generación cae a ~1 token/s.

## Ética

Solo se ataca el marcador ficticio `ORION-742-ACADEMIA` y canarios inocuos (`CANARIO-FDSI`, dominio `.invalid`). Ningún secreto, credencial, dato personal ni sistema real.
