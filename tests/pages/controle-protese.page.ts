import { expect, type Locator, type Page } from '@playwright/test';
import {
  PROTESE_FORM_IDS,
  PROTESE_KANBAN_COLUMNS,
  PROTESE_SELECTORS,
  type ProteseKanbanColumn,
} from '../data/protese';
import { closeDialog, expectDialogOpen, selectIftaByInputId } from '../support/interaction-helpers';

export class ControleProtesePage {
  readonly root: Locator;
  readonly novaSolicitacaoButton: Locator;
  readonly buscaInput: Locator;
  readonly laboratoriosLink: Locator;
  readonly kanban: Locator;

  constructor(readonly page: Page) {
    this.root = page.locator(PROTESE_SELECTORS.root).first();
    this.novaSolicitacaoButton = page.getByRole('button', { name: /Nova solicitação/i });
    this.buscaInput = page.locator(PROTESE_FORM_IDS.busca);
    this.laboratoriosLink = page.getByRole('link', { name: /Laboratórios/i });
    this.kanban = page.locator(PROTESE_SELECTORS.kanban).first();
  }

  async goToBoard(): Promise<void> {
    await this.page.goto('/controle-protese', { waitUntil: 'domcontentloaded' });
    await expect(this.root).toBeVisible({ timeout: 30_000 });
  }

  async goToLaboratorios(): Promise<void> {
    await this.page.goto('/controle-protese/laboratorios', { waitUntil: 'domcontentloaded' });
    await expect(this.page.getByRole('heading', { name: /Laboratórios/i }).first()).toBeVisible({
      timeout: 30_000,
    });
  }

  async expectKanbanColumns(): Promise<void> {
    await expect(this.kanban).toBeVisible();
    for (const column of PROTESE_KANBAN_COLUMNS) {
      await expect(this.kanbanColumn(column)).toBeVisible();
    }
  }

  kanbanColumn(title: ProteseKanbanColumn | string): Locator {
    return this.page.locator(PROTESE_SELECTORS.column).filter({ hasText: title }).first();
  }

  kanbanColumnBody(title: ProteseKanbanColumn | string): Locator {
    return this.kanbanColumn(title).locator(PROTESE_SELECTORS.columnBody);
  }

  caseCard(label: string | RegExp): Locator {
    return this.page
      .locator(PROTESE_SELECTORS.caseCard)
      .or(this.page.locator('.controle-protese__column-body [class*="card"]'))
      .filter({ hasText: label });
  }

  async searchSolicitacoes(term: string): Promise<void> {
    const search = this.page
      .locator('.controle-protese')
      .getByRole('searchbox', { name: /Buscar/i })
      .or(this.page.locator('app-dc-search-field[inputid="controle-protese-busca"] input'));
    await expect(search.first()).toBeVisible({ timeout: 15_000 });
    await search.first().fill(term);
    await this.page.waitForTimeout(800);
  }

  async openNovaSolicitacao(): Promise<Locator> {
    await this.novaSolicitacaoButton.click();
    const dialog = this.page.locator(PROTESE_SELECTORS.casoModal).first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    return dialog;
  }

  async fillNovaSolicitacaoBasics(options: {
    patientName: string;
    tipoProtese?: string | RegExp;
    denteRegiao?: string;
    professionalName?: string | RegExp;
  }): Promise<void> {
    const dialog = this.page.locator(PROTESE_SELECTORS.casoModal).first();
    const patientSearch = dialog.locator(PROTESE_FORM_IDS.patientSearch);
    const searchTerm = options.patientName.slice(0, 16);
    const searchResponse = this.page
      .waitForResponse((res) => res.url().includes('/pacientes') && res.status() < 400, { timeout: 12_000 })
      .catch(() => null);
    await patientSearch.fill(searchTerm);
    await searchResponse;
    await this.page.waitForTimeout(600);

    const patientOption = this.page
      .getByRole('option')
      .filter({ hasText: new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })
      .first();
    if (await patientOption.isVisible({ timeout: 4_000 }).catch(() => false)) {
      await patientOption.click();
    } else {
      await patientSearch.press('ArrowDown');
      await patientSearch.press('Enter');
    }

    const tipo = options.tipoProtese ?? /Coroa unitária/i;
    await dialog.getByRole('button', { name: tipo }).first().click();

    if (options.denteRegiao) {
      await dialog.locator(PROTESE_FORM_IDS.dente).fill(options.denteRegiao);
    }

    if (options.professionalName) {
      await this.selectProfissionalNovaSolicitacao(options.professionalName);
    }
  }

  async selectProfissionalNovaSolicitacao(name: string | RegExp): Promise<void> {
    const dialog = this.page.locator(PROTESE_SELECTORS.casoModal).first();
    const profField = dialog.locator('#controle-protese-professional-id');
    const current = (await profField.textContent())?.trim() ?? '';
    if (current && !/Selecione/i.test(current)) return;

    try {
      await selectIftaByInputId(this.page, 'controle-protese-professional-id', name, dialog);
      return;
    } catch {
      // fallback abaixo
    }

    const trigger = dialog
      .locator('#controle-protese-professional-id')
      .locator('xpath=ancestor::*[contains(@class,"p-select") or contains(@class,"p-iftalabel")][1]')
      .locator('[role="combobox"], .p-select-dropdown, [data-pc-section="trigger"]')
      .first();
    if (await trigger.isVisible().catch(() => false)) {
      await trigger.click({ force: true });
    } else {
      await profField.click({ force: true });
    }

    const option = this.page
      .getByRole('option', { name })
      .or(this.page.locator('.p-select-overlay .p-select-option, .p-select-list .p-select-option').filter({ hasText: name }))
      .first();
    await expect(option).toBeVisible({ timeout: 10_000 });
    await option.click();
  }

