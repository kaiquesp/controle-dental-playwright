import { expect, type Download, type Locator, type Page } from '@playwright/test';
import {
  FINANCEIRO_FLUXO_SECTIONS,
  FINANCEIRO_FLUXO_TOTALS,
  FINANCEIRO_FORM_IDS,
  FINANCEIRO_PAINEL_INDICATORS,
  FINANCEIRO_PAINEL_SECTIONS,
  FINANCEIRO_SELECTORS,
} from '../data/financeiro';
import { closeDialog, expectDialogOpen, fillSearchSelect } from '../support/interaction-helpers';

export class FinanceiroPage {
  readonly novoLancamentoButton: Locator;
  readonly tabsNav: Locator;

  constructor(readonly page: Page) {
    this.novoLancamentoButton = page.getByRole('button', { name: /Novo lançamento/i });
    this.tabsNav = page.locator(FINANCEIRO_SELECTORS.tabs);
  }

  async goToPainel(): Promise<void> {
    await this.page.goto('/financeiro', { waitUntil: 'domcontentloaded' });
    await expect(this.page.getByText(/Painel|Visão geral do financeiro/i).first()).toBeVisible({
      timeout: 30_000,
    });
  }

  async goToFluxo(): Promise<void> {
    await this.page.goto('/financeiro/fluxo-caixa', { waitUntil: 'domcontentloaded' });
    await expect(this.page.getByText(/Fluxo de caixa/i).first()).toBeVisible({ timeout: 30_000 });
  }

  async goToSection(path: string): Promise<void> {
    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(600);
  }

  financeiroTab(label: string): Locator {
    return this.tabsNav.getByRole('link', { name: label });
  }

  async expectPainelIndicators(): Promise<void> {
    for (const pattern of FINANCEIRO_PAINEL_INDICATORS) {
      await expect(this.page.getByText(pattern).first()).toBeVisible();
    }
  }

  async expectPainelSections(): Promise<void> {
    for (const pattern of FINANCEIRO_PAINEL_SECTIONS) {
      await expect(this.page.getByText(pattern).first()).toBeVisible();
    }
  }

  async expectFluxoTotals(): Promise<void> {
    for (const pattern of FINANCEIRO_FLUXO_TOTALS) {
      await expect(this.page.getByText(pattern).first()).toBeVisible();
    }
  }

  async expectFluxoSections(): Promise<void> {
    for (const pattern of FINANCEIRO_FLUXO_SECTIONS) {
      await expect(this.page.getByText(pattern).first()).toBeVisible();
    }
  }

  async openPeriodSelector(scope: 'painel' | 'fluxo' = 'painel'): Promise<void> {
    const selector =
      scope === 'fluxo'
        ? this.page.locator(FINANCEIRO_FORM_IDS.periodoFluxo)
        : this.page.locator(FINANCEIRO_FORM_IDS.periodoPainel).or(
            this.page.locator('main').getByRole('button').filter({
              hasText: /\d{4}|janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro/i,
            })
          );
    const trigger = selector.first();
    if (await trigger.isVisible().catch(() => false)) {
      await trigger.click();
      await expect(
        this.page.locator('[role="dialog"]:visible, .p-datepicker:visible, [role="listbox"]:visible').first()
      ).toBeVisible({ timeout: 5_000 });
      await this.page.keyboard.press('Escape');
    }
  }

  async waitForTransacoesReload(): Promise<void> {
    await this.page
      .waitForResponse(
        (res) => res.url().includes('/api/financeiro/transacoes') && res.request().method() === 'GET',
        { timeout: 20_000 }
      )
      .catch(() => undefined);
    await this.page.waitForTimeout(500);
  }

