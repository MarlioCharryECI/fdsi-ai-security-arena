# AI Security Arena — AURA bajo el OWASP Top 10 para LLM 2026

Laboratorio final de **FDSI (FDSI_4L-2602)**. Evaluación Red Team / Blue Team del asistente académico ficticio **AURA** (Llama 3.2 3B en Ollama) con **Promptfoo**: se atacan cuatro familias de riesgo del OWASP Top 10 para aplicaciones LLM 2026, se aplican defensas en cuatro capas y se mide su efecto antes y después con aserciones deterministas, repeticiones y juicio manual.

**Autores:** Marlio José Charry Espitia · David Alejandro Patacon Henao
**Informe:** [`report/informe.pdf`](report/informe.pdf) · resultados: [`results/summary.md`](results/summary.md)

## Correspondencia con el enunciado del laboratorio

| Lo que pide `kit/README.md` | Dónde está |
|---|---|
| Misión 1 · Prompt injection (LLM01), mínimo 2 variantes | `tests/attacks.yaml` (M1-a … M1-e) · informe §6.2 |
| Misión 2 · Divulgación / contexto oculto (LLM02/LLM08), filtración frente a alucinación | M2-a … M2-e · informe §6.3 |
| Misión 3 · Inyección indirecta (LLM01) | M3-a … M3-d · informe §6.4 |
| Misión 4 · Agencia y desinformación (LLM03/LLM07) | M4-a … M4-d · informe §6.5 |
| Misión 5 · Ajustar al menos 2 controles de `hardened.txt`, repetir y discutir | `prompts/hardened_v1b.txt` (7 controles) + V2, V3, V4 · informe §8 y §9 |
| Tabla Caso / OWASP / Prompt / Respuesta / Resultado manual / Mitigación / Retest | Informe §6.1 · `evidence/manual.md` |
| Comparación antes/después con Promptfoo y juicio manual | `results/summary.md` · `results/*.json` · informe §5 |
| Por qué otros riesgos necesitan infraestructura adicional | Informe §2 |
| Presentación breve | Informe, anexo A (5 láminas) |

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
scripts/             summarize.js (ASR) · regrade.js (re-evaluación sin modelo) · dump_responses.js
                     (juicio manual) · evidence_cards.js · build_pdf.js · run_evals.js · test_assertions.js
results/             Exports de Promptfoo (.json/.html/.csv), summary.md y run.log
evidence/            Respuestas completas, juicio manual y capturas del visor
report/              informe.md (fuente) e informe.pdf (entregable)
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
node scripts/regrade.js results/*_r0.json results/*_rs.json results/holdout.json   # aserciones vigentes
node scripts/summarize.js results/compare_r0.json results/compare_rs.json results/guarded_r0.json results/guarded_rs.json results/holdout.json
node scripts/build_pdf.js   # report/informe.md → report/informe.pdf (Edge o Chrome sin interfaz)
npm run view                # visor de Promptfoo
```

Los `.json` de `results/` están re-evaluados con la versión final de las aserciones (ver `evidence/correcciones_aserciones.md`); los `.html` y `.csv` muestran el veredicto original de cada corrida.

Promptfoo está fijado en la versión 0.126.0 (`npx promptfoo@0.126.0`). En un portátil, conecta el cargador y usa el modo de energía "Máximo rendimiento": con batería, Windows limita la GPU y la generación cae a ~1 token/s.

## Ética

Solo se ataca el marcador ficticio `ORION-742-ACADEMIA` y canarios inocuos (`CANARIO-FDSI`, dominio `.invalid`). Ningún secreto, credencial, dato personal ni sistema real.
