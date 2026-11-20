import { expect, type Locator, type Page } from '@playwright/test';
import { say } from '../support/ai-voice-mocks';

export type AiVoiceModalKind = 'registro' | 'tratamento' | 'finalizar';

const DIALOG_CLASS: Record<AiVoiceModalKind, string> = {
  registro: '.p-dialog.pf-clinical-record-modal-dialog',
  tratamento: '.p-dialog.pf-trat-clin-modal-dialog',
  finalizar: '.p-dialog.pf-trat-fin-modal-dialog',
};

/**
 * Page Object da barra "Assistente IA por Voz" (`app-dc-ai-voice-toolbar`) e dos três modais
 * do prontuário que a usam: Novo/Editar registro, Novo/Editar tratamento e Finalizar tratamento.
 */
export class AiVoicePage {
  constructor(readonly page: Page) {}

  dialog(kind: AiVoiceModalKind): Locator {
    return this.page.locator(DIALOG_CLASS[kind]);
  }

  toolbar(kind: AiVoiceModalKind): Locator {
    return this.dialog(kind).locator('app-dc-ai-voice-toolbar');
  }

  toolbarRoot(kind: AiVoiceModalKind): Locator {
    return this.dialog(kind).locator('.dc-ai-voice-toolbar');
  }

  credits(kind: AiVoiceModalKind): Locator {
    return this.dialog(kind).getByTestId('ai-voice-credits');
  }

  target(kind: AiVoiceModalKind = 'registro'): Locator {
    return this.dialog(kind).getByTestId('ai-voice-target');
  }

  help(kind: AiVoiceModalKind): Locator {
    return this.dialog(kind).getByTestId('ai-voice-help');
  }

  handsFree(kind: AiVoiceModalKind): Locator {
    return this.dialog(kind).getByTestId('ai-voice-hands-free');
  }

  recordButton(kind: AiVoiceModalKind): Locator {
    return this.dialog(kind).getByTestId('ai-voice-record');
  }

  improveButton(kind: AiVoiceModalKind): Locator {
    return this.dialog(kind).getByTestId('ai-voice-improve');
  }

  undoButton(kind: AiVoiceModalKind): Locator {
    return this.dialog(kind).getByTestId('ai-voice-undo');
  }

  liveRegion(kind: AiVoiceModalKind): Locator {
    return this.toolbar(kind).locator('.visually-hidden[aria-live="polite"]');
  }

  timer(kind: AiVoiceModalKind): Locator {
    return this.dialog(kind).locator('.dc-ai-voice-toolbar__timer');
  }

  closeButton(kind: AiVoiceModalKind): Locator {
    return this.dialog(kind).getByRole('button', { name: 'Fechar modal' });
  }

  cancelButton(kind: AiVoiceModalKind): Locator {
    return this.dialog(kind).getByRole('button', { name: /^Cancelar$/ });
  }

  // ---------------------------------------------------------------- Registro (ficha clínica)

  realizado(): Locator {
    return this.dialog('registro').locator('textarea#clinical-record-modal-realizado');
  }

  plano(): Locator {
    return this.dialog('registro').locator('textarea#clinical-record-modal-plano');
  }

  recordDate(): Locator {
    return this.dialog('registro').locator('input#clinical-record-modal-data');
  }

  recordProfessional(): Locator {
    return this.dialog('registro').locator('#clinical-record-modal-profissional');
  }

  recordLiveText(): Locator {
    return this.dialog('registro').locator('.pf-clinical-record-modal__ai-live');
  }

  recordSaveButton(): Locator {
    return this.dialog('registro').getByRole('button', { name: /^(Salvar registro|Salvar alterações)$/ });
  }