  async searchLancamentos(term: string): Promise<void> {
    const field = this.page.locator('app-dc-search-field[inputid="fluxo-busca"] input');
    if (await field.isVisible().catch(() => false)) {
      await field.fill(term);
      await this.page.waitForTimeout(800);
      return;
    }

    const boletosSearch = this.page.getByRole('searchbox', { name: /^Buscar$/i });
    if (await boletosSearch.isVisible().catch(() => false)) {
      await boletosSearch.fill(term);
      await this.page.waitForTimeout(800);
      return;
    }

    const fallback = this.page
      .locator('#fluxo-busca')
      .or(this.page.getByPlaceholder(/Buscar por descrição/i));
    await expect(fallback.first()).toBeVisible({ timeout: 15_000 });
    await fallback.first().fill(term);
    await this.page.waitForTimeout(800);
  }

  lancamentoRow(label: string | RegExp): Locator {
    return this.page
      .getByRole('row')
      .filter({ hasText: label })
      .or(this.page.locator('tr, [class*="lancamento"], [class*="transacao"]').filter({ hasText: label }));
  }

  async openNovoLancamento(): Promise<Locator> {
    await this.novoLancamentoButton.click();
    return expectDialogOpen(this.page, /lançamento|transação|valor|descrição/i);
  }

  lancamentoDialog(): Locator {
    return this.page.locator(FINANCEIRO_SELECTORS.lancamentoModal).filter({
      has: this.page.locator(FINANCEIRO_FORM_IDS.descricao),
    }).first();
  }

  async fillLancamento(options: {
    tipo?: 'receita' | 'despesa';
    valor: string;
    descricao: string;
    status?: 'pago' | 'pendente';
    patientName?: string;
  }): Promise<void> {
    const dialog = this.lancamentoDialog();
    const tipo = options.tipo ?? 'despesa';
    await dialog.getByRole('button', { name: tipo === 'receita' ? /^Receita$/i : /^Despesa$/i }).click();

    if (tipo === 'despesa') {
      const fornecedorBtn = dialog.getByRole('button', { name: /^Fornecedor$/i });
      if (await fornecedorBtn.isVisible().catch(() => false)) {
        await fornecedorBtn.click();
      }
    }

    if (tipo === 'receita' && options.patientName) {
      await fillSearchSelect(this.page, 'nt-origem', options.patientName.slice(0, 12), dialog);
    }

    await dialog.locator(FINANCEIRO_FORM_IDS.valor).fill(options.valor);
    await dialog.locator(FINANCEIRO_FORM_IDS.descricao).fill(options.descricao);
    const statusId = options.status === 'pendente' ? FINANCEIRO_FORM_IDS.statusPendente : FINANCEIRO_FORM_IDS.statusPago;
    await dialog.locator(statusId).click({ force: true });
  }

  async saveLancamento(): Promise<number | null> {
    const dialog = this.lancamentoDialog();
    const responsePromise = this.page.waitForResponse(
      (res) => res.url().includes('/api/financeiro/transacoes') && res.request().method() === 'POST',
      { timeout: 20_000 }
    );
    await dialog.getByRole('button', { name: /Salvar lançamento/i }).click();
    const response = await responsePromise.catch(() => null);
    if (response && response.status() >= 400) {
      throw new Error(`saveLancamento failed (${response.status()}): ${(await response.text()).slice(0, 200)}`);
    }
    await expect(dialog).toBeHidden({ timeout: 20_000 }).catch(() => closeDialog(this.page));
    await this.waitForTransacoesReload();

    if (!response?.ok()) return null;
    const body = (await response.json().catch(() => ({}))) as { id?: number; transacao?: { id?: number } };
    const id = body.id ?? body.transacao?.id;
    return id ? Number(id) : null;
  }

  async openLancamentoActions(label: string | RegExp): Promise<void> {
    const row = this.lancamentoRow(label).first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    const actionBtn = row
      .getByRole('button')
      .or(row.locator('[aria-label*="dropdown" i], [aria-label*="ações" i], [aria-label*="menu" i]'));
    if (await actionBtn.first().isVisible().catch(() => false)) {
      await actionBtn.first().click();
      return;
    }
    await row.click();
  }

