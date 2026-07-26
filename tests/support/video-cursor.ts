import type { BrowserContext, Mouse, Page } from '@playwright/test';

const CURSOR_PATCHED = Symbol('e2eVideoCursorPatched');

/** Injeta cursor visível nas gravações e sincroniza com ações do Playwright (mouse.move/click). */
export async function installVideoCursor(page: Page): Promise<void> {
  await page.addInitScript(installVideoCursorScript);
}

export async function installVideoCursorOnContext(context: BrowserContext): Promise<void> {
  await context.addInitScript(installVideoCursorScript);
}

export async function instrumentVideoCursor(page: Page): Promise<void> {
  const mouse = page.mouse as Mouse & { [CURSOR_PATCHED]?: boolean };
  if (mouse[CURSOR_PATCHED]) {
    return;
  }
  mouse[CURSOR_PATCHED] = true;

  await installVideoCursor(page);

  let cursorX = 0;
  let cursorY = 0;
  let initialized = false;

  const syncCursor = async (x: number, y: number, clicking = false): Promise<void> => {
    cursorX = x;
    cursorY = y;
    await page
      .evaluate(
        ({ px, py, click }) => {
          window.__e2eVideoCursorSync?.(px, py, click);
        },
        { px: x, py: y, click: clicking }
      )
      .catch(() => undefined);
  };

  const initPosition = async (): Promise<void> => {
    if (initialized) {
      return;
    }
    const viewport = page.viewportSize();
    cursorX = Math.round((viewport?.width ?? 1280) / 2);
    cursorY = Math.round((viewport?.height ?? 720) / 3);
    await syncCursor(cursorX, cursorY);
    initialized = true;
  };

  const animateTo = async (targetX: number, targetY: number): Promise<void> => {
    await initPosition();
    const startX = cursorX;
    const startY = cursorY;
    const distance = Math.hypot(targetX - startX, targetY - startY);

    if (distance < 4) {
      await syncCursor(targetX, targetY);
      return;
    }

    const steps = Math.min(12, Math.max(4, Math.round(distance / 40)));
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      const eased = 1 - (1 - t) ** 2;
      const x = startX + (targetX - startX) * eased;
      const y = startY + (targetY - startY) * eased;
      await syncCursor(x, y);
      if (step < steps) {
        await page.waitForTimeout(6);
      }
    }
  };

  const wrapMove =
    (original: Mouse['move']) =>
    async (x: number, y: number, options?: Parameters<Mouse['move']>[2]) => {
      await animateTo(x, y);
      return original(x, y, options);
    };

  const wrapClick =
    (original: Mouse['click']) =>
    async (x: number, y: number, options?: Parameters<Mouse['click']>[2]) => {
      await animateTo(x, y);
      await syncCursor(x, y, true);
      return original(x, y, options);
    };

  const wrapDown =
    (original: Mouse['down']) =>
    async (options?: Parameters<Mouse['down']>[0]) => {
      await syncCursor(cursorX, cursorY, true);
      return original(options);
    };

  const wrapUp =
    (original: Mouse['up']) =>
    async (options?: Parameters<Mouse['up']>[0]) => {
      return original(options);
    };

  const wrapDblClick =
    (original: Mouse['dblclick']) =>
    async (x: number, y: number, options?: Parameters<Mouse['dblclick']>[2]) => {
      await animateTo(x, y);
      await syncCursor(x, y, true);
      const result = await original(x, y, options);
      await syncCursor(x, y, true);
      return result;
    };

  mouse.move = wrapMove(mouse.move.bind(mouse));
  mouse.click = wrapClick(mouse.click.bind(mouse));
  mouse.dblclick = wrapDblClick(mouse.dblclick.bind(mouse));
  mouse.down = wrapDown(mouse.down.bind(mouse));
  mouse.up = wrapUp(mouse.up.bind(mouse));

  page.on('load', () => {
    initialized = false;
    void initPosition();
  });
}

