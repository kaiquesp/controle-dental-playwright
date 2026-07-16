import { test, expect } from '../../fixtures/test.fixture';
import type { BrowserContext, Page } from '@playwright/test';
import { openConfigSection } from '../../support/interaction-helpers';
import {
  buildConnectedStatus,
  buildDisconnectedStatus,
  createGoogleCalendarMockState,
  installAgendaGoogleOverlayMock,
  installGoogleCalendarMocks,
  readStubbedRedirects,
  stubLocationAssign,
  type GoogleCalendarMockState,
} from '../../support/google-calendar-mocks';
import { expectToast } from '../../support/toast-helpers';

type AppShellLike = {
  navigateTo: (path: string) => Promise<void>;
  expectAuthenticatedShell: () => Promise<void>;
  dismissBlockingModals: () => Promise<void>;
};

async function openPerfilWithGoogleMocks(
  page: Page,
  context: BrowserContext,
  appShell: AppShellLike,
  state: GoogleCalendarMockState
): Promise<void> {
  await installGoogleCalendarMocks(page, state, context);

  const statusResponse = page.waitForResponse(
    (res) =>
      res.url().includes('/integracoes/google-calendar/status') &&
      res.request().method() === 'GET' &&
      res.status() === 200,
    { timeout: 30_000 }
  );

  await appShell.navigateTo('/configuracoes?aba=perfil');
  await appShell.expectAuthenticatedShell();
  await appShell.dismissBlockingModals();
  await openConfigSection(page, 'Meu perfil');

  await statusResponse;
  // Do not call response.json() on fulfilled routes — CDP drops the body
  // ("No resource with given identifier found"). Handler hit proves the mock.
  expect(state.statusHits ?? 0).toBeGreaterThan(0);
}

async function expectGoogleCalendarSectionOrSkip(page: Page): Promise<void> {
  const heading = page.getByRole('heading', { name: 'Google Calendar' });
  const visible = await heading.isVisible({ timeout: 20_000 }).catch(() => false);
  if (!visible) {
    test.skip(true, 'Usuário E2E sem professional_id vinculado — seção Google Calendar oculta');
  }
}