  async editLancamento(label: string | RegExp, newDescricao: string): Promise<void> {
    const row = this.lancamentoRow(label).first();
    await expect(row).toBeVisible({ timeout: 15_000 });

    const editBtn = row
      .getByRole('button', { name: /Editar/i })
      .or(row.locator('[aria-label*="Editar" i]'))
      .or(this.page.getByRole('menuitem', { name: /Editar/i }));
    if (await editBtn.first().isVisible().catch(() => false)) {
      await editBtn.first().click();
    } else {
      await this.openLancamentoActions(label);
      const menuEdit = this.page.getByRole('menuitem', { name: /Editar/i }).or(
        this.page.getByRole('button', { name: /Editar/i })
      );
      if (await menuEdit.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
        await menuEdit.first().click();
      } else {
        await row.dblclick();
      }
    }

    const dialog = this.lancamentoDialog();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.locator(FINANCEIRO_FORM_IDS.descricao).fill(newDescricao);
    const responsePromise = this.page.waitForResponse(
      (res) =>
        res.url().includes('/api/financeiro/transacoes') &&
        ['PUT', 'PATCH'].includes(res.request().method()) &&
        res.status() < 400,
      { timeout: 20_000 }
    );
    await dialog.getByRole('button', { name: /^Salvar/i }).click();
    await responsePromise.catch(() => undefined);
    await expect(dialog).toBeHidden({ timeout: 20_000 }).catch(() => closeDialog(this.page));
    await this.waitForTransacoesReload();
  }

  async deleteLancamento(label: string | RegExp): Promise<void> {
    const row = this.lancamentoRow(label).first();
    await expect(row).toBeVisible({ timeout: 15_000 });

    const deleteBtn = row
      .getByRole('button', { name: /Excluir|Remover/i })
      .or(row.locator('[aria-label*="Excluir" i]'))
      .or(this.page.getByRole('menuitem', { name: /Excluir|Remover/i }));
    if (await deleteBtn.first().isVisible().catch(() => false)) {
      await deleteBtn.first().click();
    } else {
      await this.openLancamentoActions(label);
      const menuDelete = this.page.getByRole('menuitem', { name: /Excluir|Remover/i });
      if (await menuDelete.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
        await menuDelete.first().click();
      } else {
        await row.click();
        const dialogDelete = this.page.getByRole('button', { name: /Excluir|Remover/i });
        await dialogDelete.first().click({ timeout: 5_000 }).catch(() => undefined);
      }
    }

    const confirm = this.page.getByRole('button', { name: /Confirmar|Excluir|Sim/i }).first();
    if (await confirm.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const responsePromise = this.page.waitForResponse(
        (res) =>
          res.url().includes('/api/financeiro/transacoes') &&
          res.request().method() === 'DELETE' &&
          res.status() < 400,
        { timeout: 20_000 }
      );
      await confirm.click();
      await responsePromise.catch(() => undefined);
    }
    await this.waitForTransacoesReload();
  }

  async exportRelatorio(): Promise<Download | null> {
    const direct = this.page.getByRole('button', { name: /Exportar/i }).first();
    if (await direct.isVisible().catch(() => false)) {
      const downloadPromise = this.page.waitForEvent('download', { timeout: 15_000 });
      await direct.click();
      return downloadPromise.catch(() => null);
    }

    const trigger = this.page.locator('[aria-label="dropdown trigger"]').first();
    if (await trigger.isVisible().catch(() => false)) {
      await trigger.click();
      const exportItem = this.page.getByRole('menuitem', { name: /Exportar/i }).or(
        this.page.getByRole('option', { name: /Exportar/i })
      );
      if (await exportItem.first().isVisible().catch(() => false)) {
        const downloadPromise = this.page.waitForEvent('download', { timeout: 15_000 });
        await exportItem.first().click();
        return downloadPromise.catch(() => null);
      }
    }

    return null;
  }

  async cancelLancamentoModal(): Promise<void> {
    await closeDialog(this.page);
  }
}
