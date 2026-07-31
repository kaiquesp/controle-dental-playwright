import { expect, type Locator, type Page } from '@playwright/test';
import {
  CONFIG_CTAS,
  CONFIG_FORM_IDS,
  CONFIG_SELECTORS,
  CONFIG_TAB_ALIASES,
  SUCCESS_TOAST,
} from '../data/configuracoes';
import { closeDialog, expectDialogOpen, visibleDialog } from '../support/interaction-helpers';
import { expectToast } from '../support/toast-helpers';

export class ConfiguracoesPage {
  readonly root: Locator;
  readonly tabsNav: Locator;

  constructor(readonly page: Page) {
    this.root = page.locator(CONFIG_SELECTORS.root).first();
    this.tabsNav = page.locator(CONFIG_SELECTORS.tabsNav).first();
  }

  async goTo(): Promise<void> {
    await this.page.goto('/configuracoes', { waitUntil: 'domcontentloaded' });
    await expect(this.root).toBeVisible({ timeout: 30_000 });
  }

  sectionTab(label: string): Locator {
    const alias = CONFIG_TAB_ALIASES[label];
    if (alias) {
      return this.tabsNav.getByRole('button', { name: alias }).first();
    }
    return this.tabsNav.getByRole('button', { name: label }).first();
  }

  async openSection(label: string): Promise<void> {
    const tab = this.sectionTab(label);
    await expect(tab).toBeVisible({ timeout: 20_000 });
    await tab.click({ force: true });
    await expect(tab).toHaveClass(/config__tab--active/, { timeout: 10_000 });
  }

  async expectSectionContent(pattern: RegExp): Promise<void> {
    const main = this.page.locator('main');
    await expect(main.getByText(pattern).and(this.page.locator(':visible')).first()).toBeVisible({
      timeout: 15_000,
    });
  }

  async waitForApiGet(pathFragment: string, timeout = 20_000): Promise<void> {
    await this.page
      .waitForResponse(
        (res) => res.url().includes(pathFragment) && res.request().method() === 'GET' && res.status() < 500,
        { timeout }
      )
      .catch(() => undefined);
  }

  dialog(): Locator {
    return visibleDialog(this.page);
  }

  async openCta(pattern: RegExp): Promise<Locator> {
    const btn = this.page.getByRole('button', { name: pattern }).first();
    await expect(btn).toBeVisible({ timeout: 20_000 });
    await btn.click();
    return expectDialogOpen(this.page);
  }

  async cancelDialog(): Promise<void> {
    await closeDialog(this.page);
  }

  async clickSaveInDialog(savePattern: RegExp = /Salvar|Criar|Adicionar|Confirmar|Cadastrar/i): Promise<void> {
    const dialog = this.dialog();
    const btn = dialog.getByRole('button', { name: savePattern }).first();
    await btn.scrollIntoViewIfNeeded().catch(() => undefined);
    try {
      await btn.click({ force: true, timeout: 5_000 });
    } catch {
      await btn.evaluate((el: HTMLElement) => el.click());
    }
  }

  async submitEmptyAndExpectValidation(savePattern?: RegExp): Promise<void> {
    const dialog = this.dialog();
    await expect(dialog).toBeVisible();
    await this.clickSaveInDialog(savePattern);
    const invalid = dialog.locator('[aria-invalid="true"], .ng-invalid.ng-touched, .p-invalid, .ng-invalid');
    const toastOrMsg = this.page.locator(
      '.p-toast-message-error, .p-toast-message-warn, .p-error, small.p-error, .p-toast-message'
    );
    await expect
      .poll(async () => (await invalid.count()) + (await toastOrMsg.count()), { timeout: 8_000 })
      .toBeGreaterThan(0);
    await expect(dialog).toBeVisible();
  }

  // --- Perfil / clínica ---

  async fillPerfilNome(nome: string): Promise<void> {
    await this.page.locator(CONFIG_FORM_IDS.perfil.nome).fill(nome);
  }

  async savePerfilAlteracoes(expectSuccess = true): Promise<void> {
    await this.page.getByRole('button', { name: CONFIG_CTAS.salvarAlteracoes }).first().click();
    if (expectSuccess) {
      await expectToast(this.page, SUCCESS_TOAST, 15_000).catch(async () => {
        await expect(this.page.locator(CONFIG_FORM_IDS.perfil.nome)).toBeVisible();
      });
    }
  }