  async openNovoRegistro(): Promise<Locator> {
    const btn = this.page
      .locator('main, app-paciente-form-content')
      .first()
      .getByRole('button', { name: /^\s*Novo registro\s*$/i })
      .first();
    await expect(btn).toBeVisible({ timeout: 20_000 });
    await btn.click();
    const dialog = this.dialog('registro');
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByRole('heading', { name: 'Novo registro' })).toBeVisible();
    return dialog;
  }

  // ---------------------------------------------------------------- Tratamento

  treatmentField(id: 'proc' | 'prof' | 'data' | 'status' | 'valor' | 'detalhes' | 'obs' | 'categoria'): Locator {
    const tag = id === 'obs' ? 'textarea' : 'input';
    return this.dialog('tratamento').locator(`${tag}#trat-modal-${id}`);
  }

  toothGroup(): Locator {
    return this.dialog('tratamento').getByRole('group', { name: 'Dente' });
  }

  faceGroup(): Locator {
    return this.dialog('tratamento').getByRole('group', { name: 'Faces' });
  }

  arcadaGroup(): Locator {
    return this.dialog('tratamento').getByRole('group', { name: 'Arcada' });
  }

  activeTooth(): Locator {
    return this.toothGroup().locator('.pf-trat-clin-modal__tooth-chip--active');
  }

  activeFaces(): Locator {
    return this.faceGroup().locator('.pf-trat-clin-modal__face-chip--active');
  }

  activeArcada(): Locator {
    return this.arcadaGroup().locator('.pf-trat-clin-modal__chip--active');
  }

  treatmentSummaryValue(label: string): Locator {
    return this.dialog('tratamento')
      .locator('.pf-trat-clin-modal__info-row')
      .filter({ has: this.page.locator('.pf-trat-clin-modal__info-label', { hasText: new RegExp(`^${label}$`) }) })
      .locator('.pf-trat-clin-modal__info-value');
  }

  treatmentStatusPill(): Locator {
    return this.dialog('tratamento').locator('.pf-trat-clin-modal__status-pill');
  }

  treatmentVoiceSection(): Locator {
    return this.dialog('tratamento').getByRole('region', { name: 'Preencher tratamento por voz' });
  }

  async openNovoTratamento(): Promise<Locator> {
    const btn = this.page
      .locator('main, app-paciente-form-content')
      .first()
      .getByRole('button', { name: /Novo tratamento/i })
      .first();
    await expect(btn).toBeVisible({ timeout: 20_000 });
    await btn.click();
    const dialog = this.dialog('tratamento');
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByRole('heading', { name: 'Novo tratamento' })).toBeVisible();
    return dialog;
  }

  // ---------------------------------------------------------------- Finalizar

  evolucao(): Locator {
    return this.dialog('finalizar').locator('textarea#trat-fin-modal-obs');
  }

  finalizeHint(): Locator {
    return this.dialog('finalizar').locator('.pf-trat-fin-modal__ai-hint');
  }

  async openFinalizar(procedureName: string): Promise<Locator> {
    const row = this.page.locator('.pf-trat-tab__row').filter({ hasText: procedureName }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.getByRole('button', { name: /^Finalizar$/ }).click();
    const dialog = this.dialog('finalizar');
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    return dialog;
  }

  // ---------------------------------------------------------------- Ações comuns

  async startRecording(kind: AiVoiceModalKind): Promise<void> {
    const btn = this.recordButton(kind);
    await expect(btn).toBeEnabled();
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
  }

  async stopRecording(kind: AiVoiceModalKind): Promise<void> {
    const btn = this.recordButton(kind);
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
  }

  /** Grava pelo reconhecimento do navegador (fake) e para. */
  async dictate(kind: AiVoiceModalKind, ...utterances: string[]): Promise<void> {
    await this.startRecording(kind);
    for (const utterance of utterances) {
      await say(this.page, utterance);
    }
    await this.stopRecording(kind);
  }

  /** Toast do Assistente IA (summary "Assistente IA") por severidade. */
  voiceToast(severity: 'info' | 'warn' | 'error' | 'success', text?: string | RegExp): Locator {
    const toasts = this.page.locator(`.p-toast-message-${severity}`).filter({ hasText: 'Assistente IA' });
    return text ? toasts.filter({ hasText: text }) : toasts;
  }

  async expectVoiceToast(severity: 'info' | 'warn' | 'error' | 'success', text: string | RegExp, timeout = 10_000): Promise<void> {
    await expect(this.voiceToast(severity, text).first()).toBeVisible({ timeout });
  }

  /** Nenhum toast do Assistente IA (qualquer severidade). */
  async expectNoVoiceToast(): Promise<void> {
    await expect(this.page.locator('.p-toast-message').filter({ hasText: 'Assistente IA' })).toHaveCount(0);
  }

  async openEditarRegistro(text: string): Promise<Locator> {
    const item = this.page.locator('app-dc-timeline-item').filter({ hasText: text }).first();
    await expect(item).toBeVisible({ timeout: 20_000 });
    await item.getByRole('button', { name: 'Mais opções do registro' }).click();
    await this.page.getByRole('menuitem', { name: /^Editar$/ }).click();
    const dialog = this.dialog('registro');
    await expect(dialog.getByRole('heading', { name: 'Editar registro' })).toBeVisible({ timeout: 15_000 });
    return dialog;
  }

  async expectToolbarCredits(kind: AiVoiceModalKind, label: string | RegExp): Promise<void> {
    await expect(this.credits(kind)).toHaveText(label);
  }
}
