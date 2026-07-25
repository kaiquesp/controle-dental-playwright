import { expect, type Locator, type Page } from '@playwright/test';
import {
  AGENDA_FORM_IDS,
  AGENDA_SELECTORS,
  type AgendaEventTab,
  type AgendaView,
} from '../data/agenda';
import { selectIftaByInputId } from '../support/interaction-helpers';
import { slotEndHora, toBrDate, waitForAgendaEventsReload } from '../support/agenda-helpers';

export class AgendaPage {
  readonly root: Locator;
  readonly newAppointmentButton: Locator;
  readonly printButton: Locator;
  readonly profFilterButton: Locator;
  readonly otherFiltersButton: Locator;
  readonly periodHeading: Locator;

  constructor(readonly page: Page) {
    this.root = page.locator(AGENDA_SELECTORS.screen).first();
    this.newAppointmentButton = page.getByRole('button', { name: /Novo agendamento/i }).first();
    this.printButton = page.getByRole('button', { name: 'Imprimir agenda' });
    this.profFilterButton = page.getByRole('button', { name: /Todos os profissionais|profissional/i });
    this.otherFiltersButton = page.getByRole('button', { name: /Outros filtros/i });
    this.periodHeading = page.locator('main h2').filter({ hasText: /\d+/ }).first();
  }

  async goTo(): Promise<void> {
    await this.page.goto('/agenda', { waitUntil: 'domcontentloaded' });
    await expect(this.root).toBeVisible({ timeout: 30_000 });
  }

  async setView(view: AgendaView): Promise<void> {
    await this.page.getByRole('button', { name: view, exact: true }).click();
    await expect(this.root).toBeVisible();
  }

  async goToday(): Promise<void> {
    await this.page.getByRole('button', { name: 'Hoje', exact: true }).click();
    await waitForAgendaEventsReload(this.page);
  }

  async goNext(): Promise<void> {
    await this.page.getByRole('button', { name: 'Próximo' }).click();
    await waitForAgendaEventsReload(this.page);
  }

  /** Avança período sem aguardar reload da API — uso interno em goToDate. */
  private async goNextPeriod(): Promise<void> {
    const before = (await this.periodHeading.textContent()) ?? '';
    await this.page.getByRole('button', { name: 'Próximo' }).click();
    await expect(this.periodHeading).not.toHaveText(before, { timeout: 5_000 });
  }

  async goPrevious(): Promise<void> {
    await this.page.getByRole('button', { name: 'Anterior' }).click();
    await waitForAgendaEventsReload(this.page);
  }

  scheduleDialog(): Locator {
    return this.page.locator(AGENDA_SELECTORS.scheduleDialog).first();
  }

  consultaDetailsDialog(): Locator {
    return this.page.getByRole('dialog', { name: /Detalhes da Consulta/i });
  }