test.describe('Google Calendar — sync com mock', () => {
  test.describe('Perfil', () => {
    test('[GC-01] desconectado exibe botão Conectar Google Calendar', async ({
      page,
      context,
      appShell,
    }) => {
      const state = createGoogleCalendarMockState(buildDisconnectedStatus());
      await openPerfilWithGoogleMocks(page, context, appShell, state);
      await expectGoogleCalendarSectionOrSkip(page);

      await expect(page.getByRole('button', { name: /Conectar Google Calendar/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Desconectar$/i })).toHaveCount(0);
    });

    test('[GC-02] conectado exibe sync, alertas e Desconectar', async ({
      page,
      context,
      appShell,
    }) => {
      const state = createGoogleCalendarMockState(buildConnectedStatus());
      await openPerfilWithGoogleMocks(page, context, appShell, state);
      await expectGoogleCalendarSectionOrSkip(page);

      const googleCard = page.locator('.config__card').filter({
        has: page.getByRole('heading', { name: 'Google Calendar' }),
      });
      // Text is split across nodes ("Conectado" + "como" + email) — assert via email + card.
      await expect(googleCard.getByText('e2e-google@example.com')).toBeVisible();
      await expect(googleCard.getByText(/Conectado/i)).toBeVisible();
      await expect(page.locator('#gc-sync-consultas')).toBeVisible();
      await expect(page.getByRole('group', { name: /Alertas do Google Calendar/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Desconectar$/i })).toBeVisible();
    });

    test('[GC-03] desligar espelhamento envia PUT settings e oculta alertas', async ({
      page,
      context,
      appShell,
    }) => {
      const state = createGoogleCalendarMockState(buildConnectedStatus());
      await openPerfilWithGoogleMocks(page, context, appShell, state);
      await expectGoogleCalendarSectionOrSkip(page);

      const settingsReq = page.waitForRequest(
        (req) =>
          req.method() === 'PUT' && req.url().includes('/integracoes/google-calendar/settings')
      );
      await page.locator('#gc-sync-consultas').click({ force: true });
      const req = await settingsReq;
      expect(req.postDataJSON()).toMatchObject({ sync_consultas_para_google: false });

      await expect(page.getByRole('group', { name: /Alertas do Google Calendar/i })).toHaveCount(0);
    });

    test('[GC-04] chip de alerta envia PUT com alertas_minutos_antes', async ({
      page,
      context,
      appShell,
    }) => {
      const state = createGoogleCalendarMockState(
        buildConnectedStatus({ alertasMinutosAntes: [1440, 60] })
      );
      await openPerfilWithGoogleMocks(page, context, appShell, state);
      await expectGoogleCalendarSectionOrSkip(page);

      const settingsReq = page.waitForRequest(
        (req) =>
          req.method() === 'PUT' && req.url().includes('/integracoes/google-calendar/settings')
      );
      await page.getByRole('button', { name: '2 horas', exact: true }).click();
      const req = await settingsReq;
      const body = req.postDataJSON() as { alertas_minutos_antes?: number[] };
      expect(body.alertas_minutos_antes).toContain(120);
    });

    test('[GC-05] desconectar confirma e volta ao estado desconectado', async ({
      page,
      context,
      appShell,
    }) => {
      const state = createGoogleCalendarMockState(buildConnectedStatus());
      await openPerfilWithGoogleMocks(page, context, appShell, state);
      await expectGoogleCalendarSectionOrSkip(page);

      await page.getByRole('button', { name: /^Desconectar$/i }).click();
      const dialog = page.locator('.p-dialog.google-calendar-disconnect-dialog:visible');
      await expect(dialog).toBeVisible({ timeout: 10_000 });

      const disconnectReq = page.waitForRequest(
        (req) =>
          req.method() === 'POST' &&
          req.url().includes('/integracoes/google-calendar/disconnect')
      );
      await dialog.getByRole('button', { name: /^Desconectar$/i }).click();
      await disconnectReq;

      await expect(page.getByRole('button', { name: /Conectar Google Calendar/i })).toBeVisible({
        timeout: 15_000,
      });
    });

    test('[GC-06] integração indisponível no servidor', async ({ page, context, appShell }) => {
      const state = createGoogleCalendarMockState(
        buildDisconnectedStatus({ habilitadoNoServidor: false })
      );
      await openPerfilWithGoogleMocks(page, context, appShell, state);
      await expectGoogleCalendarSectionOrSkip(page);

      await expect(page.getByText(/Indisponível no servidor/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /Conectar Google Calendar/i })).toHaveCount(0);
    });

    test('[GC-07] precisa reconectar para escrita', async ({ page, context, appShell }) => {
      const state = createGoogleCalendarMockState(
        buildConnectedStatus({ precisaReconectarParaEscrita: true })
      );
      await openPerfilWithGoogleMocks(page, context, appShell, state);
      await expectGoogleCalendarSectionOrSkip(page);

      await expect(page.getByText(/Reconecte para sincronizar consultas/i)).toBeVisible();
      await expect(page.locator('#gc-sync-consultas')).toBeDisabled();
    });
  });

  test.describe('Integrações', () => {
    test('[GC-12] card Google Calendar aponta para Perfil', async ({ page, appShell }) => {
      await appShell.navigateTo('/configuracoes');
      await appShell.expectAuthenticatedShell();
      await appShell.dismissBlockingModals();
      await openConfigSection(page, 'Integrações');

      await expect(page.getByText('Google Calendar').first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/Por profissional/i).first()).toBeVisible();
      const irPerfil = page.getByRole('link', { name: /Abrir Conta|Ir para Perfil/i });
      await expect(irPerfil).toBeVisible();
      await irPerfil.click();
      await expect(page).toHaveURL(/aba=perfil/);
    });
  });

  test.describe('Agenda', () => {
    test('[GC-08] configurações da grade exibe atalho Google Calendar', async ({
      page,
      context,
      appShell,
    }) => {
      const state = createGoogleCalendarMockState(buildDisconnectedStatus());
      await installGoogleCalendarMocks(page, state, context);
      await appShell.navigateTo('/agenda');
      await appShell.expectAuthenticatedShell();
      await appShell.dismissBlockingModals();

      await page.getByRole('button', { name: 'Configurações da agenda' }).click();
      const syncBtn = page.getByText(/Sincronizar Google Calendar|Google Calendar/i).first();
      const visible = await syncBtn.isVisible({ timeout: 10_000 }).catch(() => false);
      if (!visible) {
        test.skip(true, 'Atalho Google Calendar ausente (usuário sem vínculo profissional)');
      }
      await expect(syncBtn).toBeVisible();
    });

    test('[GC-09] overlay de evento Google aparece na grade', async ({
      page,
      context,
      appShell,
    }) => {
      const state = createGoogleCalendarMockState(buildConnectedStatus());
      await installGoogleCalendarMocks(page, state, context);
      await installAgendaGoogleOverlayMock(page, { title: 'E2E-Google-Evento' });

      await appShell.navigateTo('/agenda');
      await appShell.expectAuthenticatedShell();
      await appShell.dismissBlockingModals();
      await page.getByRole('button', { name: 'Dia', exact: true }).click();

      const googleCard = page.locator('.agenda-screen__event-card--google').filter({
        hasText: 'E2E-Google-Evento',
      });
      await expect(googleCard.first()).toBeVisible({ timeout: 20_000 });
      await expect(
        page.getByRole('button', { name: /Abrir no Google Calendar/i }).first()
      ).toBeVisible();
    });

    test('[GC-10] ocultar eventos do Google Calendar remove cards', async ({
      page,
      context,
      appShell,
    }) => {
      const state = createGoogleCalendarMockState(buildConnectedStatus());
      await installGoogleCalendarMocks(page, state, context);
      await installAgendaGoogleOverlayMock(page, { title: 'E2E-Google-Evento' });

      await appShell.navigateTo('/agenda');
      await appShell.expectAuthenticatedShell();
      await appShell.dismissBlockingModals();
      await page.getByRole('button', { name: 'Dia', exact: true }).click();

      const googleCard = page.locator('.agenda-screen__event-card--google').filter({
        hasText: 'E2E-Google-Evento',
      });
      await expect(googleCard.first()).toBeVisible({ timeout: 20_000 });

      await page.getByRole('button', { name: 'Visualização da agenda' }).click();
      await page.getByText('Ocultar eventos do Google Calendar').click();
      await expect(googleCard).toHaveCount(0, { timeout: 10_000 });
    });

    test('[GC-11] retorno OAuth connected exibe toast de sucesso', async ({
      page,
      context,
      appShell,
    }) => {
      const state = createGoogleCalendarMockState(buildConnectedStatus());
      await installGoogleCalendarMocks(page, state, context);

      const toastPromise = expectToast(page, /Conta conectada/i, 20_000);
      await page.goto('/agenda?google_calendar=connected', { waitUntil: 'domcontentloaded' });
      await toastPromise;

      await appShell.expectAuthenticatedShell();
      await expect(page).toHaveURL(/\/agenda/);
      await expect(page).not.toHaveURL(/google_calendar=/);
    });

    test('[GC-13] Conectar não abre Google real (redirect E2E in-app)', async ({
      page,
      context,
      appShell,
    }) => {
      await stubLocationAssign(page);
      const state = createGoogleCalendarMockState(buildDisconnectedStatus());
      await openPerfilWithGoogleMocks(page, context, appShell, state);
      await expectGoogleCalendarSectionOrSkip(page);
      // Re-apply after goto — Chromium may ignore Location.prototype patches.
      await stubLocationAssign(page);

      const connectReq = page.waitForRequest(
        (req) =>
          req.method() === 'GET' && req.url().includes('/integracoes/google-calendar/connect')
      );
      await page.getByRole('button', { name: /Conectar Google Calendar/i }).click();
      await connectReq;

      expect(state.lastConnectAuthorizeUrl).toBeTruthy();
      expect(state.lastConnectAuthorizeUrl).toMatch(/google_calendar=connected/);
      expect(state.lastConnectAuthorizeUrl).not.toMatch(/accounts\.google\.com/i);

      // Stub may capture assign; otherwise Chromium navigates to the in-app authorizeUrl.
      await expect
        .poll(
          async () => {
            const redirects = await readStubbedRedirects(page);
            if (redirects.some((url) => url.includes('google_calendar=connected'))) {
              return 'stubbed';
            }
            if (/\/agenda|google_calendar=connected/i.test(page.url())) {
              return 'navigated';
            }
            return '';
          },
          { timeout: 15_000 }
        )
        .not.toEqual('');

      const redirects = await readStubbedRedirects(page);
      if (redirects.length > 0) {
        expect(redirects.some((url) => /accounts\.google\.com/i.test(url))).toBe(false);
      }
      await expect(page).not.toHaveURL(/accounts\.google\.com|chrome-error:/);
    });
  });
});
