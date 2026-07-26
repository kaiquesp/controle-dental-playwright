import { expect, type Page } from '@playwright/test';
import { PACIENTE_FORM_IDS, PACIENTE_NOVO_SCREEN_MAP, PACIENTES_SELECTORS } from '../data/pacientes';
import { extractPatientId } from '../support/crud-helpers';
import { dismissBillingLockUi } from '../support/billing-mocks';
import { expectScreenMap } from '../support/screen-map';

export class PacienteFormPage {
  constructor(readonly page: Page) {}

  async dismissBlockingUi(): Promise<void> {
    await dismissBillingLockUi(this.page);
  }

  async goToNovo(): Promise<void> {
    await this.page.goto('/pacientes/novo', { waitUntil: 'domcontentloaded' });
    await this.dismissBlockingUi();
    await expect(this.page.locator(PACIENTES_SELECTORS.formRoot).first()).toBeVisible({ timeout: 30_000 });
  }

  async expectNovoScreenMap(): Promise<void> {
    await expectScreenMap(this.page, PACIENTE_NOVO_SCREEN_MAP);
  }

  async fillMinimoObrigatorio(name: string): Promise<void> {
    const nome = this.page.locator(PACIENTE_FORM_IDS.nome).or(this.page.getByRole('textbox', { name: /Nome completo/i }));
    const celular = this.page
      .locator(PACIENTE_FORM_IDS.celular)
      .or(this.page.getByRole('textbox', { name: /Celular.*WhatsApp/i }));
    await nome.first().fill(name);
    await celular.first().fill('(11) 98765-4321');
    await this.page.locator(PACIENTE_FORM_IDS.semCpf).check();
  }

  async save(): Promise<string> {
    await this.dismissBlockingUi();
    const saveBtn = this.page.getByRole('button', { name: /Salvar Paciente/i });
    await expect(saveBtn).toBeEnabled({ timeout: 10_000 });

    const createResponse = this.page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/api\/pacientes\/?$/.test(new URL(response.url()).pathname) &&
        response.status() < 500,
      { timeout: 60_000 }
    );

    await saveBtn.click();
    const response = await createResponse;
    const responseBody = await response.json();
    expect(
      response.ok(),
      `criar paciente falhou (${response.status()}): ${JSON.stringify(responseBody).slice(0, 300)}`
    ).toBeTruthy();

    const patientId = extractPatientId(responseBody);
    if (!patientId) {
      throw new Error('API de criação retornou sem id do paciente');
    }

    if (!this.page.url().includes(`/pacientes/${patientId}/edit`)) {
      await this.page.goto(`/pacientes/${patientId}/edit/informacoes`, { waitUntil: 'domcontentloaded' });
    }

    await expect(this.page).toHaveURL(new RegExp(`/pacientes/${patientId}/edit/`), { timeout: 15_000 });
    return patientId;
  }

  async createPatient(name: string, options?: { skipNavigation?: boolean }): Promise<string> {
    if (options?.skipNavigation) {
      await this.dismissBlockingUi();
    } else {
      await this.goToNovo();
    }
    await this.fillMinimoObrigatorio(name);
    return this.save();
  }

  async cancel(): Promise<void> {
    await this.page.getByRole('button', { name: /Cancelar/i }).click();
  }

  async openEditMode(): Promise<void> {
    const editBtn = this.page.getByRole('button', { name: /^Editar$/i });
    if (await editBtn.isVisible().catch(() => false)) {
      await editBtn.click();
    }
  }

  async updateNome(newName: string): Promise<void> {
    await this.openEditMode();
    const dialog = this.page.getByRole('dialog', {
      name: /Editar informações do paciente|Cadastrar informações do paciente/i,
    });
    const scope = (await dialog.isVisible().catch(() => false)) ? dialog : this.page;
    await scope.locator(PACIENTE_FORM_IDS.nome).fill(newName);
    await scope.getByRole('button', { name: /Salvar Paciente|Salvar alterações|Salvar/i }).click();
    if (await dialog.isVisible().catch(() => false)) {
      await expect(dialog).toBeHidden({ timeout: 20_000 });
    }
    await expect(this.page.getByRole('heading', { name: newName }).first()).toBeVisible({ timeout: 20_000 });
  }

  async deleteFromProntuario(): Promise<void> {
    await this.page.getByRole('button', { name: /Mais ações/i }).click();
    await this.page.getByRole('menuitem', { name: /Excluir Paciente/i }).click();
    const deleteDialog = this.page.locator(PACIENTES_SELECTORS.deleteDialog);
    await expect(deleteDialog).toBeVisible({ timeout: 15_000 });
    await deleteDialog.getByRole('button', { name: /^Excluir paciente$/i }).click();
    await expect(deleteDialog).toBeHidden({ timeout: 20_000 });
  }
}
