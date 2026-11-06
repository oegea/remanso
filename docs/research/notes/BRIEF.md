# Brief for research agents (shared)

You are one member of a research team preparing the scientific foundation of an
offline, privacy-first personal diary / notebook / goals / habit / behaviour-change
TUI application for a single adult user (self-help, no clinician). Today is 2026-11-05.

## Output
Write ONE markdown file at the path given in your prompt. Write in **Spanish**
(the project language), except for study titles, author names, scale names and
technical terms, which stay in their original language.

Structure, per topic/intervention:

### <Técnica o tema>
- **Mecanismo propuesto:** ...
- **Objetivo conductual:** ...
- **Evidencia a favor:** named studies with year, design (meta-analysis / RCT /
  cohort / theoretical), N or k when known, effect size *only if you actually
  read it* (Cohen's d, Hedges' g, OR, SMD...).
- **Limitaciones metodológicas:** ...
- **Calidad y consistencia de la evidencia:** Alta / Moderada / Baja / Muy baja
  (GRADE-like wording) + one line why.
- **Poblaciones estudiadas:** ...
- **Riesgos / efectos adversos:** ...
- **Frecuencia o dosis estudiada:** ...
- **Aplicabilidad a una app offline sin IA:** concrete, implementable idea or
  reason it does not translate.
- **Confianza en su utilidad:** Alta / Media / Baja.
- **Decisión sugerida:** Incluir / Incluir como experimental / Modificar / Descartar.

At the end of the file, a `## Referencias` section listing every source as:

`[Author et al., Year] Title. Journal. DOI: ... | PMID: ... | URL: ...`
followed by `Verificado: sí (leído el resumen/texto completo)` or
`Verificado: parcialmente (sólo listado de búsqueda)` or `NO verificado`.

## Hard rules
1. NEVER invent a reference, DOI, PMID, N, effect size or finding. If you recall a
   study but cannot open it or confirm it via a search result, mark it
   `NO verificado` and do not quote numbers from it.
2. Prefer: systematic reviews & meta-analyses > RCTs > clinical guidelines (NICE,
   WHO, APA) > longitudinal/experimental > observational/theoretical. Say which
   is which.
3. Distinguish theoretical frameworks (e.g. COM-B, SDT) from interventions with
   experimental efficacy evidence.
4. Look for both foundational work and recent publications (2020–2026).
5. Correlation ≠ causation. Flag when evidence is correlational.
6. Note explicitly what is *appropriate for an unsupervised self-help tool* and
   what should NOT be implemented without a clinician.
7. Use PubMed, Cochrane, Google Scholar, PsycNet, NICE, WHO, journal sites.
   Use WebSearch (load via ToolSearch "select:WebSearch" first) and WebFetch.
   Make many searches; read abstracts. Budget: aim for 12–25 well-verified
   references per file rather than 60 unverified ones.
8. Be concrete about *design implications*: what the app should do, what it
   should avoid, what defaults make sense, which wording to avoid.
9. Length: 1,500–4,000 words of body text plus references.
