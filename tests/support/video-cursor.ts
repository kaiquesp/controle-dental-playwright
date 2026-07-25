import type { BrowserContext, Page } from '@playwright/test';

/** Injeta cursor e indicador de clique visíveis nas gravações de vídeo do Playwright. */
export async function installVideoCursor(page: Page): Promise<void> {
  await page.addInitScript(installVideoCursorScript);
}

export async function installVideoCursorOnContext(context: BrowserContext): Promise<void> {
  await context.addInitScript(installVideoCursorScript);
}

function installVideoCursorScript(): void {
  if (window.__e2eVideoCursorInstalled) return;
  window.__e2eVideoCursorInstalled = true;

  const STYLE_ID = 'e2e-video-cursor-styles';

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
    document.head.appendChild(style);
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
    document.body.appendChild(cursor);
    return cursor;
  };

  const moveCursor = (x: number, y: number): void => {
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
    document.body.appendChild(ripple);
    window.setTimeout(() => ripple.remove(), 450);
  };

  const onPointerDown = (event: PointerEvent): void => {
    moveCursor(event.clientX, event.clientY);
    const cursor = ensureCursor();
    cursor.classList.add('is-clicking');
    window.setTimeout(() => cursor.classList.remove('is-clicking'), 160);
    showRipple(event.clientX, event.clientY);
  };

  const boot = (): void => {
    const centerX = Math.round(window.innerWidth / 2);
    const centerY = Math.round(window.innerHeight / 3);
    moveCursor(centerX, centerY);
    window.addEventListener('pointermove', (event) => moveCursor(event.clientX, event.clientY), true);
    window.addEventListener('mousemove', (event) => moveCursor(event.clientX, event.clientY), true);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('mousedown', onPointerDown, true);
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
  }
}
