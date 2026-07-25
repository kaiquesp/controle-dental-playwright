import { test, expect } from '../../fixtures/test.fixture';
import { visibleDialog } from '../../support/interaction-helpers';

test.describe('Agenda — interações e modais (smoke)', () => {
  test.beforeEach(async ({ appShell, agendaPage }) => {
    await appShell.navigateTo('/agenda');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
  });

  test('[AG-05] abre filtro de profissionais', async ({ agendaPage }) => {
    await agendaPage.openProfessionalFilter();
    await expect(agendaPage.page.locator('#agenda-grade-profissionais-panel')).toBeVisible();
    await agendaPage.page.keyboard.press('Escape');
  });

  test('[AG-06] abre painel de outros filtros', async ({ agendaPage }) => {
    await agendaPage.openOtherFilters();
    await agendaPage.page.keyboard.press('Escape');
  });

  test('[AG-07] modal novo agendamento exibe formulário e cancela', async ({ agendaPage }) => {
    await agendaPage.openNewAppointment();
    await expect(agendaPage.scheduleDialog().locator('input, [role="combobox"]').first()).toBeVisible();
    await agendaPage.cancelAppointment();
    await expect(visibleDialog(agendaPage.page)).toBeHidden();
    await expect(agendaPage.page).toHaveURL(/\/agenda/);
  });

  test('[AG-08] slot horário abre formulário de agendamento', async ({ agendaPage }) => {
    const slot = agendaPage.page.getByRole('button', { name: /Novo agendamento às/i }).first();
    await expect(slot).toBeVisible();
    await slot.click();
    await expect(agendaPage.scheduleDialog()).toBeVisible();
    await agendaPage.cancelAppointment();
  });

  test('[AG-12] configurações da agenda exibe painel', async ({ page, agendaPage }) => {
    await page.getByRole('button', { name: 'Configurações da agenda' }).click();
    await expect(
      page.locator('main, [role="dialog"]').getByText(/horário|expediente|agenda|configura/i).first()
    ).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
  });

  test('[AG-14] modal novo agendamento alterna abas Consulta / Compromisso / Tarefa', async ({
    agendaPage,
  }) => {
    await agendaPage.openNewAppointment();
    for (const tab of ['Consulta', 'Compromisso', 'Tarefa'] as const) {
      await agendaPage.switchTab(tab);
    }
    await agendaPage.cancelAppointment();
  });

  test('[AG-15] painel Visualização da agenda lista opções de grade', async ({ agendaPage }) => {
    await agendaPage.openViewOptions();
    await agendaPage.page.keyboard.press('Escape');
  });
});
