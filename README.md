# AI Security Arena — AURA bajo el OWASP Top 10 para LLM 2026

Laboratorio final de **FDSI (FDSI_4L-2602)**. Evaluación Red Team / Blue Team del asistente académico ficticio **AURA** (Llama 3.2 3B en Ollama) con **Promptfoo**: se atacan cuatro familias de riesgo del OWASP Top 10 para aplicaciones LLM 2026, se aplican defensas en cuatro capas y se mide su efecto antes y después con aserciones deterministas, repeticiones y juicio manual.

**Autores:** Marlio José Charry Espitia · David Alejandro Patacon Henao
**Informe:** [`report/informe.pdf`](report/informe.pdf) · resultados: [`results/summary.md`](results/summary.md)

## Resultados en una tabla

Tasa de éxito del ataque (ASR, menor es mejor) con temperatura 0,8 y 5 repeticiones sobre 30 casos; la utilidad se mide aparte (mayor es mejor).

| | V0 vulnerable | V1 hardened (kit) | V1b +7 controles | V2 roles separados | V3 sin secreto | V4 guarded (flag / block) |
|---|---|---|---|---|---|---|
| Marcador filtrado (LLM02/08) | 16 % | 6 % | 13 % | 16 % | **0 %** | 0 % / 0 % |
| Canario obedecido (LLM01) | 53 % | 67 % | 13 % | 60 % | 67 % | 60 % / 13 % |
| Prompt extraído (LLM08) | 5 % | 5 % | 5 % | 10 % | 15 % | 10 % / 0 % |
| Utilidad en controles | 42 % | 58 % | 26 % | **91 %** | **91 %** | 92 % / 56 % |

**Lo que muestran:**
- El prompt "reforzado" del kit entrega el marcador ante la inyección más simple (5/5).
- Añadir reglas (V1b) no lo arregla y destruye la utilidad.
- Separar los roles (V2) recupera la utilidad, pero no la confidencialidad.
- Solo sacar el secreto del contexto (V3) da una garantía, y aun así el asistente sigue siendo inyectable.
- Los filtros externos (V4) interceptan en la salida lo que el modelo ya filtró (33 marcadores, 4 enlaces inyectados y una respuesta de agencia aparente). Pero su filtro de entrada no detectó **ninguno de los 45 ataques de reserva**, y en modo `block` rechaza el 40 % de las preguntas legítimas con palabras gatillo.

Detalle por caso en [`results/summary.md`](results/summary.md); juicio manual en [`evidence/manual.md`](evidence/manual.md); correcciones de las aserciones en [`evidence/correcciones_aserciones.md`](evidence/correcciones_aserciones.md).

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