  async expectProfissionalSelecionado(): Promise<void> {
    const profField = this.page.locator('#controle-protese-professional-id');
    await expect(profField).not.toHaveText(/Selecione/i, { timeout: 10_000 });
  }

  async saveNovaSolicitacao(): Promise<number | null> {
    const dialog = this.page.locator(PROTESE_SELECTORS.casoModal).first();
    const save = dialog.getByRole('button', { name: /Criar solicitação/i });
    const responsePromise = this.page.waitForResponse(
      (res) =>
        res.url().includes('/controle-protese/casos') &&
        res.request().method() === 'POST' &&
        res.status() < 400,
      { timeout: 20_000 }
    );
    await save.click();
    const response = await responsePromise.catch(() => null);
    await expect(dialog).toBeHidden({ timeout: 20_000 });
    await this.waitForKanbanReload();

    if (!response) return null;
    const body = (await response.json().catch(() => ({}))) as { caso?: { id?: number }; id?: number };
    const id = body.caso?.id ?? body.id;
    return id ? Number(id) : null;
  }

  async cancelNovaSolicitacao(): Promise<void> {
    await closeDialog(this.page);
  }

  async openCase(label: string | RegExp): Promise<Locator> {
    const card = this.caseCard(label).first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    await card.click();
    const dialog = this.page
      .locator(`${PROTESE_SELECTORS.casoDetailModal}, ${PROTESE_SELECTORS.casoModal}, .p-dialog:visible`)
      .first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    return dialog;
  }

  async moveCaseToColumn(label: string | RegExp, column: ProteseKanbanColumn | string): Promise<void> {
    const card = this.caseCard(label).first();
    const target = this.kanbanColumnBody(column);
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(target).toBeVisible();
    await card.dragTo(target);
    await this.waitForKanbanReload();
  }

  async waitForKanbanReload(): Promise<void> {
    await this.page
      .waitForResponse((res) => res.url().includes('/controle-protese/casos') && res.request().method() === 'GET', {
        timeout: 20_000,
      })
      .catch(() => undefined);
    await this.page.waitForTimeout(600);
  }

  async openNovoLaboratorio(): Promise<Locator> {
    await this.page.getByRole('button', { name: /Novo laboratório/i }).click();
    const dialog = this.page.locator(PROTESE_SELECTORS.labModal).first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    return dialog;
  }

  async fillLaboratorioBasics(options: { nome: string; telefone?: string; email?: string }): Promise<void> {
    const dialog = this.page.locator(PROTESE_SELECTORS.labModal).first();
    await dialog.locator(PROTESE_FORM_IDS.labNome).fill(options.nome);
    if (options.telefone) {
      await dialog.locator(PROTESE_FORM_IDS.labTel).fill(options.telefone);
    }
    if (options.email) {
      await dialog.locator(PROTESE_FORM_IDS.labEmail).fill(options.email);
    }
  }

  async saveLaboratorio(): Promise<void> {
    const dialog = this.page.locator(PROTESE_SELECTORS.labModal).first();
    const response = this.page
      .waitForResponse(
        (res) =>
          res.url().includes('/controle-protese/laboratorios') &&
          ['POST', 'PUT', 'PATCH'].includes(res.request().method()) &&
          res.status() < 400,
        { timeout: 20_000 }
      )
      .catch(() => null);
    await dialog.getByRole('button', { name: /^Salvar$/i }).click();
    await response;
    await expect(dialog).toBeHidden({ timeout: 20_000 });
    await this.page.waitForTimeout(600);
  }

  async searchLaboratorios(term: string): Promise<void> {
    const search = this.page
      .locator('.cp-labs')
      .getByRole('searchbox', { name: /Buscar/i })
      .or(this.page.locator('app-dc-search-field[inputid="controle-protese-labs-busca"] input'));
    await expect(search.first()).toBeVisible({ timeout: 15_000 });
    await search.first().fill(term);
    await this.page.waitForTimeout(800);
  }

  async filterLaboratorios(filter: 'Ativos' | 'Todos'): Promise<void> {
    await this.page.getByRole('button', { name: filter, exact: true }).click();
    await this.page.waitForTimeout(600);
  }

  laboratorioRow(nome: string | RegExp): Locator {
    return this.page.getByRole('row').filter({ hasText: nome });
  }

  async openLaboratorioEditor(nome: string | RegExp): Promise<Locator> {
    const row = this.laboratorioRow(nome).first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.getByRole('button', { name: /^Editar$/i }).click();
    const dialog = await expectDialogOpen(this.page, /laboratório|nome/i);
    return dialog;
  }
}
