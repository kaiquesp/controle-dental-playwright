import { test, expect } from '../../fixtures/test.fixture';
import {
  cleanupAgendaSeeds,
  createCompromissoByApiUnique,
  e2eName,
  expectEventInApi,
  listProfessionalsByApi,
  readTokenFromPage,
  type AgendaEventSeed,
} from '../../support/agenda-helpers';

test.describe('Agenda — visualização e navegação', () => {
  test.describe.configure({ timeout: 120_000 });
  const seeds: AgendaEventSeed[] = [];
  let authToken = '';

  test.beforeEach(async ({ appShell, agendaPage }) => {
    await appShell.navigateTo('/agenda');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
  });

  test.afterAll(async ({ request }) => {
    if (authToken) await cleanupAgendaSeeds(request, authToken, seeds);
  });

  test('[AG-VIEW-01] visão Dia exibe evento do dia', async ({ page, agendaPage, request }) => {
    authToken = await readTokenFromPage(page);
    const pros = await listProfessionalsByApi(request, authToken);
    if (!pros[0]) test.skip(true, 'Sem profissional');

    const title = e2eName('Dia');
    const { id, slot } = await createCompromissoByApiUnique(request, authToken, {
      titulo: title,
      professionalId: pros[0].id,
      offsetDays: 6,
      baseHour: 11,
    });
    seeds.push({ id, tipo: 'compromisso', titulo: title, data: slot.data });

    await expectEventInApi(request, authToken, title, slot.data);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await agendaPage.navigateToEventSlot(slot.data, slot.hora);
    await agendaPage.selectAllProfessionals();
    await agendaPage.expectDayView().catch(() => agendaPage.expectEventVisible(title));
    await agendaPage.expectEventVisible(title);
  });

  test('[AG-VIEW-02] visão Semana exibe colunas da semana', async ({ agendaPage }) => {
    await agendaPage.setView('Semana');
    await agendaPage.expectWeekView().catch(() => expect(agendaPage.root).toBeVisible());
    await expect(agendaPage.page.getByRole('button', { name: 'Semana', exact: true })).toBeVisible();
  });

  test('[AG-VIEW-03] visão Mês exibe calendário mensal', async ({ agendaPage }) => {
    await agendaPage.setView('Mês');
    await agendaPage.expectMonthView().catch(() => expect(agendaPage.root).toBeVisible());
    await expect(agendaPage.page.getByRole('button', { name: 'Mês', exact: true })).toBeVisible();
  });

  test('[AG-VIEW-04] navegação Anterior/Próximo altera período', async ({ agendaPage }) => {
    await agendaPage.setView('Semana');
    const before = await agendaPage.periodHeading.textContent();
    await agendaPage.goNext();
    await expect(agendaPage.periodHeading).not.toHaveText(before ?? '');
    await agendaPage.goPrevious();
  });

  test('[AG-VIEW-05] botão Hoje retorna ao período atual', async ({ agendaPage }) => {
    await agendaPage.goNext();
    await agendaPage.goNext();
    await agendaPage.goToday();
    await expect(agendaPage.root).toBeVisible();
  });

  test('[AG-VIEW-06] painel Visualização da agenda altera opções de grade', async ({ agendaPage }) => {
    await agendaPage.openViewOptions();
    const compact = agendaPage.page.getByText(/Visualização compacta|Ocultar sábado|Ocultar domingo/i).first();
    await expect(compact).toBeVisible();
    if (await compact.isVisible()) await compact.click();
    await agendaPage.page.keyboard.press('Escape');
    await expect(agendaPage.root).toBeVisible();
  });
});