export async function instrumentVideoCursorOnContext(context: BrowserContext): Promise<void> {
  await installVideoCursorOnContext(context);

  for (const page of context.pages()) {
    await instrumentVideoCursor(page);
  }

  context.on('page', (page) => {
    void instrumentVideoCursor(page);
  });
}

function installVideoCursorScript(): void {
  if (window.__e2eVideoCursorInstalled) return;
  window.__e2eVideoCursorInstalled = true;

  const STYLE_ID = 'e2e-video-cursor-styles';
  let posX = Math.round(window.innerWidth / 2);
  let posY = Math.round(window.innerHeight / 3);

  const ensureStyles = (): void => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #e2e-video-cursor {
        position: fixed;
        z-index: 2147483647;
        pointer-events: none;
        transform: translate(-2px, -2px);
        filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.45));
        will-change: left, top;
        transition: left 40ms linear, top 40ms linear;
      }
      #e2e-video-cursor.is-clicking svg {
        animation: e2e-video-cursor-click 140ms ease-out;
      }
      @keyframes e2e-video-cursor-click {
        0% { transform: scale(1); }
        45% { transform: scale(0.82); }
        100% { transform: scale(1); }
      }
      .e2e-video-cursor-ripple {
        position: fixed;
        z-index: 2147483646;
        width: 28px;
        height: 28px;
        margin-left: -14px;
        margin-top: -14px;
        border: 2px solid rgba(20, 184, 166, 0.95);
        border-radius: 999px;
        pointer-events: none;
        animation: e2e-video-cursor-ripple 420ms ease-out forwards;
      }
      @keyframes e2e-video-cursor-ripple {
        0% { transform: scale(0.35); opacity: 0.95; }
        100% { transform: scale(2.2); opacity: 0; }
      }
    `;
    (document.head ?? document.documentElement).appendChild(style);
  };

  const ensureCursor = (): HTMLDivElement => {
    let cursor = document.getElementById('e2e-video-cursor') as HTMLDivElement | null;
    if (cursor) return cursor;

    cursor = document.createElement('div');
    cursor.id = 'e2e-video-cursor';
    cursor.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#ffffff" stroke="#0f172a" stroke-width="1.2"
          d="M4 3l14 9.5-6.2 1.4L9.5 20z"/>
      </svg>
    `;
    (document.body ?? document.documentElement).appendChild(cursor);
    return cursor;
  };

  const moveCursor = (x: number, y: number): void => {
    posX = x;
    posY = y;
    ensureStyles();
    const cursor = ensureCursor();
    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
  };

  const showRipple = (x: number, y: number): void => {
    ensureStyles();
    const ripple = document.createElement('div');
    ripple.className = 'e2e-video-cursor-ripple';
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    (document.body ?? document.documentElement).appendChild(ripple);
    window.setTimeout(() => ripple.remove(), 450);
  };

  const pulseClick = (x: number, y: number): void => {
    moveCursor(x, y);
    const cursor = ensureCursor();
    cursor.classList.add('is-clicking');
    window.setTimeout(() => cursor.classList.remove('is-clicking'), 160);
    showRipple(x, y);
  };

  window.__e2eVideoCursorSync = (x: number, y: number, clicking = false): void => {
    if (clicking) {
      pulseClick(x, y);
      return;
    }
    moveCursor(x, y);
  };

  const boot = (): void => {
    moveCursor(posX, posY);
    // Eventos reais do SO (debug headed manual) — complementam o sync do Playwright.
    window.addEventListener('pointermove', (event) => moveCursor(event.clientX, event.clientY), true);
    window.addEventListener('pointerdown', (event) => pulseClick(event.clientX, event.clientY), true);
  };

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
}

declare global {
  interface Window {
    __e2eVideoCursorInstalled?: boolean;
    __e2eVideoCursorSync?: (x: number, y: number, clicking?: boolean) => void;
  }
}
