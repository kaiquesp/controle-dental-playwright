#!/usr/bin/env node
/**
 * Grava um vídeo explicativo da tela de Agenda com legendas, cursor simulado e destaque nos cliques.
 *
 * Pré-requisitos:
 * 1. npm run test:setup:app:headed  (ou :local:headed) — sessão em playwright/.auth/
 * 2. App e API acessíveis conforme E2E_TARGET
 *
 * Uso:
 *   npm run demo:agenda
 *   npm run demo:agenda:local
 *
 * Saída: output/demo-videos/agenda/agenda-demo-YYYY-MM-DD-HHmm.webm
 *
 * Viewport padrão: 1920x1080 (Full HD). Ajuste com DEMO_VIEWPORT_WIDTH / DEMO_VIEWPORT_HEIGHT.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(projectRoot, '.env') });
dotenv.config({ path: path.join(projectRoot, 'tests', '.env'), override: true });

const targetArg = process.argv[2];
const target =
  targetArg === 'local' || targetArg === 'app'
    ? targetArg
    : process.env.E2E_TARGET === 'local'
      ? 'local'
      : 'app';

const baseUrl =
  process.env.E2E_BASE_URL?.trim() ||
  (target === 'local' ? 'http://localhost:4200' : 'https://app.controledental.com.br');

const apiUrl =
  process.env.E2E_API_URL?.trim() ||
  (target === 'local' ? 'http://localhost:3000/api' : 'https://api.controledental.com.br/api');

const authDir = path.join(projectRoot, 'playwright', '.auth');
const authCandidates = [
  path.join(authDir, 'user-app.json'),
  path.join(authDir, 'user.json'),
];
const authFile = authCandidates.find((file) => fs.existsSync(file));

const outDir = path.join(projectRoot, 'output', 'demo-videos', 'agenda');
const recordDir = path.join(outDir, '.recordings');

const CAPTION_MS = Number.parseInt(process.env.DEMO_CAPTION_MS ?? '3200', 10);
const INTRO_CAPTION_MS = Number.parseInt(process.env.DEMO_INTRO_CAPTION_MS ?? '4800', 10);
const INTRO_TITLE_MS = Number.parseInt(process.env.DEMO_INTRO_TITLE_MS ?? '3500', 10);
const STEP_PAUSE_MS = Number.parseInt(process.env.DEMO_STEP_PAUSE_MS ?? '600', 10);
const FOCUS_MS = Number.parseInt(process.env.DEMO_FOCUS_MS ?? '700', 10);
const MOUSE_MOVE_MS = Number.parseInt(process.env.DEMO_MOUSE_MOVE_MS ?? '650', 10);
const VIEWPORT_WIDTH = Number.parseInt(process.env.DEMO_VIEWPORT_WIDTH ?? '1920', 10);
const VIEWPORT_HEIGHT = Number.parseInt(process.env.DEMO_VIEWPORT_HEIGHT ?? '1080', 10);
const headless = process.env.DEMO_HEADLESS === '1';

function timestampSlug() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function readTokenFromAuth() {
  if (!authFile) return null;
  const state = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
  for (const origin of state.origins ?? []) {
    const token = origin.localStorage?.find((item) => item.name === 'accessToken')?.value;
    if (token) return token;
  }
  return null;
}

async function dismissModals(page) {
  const skipTour = page.getByText('Pular tour', { exact: true });
  if (await skipTour.isVisible().catch(() => false)) {
    await skipTour.click();
    await page.waitForTimeout(300);
  }

  for (const label of [/Fechar/i, /Entendi/i, /Continuar/i]) {
    const button = page.getByRole('button', { name: label }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click({ timeout: 2000 }).catch(() => undefined);
      await page.waitForTimeout(200);
    }
  }
}

async function installDemoOverlays(page) {
  await page.addInitScript(() => {
    const STYLE_ID = 'e2e-demo-overlay-styles';

    const ensureStyles = () => {
      if (document.getElementById(STYLE_ID)) return;
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        @keyframes e2e-demo-ring-pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(20, 184, 166, 0.22), 0 0 18px rgba(20, 184, 166, 0.45); }
          50% { box-shadow: 0 0 0 8px rgba(20, 184, 166, 0.12), 0 0 28px rgba(20, 184, 166, 0.65); }
        }
        @keyframes e2e-demo-ripple {
          0% { transform: translate(-50%, -50%) scale(0.35); opacity: 0.95; }
          100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0; }
        }
        @keyframes e2e-demo-cursor-pop {
          0% { transform: translate(-50%, -50%) scale(0.7); opacity: 0; }
          30% { opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        @keyframes e2e-demo-mouse-click {
          0% { transform: translate(0, 0) scale(1); }
          45% { transform: translate(0, 1px) scale(0.86); }
          100% { transform: translate(0, 0) scale(1); }
        }
        #e2e-demo-mouse {
          position: fixed;
          z-index: 2147483647;
          pointer-events: none;
          will-change: left, top;
          filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.45));
        }
        #e2e-demo-mouse.is-clicking svg {
          animation: e2e-demo-mouse-click 160ms ease-out;
        }
        #e2e-demo-title-card {
          position: fixed;
          inset: 0;
          z-index: 2147483645;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(145deg, rgba(15, 23, 42, 0.94), rgba(15, 118, 110, 0.88));
          pointer-events: none;
          opacity: 0;
          transition: opacity 320ms ease;
        }
        #e2e-demo-title-card.is-visible {
          opacity: 1;
        }
        #e2e-demo-title-card__content {
          max-width: min(880px, calc(100vw - 96px));
          text-align: center;
          color: #f8fafc;
          padding: 40px 48px;
        }
        #e2e-demo-title-card__eyebrow {
          font: 600 16px/1.2 system-ui, -apple-system, Segoe UI, sans-serif;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #99f6e4;
          margin-bottom: 14px;
        }
        #e2e-demo-title-card__title {
          font: 700 42px/1.15 system-ui, -apple-system, Segoe UI, sans-serif;
          margin-bottom: 16px;
        }
        #e2e-demo-title-card__subtitle {
          font: 500 22px/1.45 system-ui, -apple-system, Segoe UI, sans-serif;
          color: #e2e8f0;
        }
      `;
      document.head.appendChild(style);
    };

    const ensureCaption = () => {
      let element = document.getElementById('e2e-demo-caption');
      if (element) return element;

      element = document.createElement('div');
      element.id = 'e2e-demo-caption';
      element.setAttribute('aria-live', 'polite');
      element.style.cssText = [
        'position:fixed',
        'bottom:28px',
        'left:50%',
        'transform:translateX(-50%)',
        'z-index:2147483646',
        'max-width:min(920px, calc(100vw - 48px))',
        'padding:14px 22px',
        'border-radius:12px',
        'background:rgba(15, 23, 42, 0.92)',
        'color:#f8fafc',
        'font:600 18px/1.45 system-ui, -apple-system, Segoe UI, sans-serif',
        'text-align:center',
        'box-shadow:0 12px 40px rgba(0,0,0,0.35)',
        'pointer-events:none',
        'transition:opacity 220ms ease',
      ].join(';');
      document.body.appendChild(element);
      return element;
    };

    const ensureFocusLayer = () => {
      let layer = document.getElementById('e2e-demo-focus-layer');
      if (layer) return layer;

      layer = document.createElement('div');
      layer.id = 'e2e-demo-focus-layer';
      layer.style.cssText = 'position:fixed;inset:0;z-index:2147483644;pointer-events:none;overflow:hidden;';
      document.body.appendChild(layer);
      return layer;
    };

    const ensureMouseCursor = () => {
      let cursor = document.getElementById('e2e-demo-mouse');
      if (cursor) return cursor;

      cursor = document.createElement('div');
      cursor.id = 'e2e-demo-mouse';
      cursor.innerHTML = `
        <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#ffffff" stroke="#0f172a" stroke-width="1.2"
            d="M4 3l14 9.5-6.2 1.4L9.5 20z"/>
        </svg>
      `;
      document.body.appendChild(cursor);
      return cursor;
    };

    if (!window.__demoMouseState) {
      window.__demoMouseState = { x: 960, y: 270 };
    }

    window.__demoEnsureMouse = () => {
      ensureStyles();
      const cursor = ensureMouseCursor();
      const { x, y } = window.__demoMouseState;
      cursor.style.left = `${x}px`;
      cursor.style.top = `${y}px`;
    };

    window.__demoMoveMouseTo = (targetX, targetY, duration = 650) =>
      new Promise((resolve) => {
        ensureStyles();
        const cursor = ensureMouseCursor();
        const state = window.__demoMouseState;
        const startX = state.x;
        const startY = state.y;
        const startTime = performance.now();

        const tick = (now) => {
          const progress = Math.min(1, (now - startTime) / duration);
          const eased = 1 - (1 - progress) ** 3;
          const x = startX + (targetX - startX) * eased;
          const y = startY + (targetY - startY) * eased;

          state.x = x;
          state.y = y;
          cursor.style.left = `${x}px`;
          cursor.style.top = `${y}px`;

          if (progress < 1) {
            requestAnimationFrame(tick);
          } else {
            resolve();
          }
        };

        requestAnimationFrame(tick);
      });

    window.__demoClickMouse = () => {
      const cursor = ensureMouseCursor();
      cursor.classList.add('is-clicking');
      window.setTimeout(() => cursor.classList.remove('is-clicking'), 180);
    };

    window.__demoShowCaption = (text) => {
      ensureStyles();
      const element = ensureCaption();
      element.textContent = text;
      element.style.opacity = '1';
    };

    window.__demoHideCaption = () => {
      const element = document.getElementById('e2e-demo-caption');
      if (element) element.style.opacity = '0';
    };

    const ensureTitleCard = () => {
      let card = document.getElementById('e2e-demo-title-card');
      if (card) return card;

      card = document.createElement('div');
      card.id = 'e2e-demo-title-card';
      card.innerHTML = `
        <div id="e2e-demo-title-card__content">
          <div id="e2e-demo-title-card__eyebrow"></div>
          <div id="e2e-demo-title-card__title"></div>
          <div id="e2e-demo-title-card__subtitle"></div>
        </div>
      `;
      document.body.appendChild(card);
      return card;
    };

    window.__demoShowTitleCard = ({ eyebrow, title, subtitle }) => {
      ensureStyles();
      const card = ensureTitleCard();
      card.querySelector('#e2e-demo-title-card__eyebrow').textContent = eyebrow ?? '';
      card.querySelector('#e2e-demo-title-card__title').textContent = title ?? '';
      card.querySelector('#e2e-demo-title-card__subtitle').textContent = subtitle ?? '';
      card.classList.add('is-visible');
    };

    window.__demoHideTitleCard = () => {
      const card = document.getElementById('e2e-demo-title-card');
      if (card) card.classList.remove('is-visible');
    };

    window.__demoClearFocus = () => {
      const layer = document.getElementById('e2e-demo-focus-layer');
      if (layer) layer.replaceChildren();
    };

    window.__demoFocusRect = (rect) => {
      ensureStyles();
      const layer = ensureFocusLayer();
      layer.replaceChildren();

      const padding = 6;
      const ring = document.createElement('div');
      ring.id = 'e2e-demo-focus-ring';
      ring.style.cssText = [
        'position:fixed',
        `left:${rect.x - padding}px`,
        `top:${rect.y - padding}px`,
        `width:${rect.width + padding * 2}px`,
        `height:${rect.height + padding * 2}px`,
        'border:3px solid #14b8a6',
        'border-radius:10px',
        'animation:e2e-demo-ring-pulse 0.9s ease-in-out infinite',
        'transition:all 180ms ease',
      ].join(';');
      layer.appendChild(ring);
    };

    window.__demoPulseClick = (point) => {
      ensureStyles();
      const layer = ensureFocusLayer();
      const ripple = document.createElement('div');
      ripple.style.cssText = [
        'position:fixed',
        `left:${point.x}px`,
        `top:${point.y}px`,
        'width:44px',
        'height:44px',
        'border-radius:50%',
        'border:3px solid #5eead4',
        'background:rgba(20, 184, 166, 0.25)',
        'animation:e2e-demo-ripple 520ms ease-out forwards',
      ].join(';');
      layer.appendChild(ripple);
      window.setTimeout(() => ripple.remove(), 560);
    };
  });
}

function centerPoint(box) {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function moveMouseToBox(page, box, durationMs = MOUSE_MOVE_MS) {
  if (!box) return null;
  const point = centerPoint(box);
  await page.evaluate(
    ({ x, y, duration }) => window.__demoMoveMouseTo?.(x, y, duration),
    { x: point.x, y: point.y, duration: durationMs }
  );
  return point;
}

async function focusRect(page, box) {
  if (!box) return;
  await page.evaluate((rect) => window.__demoFocusRect?.(rect), box);
}

async function focusAndClick(page, locator, options = {}) {
  const focusMs = options.focusMs ?? FOCUS_MS;
  const moveMs = options.moveMs ?? MOUSE_MOVE_MS;

  await locator.scrollIntoViewIfNeeded().catch(() => undefined);
  const box = await locator.boundingBox();
  const point = await moveMouseToBox(page, box, moveMs);

  if (box) {
    await focusRect(page, box);
    await page.waitForTimeout(focusMs);
  }

  if (point) {
    await page.evaluate(() => window.__demoClickMouse?.());
    await page.evaluate((clickPoint) => window.__demoPulseClick?.(clickPoint), point);
    await page.waitForTimeout(140);
  }

  await locator.click(options.click ?? {});
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__demoClearFocus?.());
}

async function moveMouseToLocator(page, locator, options = {}) {
  await locator.scrollIntoViewIfNeeded().catch(() => undefined);
  const box = await locator.boundingBox();
  if (!box) return;

  await moveMouseToBox(page, box, options.moveMs ?? MOUSE_MOVE_MS);
  if (options.highlight) {
    await focusRect(page, box);
  }
}

async function showCaption(page, text, durationMs = CAPTION_MS) {
  await page.evaluate((caption) => window.__demoShowCaption?.(caption), text);
  await page.waitForTimeout(durationMs);
}

async function showTitleCard(page, { eyebrow, title, subtitle }, durationMs = INTRO_TITLE_MS) {
  await page.evaluate((payload) => window.__demoShowTitleCard?.(payload), { eyebrow, title, subtitle });
  await page.waitForTimeout(durationMs);
  await page.evaluate(() => window.__demoHideTitleCard?.());
  await page.waitForTimeout(400);
}

async function runIntro(page) {
  await showTitleCard(page, {
    eyebrow: 'Controle Dental',
    title: 'Agenda',
    subtitle: 'Visão geral para organizar o dia a dia da clínica',
  });

  await showCaption(
    page,
    'Este vídeo apresenta a Agenda do Controle Dental e mostra, na prática, como usar os recursos principais.',
    INTRO_CAPTION_MS
  );

  await showCaption(
    page,
    'A Agenda é o centro de planejamento da clínica: reúne consultas de pacientes, compromissos da equipe e tarefas do dia a dia.',
    INTRO_CAPTION_MS
  );

  await showCaption(
    page,
    'Com ela você visualiza horários, filtra por profissional, cria agendamentos e acompanha o status de cada atendimento.',
    INTRO_CAPTION_MS
  );

  await showCaption(page, 'A seguir, vamos percorrer as principais funcionalidades.', INTRO_CAPTION_MS - 800);
  await page.evaluate(() => window.__demoHideCaption?.());
  await pause(page, 500);
}

async function pause(page, ms = STEP_PAUSE_MS) {
  await page.waitForTimeout(ms);
}

async function waitForAgenda(page) {
  await page.goto('/agenda', { waitUntil: 'domcontentloaded' });
  await page.locator('.agenda-screen, app-agenda-content').first().waitFor({ state: 'visible', timeout: 30_000 });
  await dismissModals(page);
  await page
    .waitForResponse((response) => response.url().includes('/api/agenda/eventos'), { timeout: 20_000 })
    .catch(() => undefined);
}

async function listProfessionals(request, token) {
  const response = await request.get(`${apiUrl}/profissionais`, { headers: authHeaders(token) });
  if (!response.ok()) return [];
  const body = await response.json();
  return body.profissionais ?? [];
}

function uniqueSlot(offsetDays = 1) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const data = `${year}-${month}-${day}`;
  const hour = 10 + (Date.now() % 4);
  const minute = 30;
  const hora = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const endTotal = hour * 60 + minute + 30;
  const horaFim = `${String(Math.floor(endTotal / 60) % 24).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`;

  return { data, hora, horaFim };
}

async function seedDemoCompromisso(request, token) {
  const professionals = await listProfessionals(request, token);
  if (!professionals[0]) return null;

  const slot = uniqueSlot(1);
  const title = `Demo Agenda ${timestampSlug()}`;

  const response = await request.post(`${apiUrl}/agenda/compromissos`, {
    headers: authHeaders(token),
    data: {
      professional_id: professionals[0].id,
      data: slot.data,
      hora_inicio: slot.hora,
      hora_fim: slot.horaFim,
      titulo: title,
      descricao: 'Evento de demonstração — pode ser excluído.',
    },
  });

  if (!response.ok()) {
    console.warn(`[demo-agenda] Não foi possível seedar compromisso (${response.status()})`);
    return null;
  }

  const body = await response.json();
  const id = body.compromisso?.id ?? body.id;
  return { id, title, slot };
}

async function cleanupSeed(request, token, seed) {
  if (!seed?.id) return;
  await request
    .delete(`${apiUrl}/agenda/compromissos/${seed.id}`, { headers: authHeaders(token) })
    .catch(() => undefined);
}

async function runDemo(page, seed = null) {
  const agendaRoot = page.locator('.agenda-screen, app-agenda-content').first();

  await runIntro(page);
  await expectVisible(agendaRoot);

  await showCaption(
    page,
    'Esta é a tela da Agenda — a grade exibe os eventos do período selecionado.'
  );
  await pause(page, 800);

  if (seed) {
    await focusAndClick(page, page.getByRole('button', { name: 'Dia', exact: true }));
    await pause(page, 500);
    await focusAndClick(page, page.getByRole('button', { name: 'Próximo' }));
    await pause(page, 800);

    const eventCard = page.locator('.agenda-screen__event-card').filter({ hasText: seed.title }).first();
    if (await eventCard.isVisible().catch(() => false)) {
      await showCaption(page, 'Cada evento aparece na grade e pode ser aberto com um clique.');
      await moveMouseToLocator(page, eventCard, { highlight: true });
      await pause(page, 1200);
      await page.evaluate(() => window.__demoClearFocus?.());
      await focusAndClick(page, page.getByRole('button', { name: 'Hoje', exact: true }));
      await pause(page, 600);
    }
  }

  await showCaption(page, 'Alterne a visualização entre Dia, Semana e Mês conforme sua rotina.');
  for (const view of ['Dia', 'Semana', 'Mês']) {
    await focusAndClick(page, page.getByRole('button', { name: view, exact: true }));
    await pause(page, 900);
  }

  await showCaption(page, 'Use Anterior, Próximo e Hoje para navegar entre períodos.');
  await focusAndClick(page, page.getByRole('button', { name: 'Próximo' }));
  await pause(page, 700);
  await focusAndClick(page, page.getByRole('button', { name: 'Próximo' }));
  await pause(page, 700);
  await focusAndClick(page, page.getByRole('button', { name: 'Hoje', exact: true }));
  await pause(page, 900);

  await showCaption(page, 'Filtre por profissional para ver a grade de cada dentista.');
  const profFilter = page.getByRole('button', { name: /Todos os profissionais|profissional/i }).first();
  await focusAndClick(page, profFilter);
  await page.locator('#agenda-grade-profissionais-panel').waitFor({ state: 'visible', timeout: 8_000 });
  await pause(page, 900);
  const allProfessionals = page.getByRole('button', { name: /Todos os profissionais/i }).last();
  if (await allProfessionals.isVisible().catch(() => false)) {
    await focusAndClick(page, allProfessionals);
    await pause(page, 700);
  } else {
    await page.keyboard.press('Escape');
  }

  await showCaption(page, 'Em Outros filtros, refine por status e sala da clínica.');
  const otherFilters = page.getByRole('button', { name: /Outros filtros/i });
  if (await otherFilters.isVisible().catch(() => false)) {
    await focusAndClick(page, otherFilters);
    await page.getByText(/Status|Sala/i).first().waitFor({ state: 'visible', timeout: 8_000 }).catch(() => undefined);
    await pause(page, 900);
    await page.keyboard.press('Escape');
  }

  await showCaption(page, 'Clique em Novo agendamento para criar consulta, compromisso ou tarefa.');
  await focusAndClick(page, page.getByRole('button', { name: /Novo agendamento/i }).first());
  const dialog = page.locator('.agenda-schedule-dialog.p-dialog:visible, .agenda-schedule-dialog[role="dialog"]:visible').first();
  await dialog.waitFor({ state: 'visible', timeout: 10_000 });

  await showCaption(page, 'O modal possui três abas: Consulta, Compromisso e Tarefa.');
  for (const tab of ['Consulta', 'Compromisso', 'Tarefa']) {
    await focusAndClick(page, dialog.locator('[role="tablist"]').getByRole('button', { name: tab, exact: true }));
    await pause(page, 900);
  }

  await showCaption(page, 'Também é possível clicar em um horário livre diretamente na grade.');
  await closeScheduleDialog(page);
  const slot = page.getByRole('button', { name: /Novo agendamento às/i }).first();
  if (await slot.isVisible().catch(() => false)) {
    await focusAndClick(page, slot);
    await dialog.waitFor({ state: 'visible', timeout: 10_000 });
    await pause(page, 1200);
    await closeScheduleDialog(page);
  }

  await showCaption(page, 'Ajuste opções de visualização da grade, como layout compacto.');
  const viewOptions = page.getByRole('button', { name: 'Visualização da agenda' });
  if (await viewOptions.isVisible().catch(() => false)) {
    await focusAndClick(page, viewOptions);
    await page
      .locator('#agenda-grade-view-options-panel, [aria-label="Visualização da agenda"]')
      .first()
      .waitFor({ state: 'visible', timeout: 8_000 })
      .catch(() => undefined);
    await pause(page, 1000);
    await page.keyboard.press('Escape');
  }

  await focusAndClick(page, page.getByRole('button', { name: 'Dia', exact: true }));
  await pause(page, 500);

  await showCaption(page, 'Pronto! A Agenda reúne tudo o que sua clínica precisa planejar no dia a dia.', 3500);
  await page.evaluate(() => window.__demoHideCaption?.());
  await pause(page, 800);
}

async function closeScheduleDialog(page) {
  const dialog = page.locator('.agenda-schedule-dialog.p-dialog:visible, .agenda-schedule-dialog[role="dialog"]:visible').first();
  if (!(await dialog.isVisible().catch(() => false))) return;

  const closeButton = dialog.locator('.agenda-schedule-modal__close').first();
  if (await closeButton.isVisible().catch(() => false)) {
    await focusAndClick(page, closeButton);
  } else {
    const cancelButton = dialog.getByRole('button', { name: /^Cancelar$/i }).first();
    if (await cancelButton.isVisible().catch(() => false)) {
      await focusAndClick(page, cancelButton);
    } else {
      await page.keyboard.press('Escape');
    }
  }

  await dialog.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => undefined);
}

async function expectVisible(locator) {
  await locator.waitFor({ state: 'visible', timeout: 15_000 });
}

async function main() {
  if (!authFile) {
    console.error('[demo-agenda] Sessão ausente. Rode: npm run test:setup:app:headed');
    process.exit(1);
  }

  fs.mkdirSync(recordDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  const token = await readTokenFromAuth();
  const browser = await chromium.launch({
    headless,
    slowMo: headless ? 0 : 90,
  });

  const context = await browser.newContext({
    baseURL: baseUrl,
    storageState: authFile,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
    recordVideo: {
      dir: recordDir,
      size: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
    },
  });

  const page = await context.newPage();
  await installDemoOverlays(page);

  let seed = null;
  if (token) {
    seed = await seedDemoCompromisso(context.request, token);
    if (seed) {
      console.log(`[demo-agenda] Evento demo: "${seed.title}" em ${seed.slot.data} ${seed.slot.hora}`);
    }
  }

  console.log(`[demo-agenda] Gravando | target=${target} | app=${baseUrl} | ${VIEWPORT_WIDTH}x${VIEWPORT_HEIGHT}`);
  await waitForAgenda(page);
  await page.evaluate(
    ({ width, height }) => {
      window.__demoMouseState = { x: width / 2, y: height * 0.25 };
      window.__demoEnsureMouse?.();
    },
    { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT }
  );

  await runDemo(page, seed);

  const video = page.video();
  const outputPath = path.join(outDir, `agenda-demo-${timestampSlug()}.webm`);

  if (token) {
    await cleanupSeed(context.request, token, seed).catch(() => undefined);
  }

  await context.close();
  await browser.close();

  if (video) {
    await video.saveAs(outputPath);
    console.log(`[demo-agenda] Vídeo salvo em: ${outputPath}`);
  } else {
    console.warn('[demo-agenda] Nenhum vídeo foi gerado.');
  }
}

main().catch((error) => {
  console.error('[demo-agenda] Erro:', error);
  process.exit(1);
});