  async closeConsultaDetails(): Promise<void> {
    const details = this.consultaDetailsDialog();
    if (!(await details.isVisible().catch(() => false))) return;
    const closeBtn = details.locator('.p-dialog-header-close, button[aria-label="Fechar"], button[aria-label="Close"]').first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
    } else {
      await this.page.locator('.p-dialog-mask:visible').first().click({ position: { x: 8, y: 8 }, force: true });
    }
    await expect(details).toBeHidden({ timeout: 8_000 });
  }

  async openNewAppointment(): Promise<Locator> {
    await this.newAppointmentButton.click();
    const dialog = this.scheduleDialog();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    return dialog;
  }

  async openSlotContaining(time: string): Promise<Locator> {
    const slot = this.page.getByRole('button', { name: new RegExp(`Novo agendamento às ${time}`, 'i') }).first();
    await expect(slot).toBeVisible();
    await slot.click();
    const dialog = this.scheduleDialog();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    return dialog;
  }

  async switchTab(tab: AgendaEventTab): Promise<void> {
    const dialog = this.scheduleDialog();
    const tablist = dialog.locator('[role="tablist"]');
    await tablist.getByRole('button', { name: tab, exact: true }).click();
    await expect(tablist.locator(AGENDA_SELECTORS.scheduleModalActiveTab)).toHaveText(tab);
  }

  async dismissNestedScheduleDialogs(): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
      let dismissed = false;
      const topDialog = this.page.locator('[role="dialog"]:visible').last();
      const isNovaEtiqueta = await topDialog
        .locator('.p-dialog-title, h2, [class*="dialog-title"]')
        .filter({ hasText: /^Nova etiqueta$/i })
        .first()
        .isVisible()
        .catch(() => false);
      if (isNovaEtiqueta) {
        const closeBtn = topDialog
          .locator('.p-dialog-header-close, button[aria-label="Fechar"], button[aria-label="Close"]')
          .first();
        if (await closeBtn.isVisible().catch(() => false)) {
          await closeBtn.click();
        } else {
          await topDialog.getByRole('button', { name: /^Cancelar$/i }).first().click();
        }
        await expect(topDialog).toBeHidden({ timeout: 8_000 });
        dismissed = true;
      }
      const deleteConfirm = this.page
        .locator('[role="alertdialog"]:visible')
        .filter({ hasText: /Confirmar exclusão da consulta/i });
      if (await deleteConfirm.isVisible({ timeout: 400 }).catch(() => false)) {
        await deleteConfirm.getByRole('button', { name: /^Não$/i }).click();
        await expect(deleteConfirm).toBeHidden({ timeout: 8_000 });
        dismissed = true;
      }
      if (!dismissed) break;
    }
  }

  async saveAppointment(options?: { confirmOutsideHours?: boolean }): Promise<void> {
    const dialog = this.scheduleDialog();
    const confirmOutside = options?.confirmOutsideHours ?? true;
    await this.dismissNestedScheduleDialogs();
    const save = dialog
      .getByRole('button', {
        name: /Salvar tarefa|Salvar compromisso|Agendar consulta|Agendar compromisso|Criar tarefa|Salvar|Agendar|Criar/i,
      })
      .first();
    const isSaveResponse = (res: { url: () => string; request: () => { method: () => string }; status: () => number }) => {
      const method = res.request().method();
      if (!['POST', 'PUT', 'PATCH'].includes(method) || res.status() >= 400) return false;
      const url = res.url();
      return url.includes('/api/agenda/') || url.includes('/api/consultas/');
    };
    const clickSave = () =>
      this.page.waitForResponse(isSaveResponse, { timeout: 25_000 }).catch(() => null);
    let saveResponse = clickSave();
    await save.click();
    for (let attempt = 0; attempt < 3; attempt++) {
      await this.dismissNestedScheduleDialogs();
      const outside = this.page.getByRole('alertdialog', { name: /fora do expediente/i });
      if (!(await outside.isVisible({ timeout: 2_000 }).catch(() => false))) break;
      if (!confirmOutside) return;
      await outside.getByRole('button', { name: /^Sim,\s*prosseguir$/i }).click();
      await expect(outside).toBeHidden({ timeout: 8_000 });
      saveResponse = clickSave();
      await save.click();
    }
    const response = await saveResponse;
    if (response) {
      if (await dialog.isVisible().catch(() => false)) {
        await this.page.keyboard.press('Escape');
      }
      await waitForAgendaEventsReload(this.page);
      return;
    }
    if (await dialog.isVisible().catch(() => false)) {
      const horaField = dialog.getByRole('textbox', { name: /Horário/i });
      const hora = ((await horaField.inputValue().catch(() => '')) ?? '').trim();
      if (!hora) {
        throw new Error('Modal não fechou após salvar: campo Horário está vazio');
      }
      const validation = dialog.getByText(/obrigatório|inválido|preencha|selecione/i).first();
      if (await validation.isVisible().catch(() => false)) {
        throw new Error(`Modal não fechou após salvar: ${(await validation.textContent()) ?? 'validação'}`);
      }
    }
    await expect(dialog).toBeHidden({ timeout: 20_000 });
    await waitForAgendaEventsReload(this.page);
  }

  async cancelAppointment(): Promise<void> {
    const alert = this.page.locator('[role="alertdialog"]:visible');
    if (await alert.isVisible().catch(() => false)) {
      const dismiss = alert.getByRole('button', { name: /^Não$|Cancelar|Voltar/i }).first();
      if (await dismiss.isVisible().catch(() => false)) {
        await dismiss.click();
      } else {
        await this.page.keyboard.press('Escape');
      }
      await expect(alert).toBeHidden({ timeout: 5_000 });
    }

    const dialog = this.scheduleDialog();
    if (!(await dialog.isVisible().catch(() => false))) return;

    const closeBtn = dialog.locator('.agenda-schedule-modal__close').first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
    } else {
      const footer = dialog.locator('.agenda-schedule-modal__footer, .p-dialog-footer');
      const cancelFooter = footer.getByRole('button', { name: /^Cancelar$/i }).first();
      if (await cancelFooter.isVisible().catch(() => false)) {
        await cancelFooter.click();
      } else {
        await this.page.keyboard.press('Escape');
      }
    }
    await expect(this.scheduleDialog()).toBeHidden({ timeout: 10_000 });
  }

  async fillConsultaBasics(options: {
    patientName: string;
    data: string;
    hora: string;
    duracao?: string;
    procedimento?: string | RegExp;
  }): Promise<void> {
    const dialog = this.scheduleDialog();
    await this.switchTab('Consulta');

    const paciente = dialog.locator(`#${AGENDA_FORM_IDS.consulta.paciente}`);
    await paciente.click();
    await paciente.fill(options.patientName);
    const patientResult = dialog
      .getByRole('button', { name: new RegExp(options.patientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 20)) })
      .first();
    await expect(patientResult).toBeVisible({ timeout: 12_000 });
    await patientResult.click();
    await expect(dialog.getByText(/Selecione um paciente/i)).toHaveCount(0, { timeout: 5_000 });

    const dataField = dialog.locator(`#${AGENDA_FORM_IDS.consulta.data}`);
    await dataField.click();
    await this.page.keyboard.press('Control+A');
    await this.page.keyboard.type(toBrDate(options.data));
    await dataField.press('Tab');
    const datePanel = this.page.locator('.p-datepicker-panel:visible');
    if (await datePanel.isVisible().catch(() => false)) {
      await this.page.keyboard.press('Escape');
    }

    const horaField = dialog.getByRole('textbox', { name: /Horário/i });
    await horaField.click();
    await horaField.fill(options.hora);
    await expect(horaField).toHaveValue(options.hora);

    const procLabel = options.procedimento ?? /Limpeza|Avaliação|Restauração|Extração/i;
    await selectIftaByInputId(this.page, AGENDA_FORM_IDS.consulta.procedimento, procLabel, dialog);

    if (options.duracao) {
      await selectIftaByInputId(this.page, AGENDA_FORM_IDS.consulta.duracao, options.duracao, dialog).catch(
        () => undefined
      );
    }

    await this.dismissNestedScheduleDialogs();
  }

  async scrollScheduleDialogToTop(): Promise<void> {
    const dialog = this.scheduleDialog();
    const content = dialog.locator('.p-dialog-content').first();
    if (await content.isVisible().catch(() => false)) {
      await content.evaluate((el) => {
        el.scrollTop = 0;
      });
    }
  }

  async fillCompromissoBasics(options: { titulo: string; data: string; hora: string }): Promise<void> {
    const dialog = this.scheduleDialog();
    await this.switchTab('Compromisso');
    await this.scrollScheduleDialogToTop();

    const dataField = dialog.locator(`#${AGENDA_FORM_IDS.compromisso.data}`);
    await dataField.click();
    await this.page.keyboard.press('Control+A');
    await this.page.keyboard.type(toBrDate(options.data));
    await dataField.press('Tab');

    await dialog.locator(`#${AGENDA_FORM_IDS.compromisso.horaInicio}`).fill(options.hora);
    const quickDuration = dialog.getByRole('button', { name: '30 min', exact: true });
    if (await quickDuration.isVisible().catch(() => false)) {
      await quickDuration.click();
    } else {
      await dialog.locator(`#${AGENDA_FORM_IDS.compromisso.horaFim}`).fill(slotEndHora(options.hora));
    }

    await this.scrollScheduleDialogToTop();
    const titleField = dialog.getByRole('textbox', { name: /Título do compromisso/i });
    await titleField.click();
    await titleField.pressSequentially(options.titulo, { delay: 15 });
    await titleField.press('Tab');
    await expect(titleField).toHaveValue(options.titulo);
  }

  async fillTarefaBasics(options: { titulo: string; data: string; hora?: string }): Promise<void> {
    const dialog = this.scheduleDialog();
    await this.switchTab('Tarefa');
    await dialog.locator(`#${AGENDA_FORM_IDS.tarefa.titulo}`).fill(options.titulo);

    const dataField = dialog.locator(`#${AGENDA_FORM_IDS.tarefa.prazoData}`);
    await dataField.click();
    await this.page.keyboard.press('Control+A');
    await this.page.keyboard.type(toBrDate(options.data));
    await dataField.press('Tab');

    if (options.hora) {
      await dialog.locator(`#${AGENDA_FORM_IDS.tarefa.prazoHora}`).fill(options.hora);
    }
  }

  eventCard(title: string | RegExp): Locator {
    return this.page.locator(AGENDA_SELECTORS.eventCard).filter({ hasText: title });
  }

  async scrollToTime(hora: string): Promise<void> {
    const hour = Number.parseInt(hora.split(':')[0] ?? '8', 10);
    const grade = this.page.locator('.agenda-screen__grade, .agenda-screen__day-grid, .agenda-screen').first();
    await grade.evaluate((el, h) => {
      el.scrollTop = Math.max(0, (h - 1) * 64);
    }, hour);
  }

  async expectEventVisible(title: string | RegExp, timeout = 25_000): Promise<void> {
    await expect
      .poll(
        async () => {
          const card = this.eventCard(title).first();
          if (await card.isVisible().catch(() => false)) return true;
          return this.root
            .getByText(title)
            .first()
            .isVisible()
            .catch(() => false);
        },
        { timeout }
      )
      .toBe(true);
  }

  async expectEventHidden(title: string | RegExp, timeout = 15_000): Promise<void> {
    await expect
      .poll(
        async () => {
          const cards = this.eventCard(title);
          const count = await cards.count();
          for (let i = 0; i < count; i++) {
            if (await cards.nth(i).isVisible().catch(() => false)) return false;
          }
          return true;
        },
        { timeout }
      )
      .toBe(true);
  }

  async openEvent(title: string | RegExp): Promise<Locator> {
    const card = this.eventCard(title).first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();
    const schedule = this.scheduleDialog();
    const details = this.consultaDetailsDialog();
    await expect(schedule.or(details)).toBeVisible({ timeout: 10_000 });
    if (await schedule.isVisible().catch(() => false)) {
      return schedule;
    }
    return details;
  }

  async openProfessionalFilter(): Promise<void> {
    await this.profFilterButton.click();
    await expect(this.page.locator(AGENDA_SELECTORS.profPanel)).toBeVisible({ timeout: 5_000 });
  }

  async selectAllProfessionals(): Promise<void> {
    await this.openProfessionalFilter();
    const all = this.page.getByRole('button', { name: /Todos os profissionais/i }).last();
    if (await all.isVisible().catch(() => false)) await all.click();
    await this.page.keyboard.press('Escape');
    await waitForAgendaEventsReload(this.page);
  }

  async selectProfessional(name: string | RegExp): Promise<void> {
    await this.openProfessionalFilter();
    await this.page.getByRole('button', { name }).click();
    await waitForAgendaEventsReload(this.page);
  }

  async openOtherFilters(): Promise<void> {
    await this.otherFiltersButton.click();
    await expect(this.page.getByText(/Status|Sala/i).first()).toBeVisible({ timeout: 5_000 });
  }

  async toggleOtherFilter(label: string | RegExp): Promise<void> {
    await this.openOtherFilters();
    const chip = this.page.getByRole('button', { name: label }).or(this.page.getByText(label)).first();
    if (await chip.isVisible().catch(() => false)) await chip.click();
    await waitForAgendaEventsReload(this.page);
  }

  async openViewOptions(): Promise<void> {
    await this.page.getByRole('button', { name: 'Visualização da agenda' }).click();
    await expect(this.page.locator(AGENDA_SELECTORS.gradeViewPanel).first()).toBeVisible({ timeout: 10_000 });
  }

  async openFindSlots(): Promise<void> {
    const dialog = this.scheduleDialog();
    const btn = dialog.getByRole('button', { name: /Encontrar horários|horários livres/i });
    await expect(btn).toBeVisible({ timeout: 10_000 });
    await btn.click();
  }

  async setRecurrence(label: string | RegExp, options?: { preserveHora?: string }): Promise<void> {
    const dialog = this.scheduleDialog();
    await selectIftaByInputId(this.page, AGENDA_FORM_IDS.consulta.recorrencia, label, dialog);
    if (options?.preserveHora) {
      const horaField = dialog.getByRole('textbox', { name: /Horário/i });
      const current = (await horaField.inputValue()).trim();
      if (!current) {
        await horaField.fill(options.preserveHora);
        await expect(horaField).toHaveValue(options.preserveHora);
      }
    }
  }

  async setReturnIn(label: string | RegExp): Promise<void> {
    const dialog = this.scheduleDialog();
    await selectIftaByInputId(this.page, AGENDA_FORM_IDS.consulta.retorno, label, dialog);
  }

  async setConsultaStatus(status: string | RegExp): Promise<void> {
    const details = this.consultaDetailsDialog();
    if (await details.isVisible().catch(() => false)) {
      const statusResponse = this.page
        .waitForResponse(
          (res) =>
            res.url().includes('/api/consultas/') &&
            ['PUT', 'PATCH'].includes(res.request().method()) &&
            res.status() < 400,
          { timeout: 15_000 }
        )
        .catch(() => null);
      await selectIftaByInputId(this.page, AGENDA_FORM_IDS.consulta.detalheStatus, status, details);
      await statusResponse;
      return;
    }

    const dialog = this.scheduleDialog();
    const statusField = dialog.locator(`#${AGENDA_FORM_IDS.consulta.status}`);
    if (await statusField.isVisible().catch(() => false)) {
      await selectIftaByInputId(this.page, AGENDA_FORM_IDS.consulta.status, status, dialog);
      return;
    }
    await expect(
      statusField,
      'Campo "Status da consulta" só aparece em modo edição — abra uma consulta existente na grade'
    ).toBeVisible({ timeout: 10_000 });
    await selectIftaByInputId(this.page, AGENDA_FORM_IDS.consulta.status, status, dialog);
  }

  async toggleLabel(label: string | RegExp): Promise<void> {
    const dialog = this.scheduleDialog();
    const item = dialog.locator('.dc-label-picker-card__item').filter({ hasText: label }).first();
    await expect(item).toBeVisible({ timeout: 10_000 });
    await item.click();
  }

  /** Chips de status no corpo do modal (exclui botões do rodapé como "Cancelar"). */
  statusButtons(): Locator {
    const dialog = this.scheduleDialog();
    const content = dialog.locator('.p-dialog-content, .agenda-schedule-modal__body');
    return content.getByRole('button');
  }

  async clickEventStatus(status: string | RegExp): Promise<void> {
    const statusBtn = this.statusButtons().filter({ hasText: status }).first();
    await expect(
      statusBtn,
      `Chip de status "${String(status)}" indisponível neste tipo de evento`
    ).toBeVisible({ timeout: 10_000 });
    await statusBtn.click();
  }

  async changeStatus(status: string | RegExp): Promise<void> {
    await this.clickEventStatus(status);
    await this.saveAppointment();
  }

  async confirmDeleteAlert(): Promise<void> {
    const confirm = this.page.getByRole('alertdialog').filter({ hasText: /exclu|remov|confirmar/i });
    const confirmBtn = confirm.getByRole('button', { name: /Confirmar|Excluir|Sim/i }).first();
    if (await confirmBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await confirmBtn.click();
      await expect(confirm).toBeHidden({ timeout: 10_000 });
    }
  }

  async deleteEventFromGrid(title: string | RegExp): Promise<void> {
    const card = this.eventCard(title).first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.hover();
    const inlineDelete = card.getByRole('button', { name: /Excluir|Remover/i });
    if (await inlineDelete.first().isVisible({ timeout: 1_500 }).catch(() => false)) {
      await inlineDelete.first().click();
      await this.confirmDeleteAlert();
      await waitForAgendaEventsReload(this.page);
      return;
    }

    await card.click({ button: 'right' });
    const menuDelete = this.page.getByRole('menuitem', { name: /Excluir|Remover/i });
    if (await menuDelete.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await menuDelete.click();
      await this.confirmDeleteAlert();
      await waitForAgendaEventsReload(this.page);
      return;
    }

    await this.page.keyboard.press('Escape').catch(() => undefined);
    await card.click();
    await this.deleteCurrentEvent();
  }

  async deleteCurrentEvent(): Promise<void> {
    const dialog = this.scheduleDialog();
    await this.scrollScheduleDialogToTop();
    const content = dialog.locator('.p-dialog-content, .agenda-schedule-modal__body').first();
    if (await content.isVisible().catch(() => false)) {
      await content.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
    }
    const footer = dialog.locator('.agenda-schedule-modal__footer, .p-dialog-footer');
    const deleteBtn = footer
      .getByRole('button', { name: /Excluir compromisso|Excluir tarefa|Excluir consulta|Cancelar consulta|Remover/i })
      .filter({ enabled: true });
    await expect(
      deleteBtn.first(),
      'Botão de exclusão habilitado não encontrado no rodapé do modal de edição'
    ).toBeVisible({ timeout: 10_000 });
    const deleteResponse = this.page
      .waitForResponse(
        (res) =>
          ['DELETE', 'POST'].includes(res.request().method()) &&
          res.status() < 400 &&
          (res.url().includes('/api/agenda/') || res.url().includes('/api/consultas/')),
        { timeout: 20_000 }
      )
      .catch(() => null);
    await deleteBtn.first().click();
    await this.confirmDeleteAlert();
    await deleteResponse;
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await waitForAgendaEventsReload(this.page);
  }

  async triggerPrint(): Promise<void> {
    await this.printButton.click();
  }

  async goToDate(isoDate: string, maxSteps = 21): Promise<void> {
    const [, month, day] = isoDate.split('-');
    const targetDay = String(Number.parseInt(day ?? '0', 10));
    const monthNames = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ];
    const monthHint = monthNames[Number.parseInt(month ?? '1', 10) - 1] ?? '';
    const dayPattern = new RegExp(`\\b${targetDay}\\b`);

    await this.goToday().catch(() => undefined);
    for (let i = 0; i < maxSteps; i++) {
      const heading = (await this.periodHeading.textContent()) ?? '';
      if (dayPattern.test(heading) && heading.toLowerCase().includes(monthHint.toLowerCase().slice(0, 3))) {
        await waitForAgendaEventsReload(this.page);
        return;
      }
      await this.goNextPeriod();
    }
    const lastHeading = (await this.periodHeading.textContent()) ?? '';
    throw new Error(
      `Não foi possível navegar até ${isoDate} em ${maxSteps} passos (último cabeçalho: "${lastHeading}")`
    );
  }

  async navigateToEventSlot(data: string, hora?: string): Promise<void> {
    await expect(this.root).toBeVisible({ timeout: 30_000 });
    await this.setView('Dia');
    await this.goToDate(data);
    if (hora) await this.scrollToTime(hora);
    await waitForAgendaEventsReload(this.page);
  }

  async expectWeekView(): Promise<void> {
    await expect(this.page.locator('.agenda-screen__week, .agenda-screen__grade--week').first()).toBeVisible({
      timeout: 10_000,
    });
  }

  async expectDayView(): Promise<void> {
    await expect(this.page.locator('.agenda-screen__day, .agenda-screen__grade--day').first()).toBeVisible({
      timeout: 10_000,
    });
  }

  async expectMonthView(): Promise<void> {
    await expect(this.page.locator('.agenda-screen__month, .agenda-screen__grade--month').first()).toBeVisible({
      timeout: 10_000,
    });
  }
}
