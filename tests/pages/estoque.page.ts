import { expect, type Download, type Locator, type Page } from '@playwright/test';
import {
  ESTOQUE_FORM_IDS,
  ESTOQUE_KPIS,
  ESTOQUE_SCREEN_MAP,
  ESTOQUE_SELECTORS,
  ESTOQUE_TABLE_COLUMNS,
} from '../data/estoque';
import { closeDialog, selectIftaByInputId } from '../support/interaction-helpers';

export class EstoquePage {
  readonly root: Locator;
  readonly novoMaterialButton: Locator;
  readonly exportButton: Locator;

  constructor(readonly page: Page) {
    this.root = page.locator(ESTOQUE_SELECTORS.root).first();
    this.novoMaterialButton = page.getByRole('button', { name: /Novo material/i });
    this.exportButton = page.getByRole('button', { name: /^Exportar$/i });
  }

  async goTo(): Promise<void> {
    await this.page.goto('/estoque', { waitUntil: 'domcontentloaded' });
    await expect(this.root).toBeVisible({ timeout: 30_000 });
    await this.waitForMateriaisReload();
  }

  async waitForMateriaisReload(): Promise<void> {
    await this.page
      .waitForResponse(
        (res) => res.url().includes('/api/estoque/materiais') && res.request().method() === 'GET',
        { timeout: 20_000 }
      )
      .catch(() => undefined);
  }

  async expectScreenMap(): Promise<void> {
    const { expectScreenMap } = await import('../support/screen-map');
    await expectScreenMap(this.page, ESTOQUE_SCREEN_MAP, this.root);
  }

  async expectKpis(): Promise<void> {
    for (const kpi of ESTOQUE_KPIS) {
      await expect(this.root.getByText(kpi).first()).toBeVisible({ timeout: 20_000 });
    }
  }

  async expectTableHeaders(): Promise<void> {
    for (const column of ESTOQUE_TABLE_COLUMNS) {
      await expect(this.page.locator(ESTOQUE_SELECTORS.table).getByRole('columnheader', { name: column }).first()).toBeVisible({
        timeout: 10_000,
      });
    }
  }

  materialDialog(): Locator {
    return this.page
      .locator('[role="dialog"]')
      .filter({ has: this.page.locator(ESTOQUE_FORM_IDS.nome) })
      .last();
  }

  async openNovoMaterial(): Promise<Locator> {
    await this.novoMaterialButton.click();
    const dialog = this.materialDialog();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    return dialog;
  }

  async fillMaterial(options: {
    nome: string;
    codigo?: string;
    categoria?: string | RegExp;
    quantidade?: string;
    unidade?: string | RegExp;
    minimo?: string;
    descricao?: string;
    custo?: string;
    fornecedor?: string;
  }): Promise<void> {
    const dialog = this.materialDialog();
    await dialog.locator(ESTOQUE_FORM_IDS.nome).fill(options.nome);
    if (options.descricao) await dialog.locator(ESTOQUE_FORM_IDS.descricao).fill(options.descricao);
    if (options.codigo) await dialog.locator(ESTOQUE_FORM_IDS.codigo).fill(options.codigo);
    if (options.categoria) {
      await selectIftaByInputId(this.page, 'nm-cat', options.categoria, dialog);
    }
    if (options.quantidade) await dialog.locator(ESTOQUE_FORM_IDS.quantidade).fill(options.quantidade);
    if (options.unidade) {
      await selectIftaByInputId(this.page, 'nm-un', options.unidade, dialog);
    }
    if (options.minimo) await dialog.locator(ESTOQUE_FORM_IDS.minimo).fill(options.minimo);
    if (options.custo) await dialog.locator(ESTOQUE_FORM_IDS.custo).fill(options.custo);
    if (options.fornecedor) await dialog.locator(ESTOQUE_FORM_IDS.fornecedor).fill(options.fornecedor);
  }

  async saveMaterial(): Promise<number | null> {
    const dialog = this.materialDialog();
    const responsePromise = this.page.waitForResponse(
      (res) =>
        res.url().includes('/api/estoque/materiais') &&
        ['POST', 'PUT'].includes(res.request().method()) &&
        res.status() < 400,
      { timeout: 20_000 }
    );
    await dialog.getByRole('button', { name: /Salvar material/i }).click();
    const response = await responsePromise.catch(() => null);
    await expect(dialog).toBeHidden({ timeout: 20_000 });
    await this.waitForMateriaisReload();
    if (!response?.ok()) return null;
    const body = (await response.json().catch(() => ({}))) as {
      material?: { id?: number };
      id?: number;
    };
    const id = body.material?.id ?? body.id;
    return id ? Number(id) : null;
  }

  async cancelMaterialModal(): Promise<void> {
    await closeDialog(this.page);
    await expect(this.materialDialog()).toBeHidden({ timeout: 10_000 });
  }

  materialRow(label: string | RegExp): Locator {
    return this.page.locator(`${ESTOQUE_SELECTORS.table} tbody tr`).filter({ hasText: label });
  }

  async setFilterCategoria(label: string | RegExp): Promise<void> {
    await selectIftaByInputId(this.page, 'est-cat', label, this.root);
    await this.page.waitForTimeout(500);
  }

  async setFilterStatus(label: string | RegExp): Promise<void> {
    await selectIftaByInputId(this.page, 'est-st', label, this.root);
    await this.page.waitForTimeout(500);
  }

  async resetFilters(): Promise<void> {
    await this.setFilterCategoria(/Todas as categorias/i);
    await this.setFilterStatus(/Todos os status/i);
  }

  async openEditMaterial(label: string | RegExp): Promise<Locator> {
    const row = this.materialRow(label).first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.getByRole('button', { name: /Editar material/i }).click();
    const dialog = this.materialDialog();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.locator(ESTOQUE_FORM_IDS.nome)).not.toHaveValue('', { timeout: 15_000 });
    return dialog;
  }

  async deleteMaterial(label: string | RegExp): Promise<void> {
    const row = this.materialRow(label).first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    this.page.once('dialog', (dialog) => dialog.accept());
    const responsePromise = this.page.waitForResponse(
      (res) =>
        res.url().includes('/api/estoque/materiais') &&
        res.request().method() === 'DELETE' &&
        res.status() < 400,
      { timeout: 20_000 }
    );
    await row.getByRole('button', { name: /Excluir material/i }).click();
    await responsePromise.catch(() => undefined);
    await this.waitForMateriaisReload();
  }

  async exportInventario(): Promise<Download | null> {
    if (!(await this.exportButton.isVisible().catch(() => false))) return null;
    const downloadPromise = this.page.waitForEvent('download', { timeout: 15_000 });
    await this.exportButton.click();
    return downloadPromise.catch(() => null);
  }
}
