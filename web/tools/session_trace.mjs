#!/usr/bin/env node
// Traza real de una sesión de Meditar en el navegador: qué frase suena, cuándo acaba, si algo
// la corta y qué hay en pantalla en cada momento (parte, texto o círculo). Sirve para
// comprobar la sesión de principio a fin tal como la vive una persona (ADR-026).
//
// Va contra la compilación de producción, no contra el servidor de desarrollo (que monta la
// pantalla dos veces y corta «Empecemos»):
//   ./node_modules/.bin/vite build && ./node_modules/.bin/vite preview --port 5190 &
//   node tools/session_trace.mjs http://localhost:5190 [minutos=20] [segundos a observar=120] [Serena|Ryan]
// Los audios suenan a su velocidad: una sesión entera de diez minutos tarda diez minutos.
// Con SPEED=8 (hasta 16) el reloj de la página y los audios van ocho veces más deprisa, y
// los tiempos de la traza se dan en segundos de sesión: diez minutos se recorren en poco más de uno.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('@playwright/test');

const [base, minutes = '20', watch = '120', voice = 'Serena'] = process.argv.slice(2);
if (!base) { console.error('uso: node tools/session_trace.mjs <dirección> [minutos] [segundos] [Serena|Ryan]'); process.exit(1); }
const PW = 'clave-de-prueba';
const SPEED = Math.min(16, Math.max(1, Number(process.env.SPEED ?? 1)));

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES', timezoneId: 'Europe/Madrid', baseURL: base });
const page = await ctx.newPage();
const out = (s) => console.log(s);
page.on('console', (m) => { const t = m.text(); if (t.startsWith('TRACE ')) out(t.slice(6)); });
page.on('pageerror', (e) => out('PAGEERROR ' + e.message));

await page.addInitScript((K) => {
  try { localStorage.setItem('remanso.biometria.rechazada', '1'); } catch { /* nada */ }
  if (K > 1) {
    const si = window.setInterval, st = window.setTimeout;
    window.setInterval = (f, d, ...a) => si(f, (d ?? 0) / K, ...a);
    window.setTimeout = (f, d, ...a) => st(f, (d ?? 0) / K, ...a);
  }
  const start = { t: 0 };
  const now = () => ((performance.now() - start.t) * K / 1000).toFixed(1).padStart(6);
  const log = (s) => console.log(`TRACE ${now()}s  ${s}`);
  window.__traceStart = () => { start.t = performance.now(); };
  const name = (a) => (a.currentSrc || a.src || '').split('/').slice(-1)[0] || '(sin src)';
  const seen = new WeakSet();
  const hook = (a) => {
    if (seen.has(a)) return; seen.add(a);
    a.addEventListener('playing', () => log(`VOZ suena    ${name(a)} (dura ${a.duration.toFixed(1)}s)`));
    a.addEventListener('ended', () => log(`VOZ termina  ${name(a)}`));
    a.addEventListener('error', () => log(`VOZ error    ${name(a)}`));
  };
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { hook(this); this.defaultPlaybackRate = K; this.playbackRate = K; return play.apply(this, arguments); };
  const d = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
  Object.defineProperty(HTMLMediaElement.prototype, 'src', {
    configurable: true, enumerable: true, get() { return d.get.call(this); },
    set(v) {
      if (/\/voz\//.test(d.get.call(this)) && !this.paused && !this.ended) log(`VOZ CORTADA  ${name(this)} a los ${this.currentTime.toFixed(1)}s de ${this.duration.toFixed(1)}s, por ${String(v).split('/').slice(-1)[0]}`);
      d.set.call(this, v);
    },
  });
  let last = '';
  const look = () => {
    const title = document.querySelector('.med-stage .topbar .t-foot')?.textContent ?? '';
    const circle = !!document.querySelector('.med-stage .breath');
    const text = document.querySelector('.med-stage .med-text')?.textContent ?? '';
    const s = title ? `PANTALLA     ${title}${circle ? '  [CÍRCULO]' : `  «${text.slice(0, 50)}…»`}` : (document.querySelector('h1')?.textContent ?? '');
    if (s !== last) { last = s; if (title || /sientes/.test(s)) log(s); }
  };
  document.addEventListener('DOMContentLoaded', () => new MutationObserver(look).observe(document.body, { subtree: true, childList: true, characterData: true }));
}, SPEED);

await page.goto('/');
for (let i = 0; i < 7; i++) await page.getByRole('button', { name: 'Siguiente' }).click();
await page.getByRole('button', { name: 'Entendido' }).last().click();
await page.getByLabel('Contraseña nueva').fill(PW);
await page.getByLabel('Repite la contraseña').fill(PW);
await page.getByRole('button', { name: 'Crear' }).last().click();
await page.getByRole('heading', { level: 1 }).filter({ hasText: 'de 2026' }).waitFor({ timeout: 20000 });
await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Más', exact: true }).click();
await page.getByRole('link', { name: /^Meditar\b/ }).first().click();
await page.getByRole('button', { name: `${minutes} min`, exact: true }).click();
if (voice !== 'Serena') await page.getByRole('button', { name: new RegExp('^' + voice) }).click();
const start = page.getByRole('button', { name: /^Empezar/ });
await start.scrollIntoViewIfNeeded();
await page.evaluate(() => window.__traceStart());
await start.click({ timeout: 5000 }).catch(() => start.dispatchEvent('click'));
out(`--- sesión de ${minutes} min, voz ${voice}, observando ${watch}s ---`);
const end = Date.now() + Number(watch) * 1000 / SPEED;
while (Date.now() < end) {
  await page.waitForTimeout(250);
  if (await page.getByRole('heading', { name: '¿Cómo te sientes ahora?' }).count()) { out('--- formulario final ---'); break; }
}
await browser.close();