  async fillClinicaCampo(field: keyof typeof CONFIG_FORM_IDS.clinica, value: string): Promise<void> {
    await this.page.locator(CONFIG_FORM_IDS.clinica[field]).fill(value);
  }

  async saveClinica(expectSuccess = true): Promise<void> {
    await this.page.getByRole('button', { name: CONFIG_CTAS.salvarAlteracoes }).first().click();
    if (expectSuccess) {
      await expectToast(this.page, SUCCESS_TOAST, 15_000).catch(async () => {
        await expect(this.page.locator(CONFIG_FORM_IDS.clinica.nomeFantasia)).toBeVisible();
      });
    }
  }

  // --- Cadastros ---

  async openNovoFornecedor(): Promise<Locator> {
    return this.openCta(CONFIG_CTAS.novoFornecedor);
  }

  async fillFornecedor(options: { nome: string; email?: string; tel?: string }): Promise<void> {
    const dialog = this.dialog();
    await dialog.locator(CONFIG_FORM_IDS.fornecedor.nome).fill(options.nome);
    if (options.email) await dialog.locator(CONFIG_FORM_IDS.fornecedor.email).fill(options.email);
    if (options.tel) await dialog.locator(CONFIG_FORM_IDS.fornecedor.tel).fill(options.tel);
  }

  async saveFornecedor(): Promise<number | null> {
    return this.saveEntityCapturingId(/\/api\/fornecedores/, /Salvar|Criar|Adicionar/i);
  }

  async openNovaSala(): Promise<Locator> {
    return this.openCta(CONFIG_CTAS.novaSala);
  }

  async fillSala(options: { nome: string; desc?: string }): Promise<void> {
    const dialog = this.dialog();
    await dialog.locator(CONFIG_FORM_IDS.sala.nome).fill(options.nome);
    if (options.desc) await dialog.locator(CONFIG_FORM_IDS.sala.desc).fill(options.desc);
  }

  async saveSala(): Promise<number | null> {
    return this.saveEntityCapturingId(/\/api\/salas-cadeiras/, /Salvar|Criar|Adicionar/i);
  }

  async openNovoDentista(): Promise<Locator> {
    return this.openCta(CONFIG_CTAS.novoDentista);
  }

  async fillDentista(options: { nome: string; especialidade?: string }): Promise<void> {
    const dialog = this.dialog();
    await dialog.locator(CONFIG_FORM_IDS.dentista.nome).fill(options.nome);
    if (options.especialidade) {
      await dialog.locator(CONFIG_FORM_IDS.dentista.especialidade).fill(options.especialidade);
    }
  }

  async saveDentista(): Promise<number | null> {
    return this.saveEntityCapturingId(/\/api\/profissionais/, /Salvar|Criar|Adicionar/i);
  }

  async openNovoTratamento(): Promise<Locator> {
    return this.openCta(CONFIG_CTAS.novoTratamento);
  }

  async fillTratamento(options: { nome: string; valor?: string; codigo?: string }): Promise<void> {
    const dialog = this.dialog();
    await dialog.locator(CONFIG_FORM_IDS.tratamento.nome).fill(options.nome);
    if (options.codigo) await dialog.locator(CONFIG_FORM_IDS.tratamento.codigo).fill(options.codigo);
    if (options.valor) await dialog.locator(CONFIG_FORM_IDS.tratamento.valor).fill(options.valor);
  }

  async saveTratamento(): Promise<number | null> {
    return this.saveEntityCapturingId(/\/api\/tratamentos/, /Salvar|Criar|Adicionar/i);
  }

  /**
   * "Novo medicamento" abre um formulário inline na própria página, não um modal
   * (diferente das demais entidades de cadastro). Retorna o escopo correto para
   * localizar os campos: o dialog, se por acaso vier como modal, ou a raiz da
   * tela de configurações quando o formulário é inline.
   */
  async openNovoMedicamento(): Promise<Locator> {
    const btn = this.page.getByRole('button', { name: CONFIG_CTAS.novoMedicamento }).first();
    await expect(btn).toBeVisible({ timeout: 20_000 });
    await btn.click();

    const dialog = visibleDialog(this.page);
    const inlineNome = this.page.locator(CONFIG_FORM_IDS.medicamento.nome);
    await expect(dialog.or(inlineNome)).toBeVisible({ timeout: 10_000 });
    if (await dialog.isVisible().catch(() => false)) {
      return dialog;
    }
    return this.root;
  }

