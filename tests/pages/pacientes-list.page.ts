import { expect, type Locator, type Page } from '@playwright/test';
import { PACIENTES_LIST_SCREEN_MAP, PACIENTES_SELECTORS } from '../data/pacientes';
import { dismissBillingLockUi } from '../support/billing-mocks';
import { expectScreenMap } from '../support/screen-map';

export class PacientesListPage {
  readonly root: Locator;
  readonly searchInput: Locator;
  readonly novoPacienteButton: Locator;
  readonly atencaoSemanaButton: Locator;

  constructor(readonly page: Page) {
    this.root = page.locator(PACIENTES_SELECTORS.listRoot).first();
    this.searchInput = page.getByPlaceholder('Buscar por nome, CPF ou telefone');
    this.novoPacienteButton = page.getByRole('button', { name: /Novo paciente/i });
    this.atencaoSemanaButton = page.getByRole('button', { name: /Atenção da semana/i });
  }

  async goTo(): Promise<void> {
    await this.page.goto('/pacientes/buscar', { waitUntil: 'domcontentloaded' });
    await dismissBillingLockUi(this.page);
    await expect(this.page.getByRole('heading', { name: 'Pacientes' })).toBeVisible({ timeout: 30_000 });
  }

  async expectScreenMap(): Promise<void> {
    await expectScreenMap(this.page, PACIENTES_LIST_SCREEN_MAP);
  }

  async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
    await this.page.waitForTimeout(800);
  }

  patientRow(name: string): Locator {
    return this.page.locator(PACIENTES_SELECTORS.patientRow).filter({ hasText: name });
  }

  async openPatientProntuario(name: string): Promise<void> {
    const row = this.patientRow(name);
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.click();
    await expect(this.page).toHaveURL(/\/pacientes\/\d+\/edit\//, { timeout: 30_000 });
  }

  async clickShortcut(label: RegExp): Promise<void> {
    await this.page.getByRole('button', { name: label }).click();
  }

  async openFilterDropdown(index: number): Promise<void> {
    const triggers = this.page.locator('[aria-label="dropdown trigger"]:visible');
    await triggers.nth(index).click();
  }

  async selectFilterOption(option: string | RegExp): Promise<void> {
    const item = this.page.getByRole('option', { name: option }).or(this.page.getByRole('menuitem', { name: option }));
    await expect(item.first()).toBeVisible({ timeout: 8_000 });
    await item.first().click();
    await this.page.waitForTimeout(600);
  }

  async openGerenciarModelosMensagem(): Promise<void> {
    await this.page.getByRole('link', { name: /Gerenciar modelos de mensagem/i }).click();
    await expect(this.page).toHaveURL(/configuracoes.*mensagens|aba=mensagens-relacionamento/i, {
      timeout: 20_000,
    });
  }

  async openNovaConsultaFromRow(name: string): Promise<void> {
    const row = this.patientRow(name);
    const novaConsulta = row.getByRole('button', { name: /Nova consulta/i });
    await expect(novaConsulta).toBeVisible({ timeout: 15_000 });
    await novaConsulta.click();
    await expect(this.page.locator('[role="dialog"]:visible, .p-dialog:visible').first()).toBeVisible({
      timeout: 15_000,
    });
  }

  async openAtencaoSemana(): Promise<void> {
    await this.atencaoSemanaButton.click();
    await expect(this.page.getByText(/atenção|semana|retorno|anivers/i).first()).toBeVisible({ timeout: 10_000 });
  }
}