  /** Fecha o formulário de medicamento, seja ele um modal ou o painel inline. */
  async closeMedicamentoForm(): Promise<void> {
    const dialog = visibleDialog(this.page);
    if (await dialog.isVisible().catch(() => false)) {
      await this.cancelDialog();
      return;
    }
    const back = this.page.getByRole('button', { name: /Voltar para lista|Cancelar/i }).first();
    if (await back.isVisible().catch(() => false)) {
      await back.click();
    }
  }

  async fillMedicamento(options: { nome: string; principio?: string; posologia?: string }): Promise<void> {
    const dialog = this.dialog();
    await dialog.locator(CONFIG_FORM_IDS.medicamento.nome).fill(options.nome);
    if (options.principio) await dialog.locator(CONFIG_FORM_IDS.medicamento.principio).fill(options.principio);
    if (options.posologia) await dialog.locator(CONFIG_FORM_IDS.medicamento.posologia).fill(options.posologia);
  }

  async saveMedicamento(): Promise<number | null> {
    return this.saveEntityCapturingId(/\/api\/medicamentos/, /Salvar|Criar|Adicionar/i);
  }

  async openAdicionarMembro(): Promise<Locator> {
    return this.openCta(CONFIG_CTAS.adicionarMembro);
  }

  async fillMembro(options: { nome: string; email: string }): Promise<void> {
    const dialog = this.dialog();
    await dialog.locator(CONFIG_FORM_IDS.equipe.nome).fill(options.nome);
    await dialog.locator(CONFIG_FORM_IDS.equipe.email).fill(options.email);
  }

  rowByText(text: string | RegExp): Locator {
    return this.page.getByRole('row').filter({ hasText: text }).first();
  }

  async deleteRowByText(text: string | RegExp): Promise<void> {
    const row = this.rowByText(text);
    await expect(row).toBeVisible({ timeout: 15_000 });
    const del = row.getByRole('button', { name: /Excluir|Remover|Apagar/i }).first();
    if (await del.isVisible().catch(() => false)) {
      await del.click();
      const confirm = this.page.getByRole('button', { name: /Confirmar|Excluir|Sim|Remover/i }).last();
      if (await confirm.isVisible().catch(() => false)) await confirm.click();
      await expectToast(this.page, SUCCESS_TOAST, 15_000).catch(() => undefined);
    }
  }

  async editRowByText(text: string | RegExp): Promise<Locator> {
    const row = this.rowByText(text);
    await expect(row).toBeVisible({ timeout: 15_000 });
    const edit = row.getByRole('button', { name: /Editar|Alterar/i }).first();
    await edit.click();
    return expectDialogOpen(this.page);
  }

  private async saveEntityCapturingId(urlPattern: RegExp, savePattern: RegExp): Promise<number | null> {
    const dialog = this.dialog();
    const responsePromise = this.page.waitForResponse(
      (res) =>
        urlPattern.test(res.url()) &&
        ['POST', 'PUT'].includes(res.request().method()) &&
        res.status() < 400,
      { timeout: 20_000 }
    );
    const btn = dialog.getByRole('button', { name: savePattern }).first();
    await btn.scrollIntoViewIfNeeded().catch(() => undefined);
    try {
      await btn.click({ force: true, timeout: 5_000 });
    } catch {
      await btn.evaluate((el: HTMLElement) => el.click());
    }
    const response = await responsePromise.catch(() => null);
    await expect(dialog)
      .toBeHidden({ timeout: 20_000 })
      .catch(() => undefined);
    await expectToast(this.page, SUCCESS_TOAST, 10_000).catch(() => undefined);
    if (!response?.ok()) return null;
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return extractId(body);
  }
}

function extractId(body: Record<string, unknown>): number | null {
  if (typeof body.id === 'number') return body.id;
  for (const key of Object.keys(body)) {
    const nested = body[key];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const id = (nested as Record<string, unknown>).id;
      if (typeof id === 'number') return id;
    }
  }
  return null;
}
