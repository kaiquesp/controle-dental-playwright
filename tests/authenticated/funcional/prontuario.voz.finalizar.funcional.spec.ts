import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/test.fixture';
import { AiVoicePage } from '../../pages/ai-voice.page';
import type { AppShellPage } from '../../pages/app-shell.page';
import type { ProntuarioPage } from '../../pages/prontuario.page';
import {
  AI_VOICE_OK,
  AiVoiceMock,
  createE2eClinicalTreatmentByApi,
  createGate,
  installFakeVoiceBrowser,
  say,
  voiceStats,
  type FakeVoiceBrowserOptions,
} from '../../support/ai-voice-mocks';
import { e2eName, readAccessToken } from '../../support/crud-helpers';
import { e2eEnv } from '../../support/env';
import { createE2ePatientByApi, deleteE2ePatient } from '../../support/pacientes-helpers';

/**
 * Assistente IA por Voz — modal Finalizar tratamento (campo "Descreva a evolução")
 * e regressão do salvar sem voz com a flag ligada.
 */

type Fixtures = { page: Page; appShell: AppShellPage; prontuarioPage: ProntuarioPage };

let patientId: string | null = null;
/** Tratamento usado pelos cenários que só abrem/cancelam o modal. */
const openTreatment = e2eName('Voz-Fin-Aberto');
/** Tratamento finalizado com texto ditado (persistência). */
const persistTreatment = e2eName('Voz-Fin-Persist');
/** Tratamento finalizado sem usar a voz (regressão). */
const regressionTreatment = e2eName('Voz-Fin-Regressao');

async function openTratamentos(
  { page, appShell, prontuarioPage }: Fixtures,
  browser: FakeVoiceBrowserOptions = {}
): Promise<{ mock: AiVoiceMock; voice: AiVoicePage }> {
  const mock = await new AiVoiceMock(page).install();
  await installFakeVoiceBrowser(page, browser);
  await prontuarioPage.goToTab(patientId!, 'tratamentos');
  await appShell.dismissBlockingModals();
  return { mock, voice: new AiVoicePage(page) };
}

async function readTreatmentByApi(page: Page, name: string): Promise<Record<string, unknown> | null> {
  const token = await readAccessToken(page);
  const response = await page.request.get(`${e2eEnv.apiUrl}/pacientes/${patientId}/tratamentos-clinicos`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await response.json().catch(() => [])) as unknown;
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const list = (Array.isArray(body) ? body : (record.tratamentos ?? record.tratamentos_clinicos ?? record.data ?? [])) as Record<string, unknown>[];
  return list.find((item) => String(item.nome_procedimento ?? item.procedimentos ?? item.procedimento ?? '') === name) ?? null;
}

test.describe('Prontuário — Assistente IA por Voz — Finalizar tratamento', () => {
  test.beforeAll(async ({ browser }) => {
    patientId = (await createE2ePatientByApi(browser, 'Voz-Fin')).id;
    for (const name of [openTreatment, persistTreatment, regressionTreatment]) {
      await createE2eClinicalTreatmentByApi(browser, patientId, name);
    }
  });

  test.afterAll(async ({ browser }) => {
    if (patientId) {
      await deleteE2ePatient(browser, patientId);
    }
  });

  test.describe('modo navegador', () => {
    let mock: AiVoiceMock;
    let voice: AiVoicePage;

    test.beforeEach(async ({ page, appShell, prontuarioPage }) => {
      test.skip(!patientId, 'Paciente E2E não criado');
      ({ mock, voice } = await openTratamentos({ page, appShell, prontuarioPage }));
    });

    test('[PAC-VOZ-003] barra no Finalizar: saldo, Gravar e Melhorar; sem Mãos livres, ajuda e alvo', async () => {
      await voice.openFinalizar(openTreatment);
      await expect(voice.toolbar('finalizar')).toBeVisible();
      await expect(voice.credits('finalizar')).toHaveText('10 créditos restantes');
      await expect(voice.recordButton('finalizar')).toHaveText(/^\s*Gravar\s*$/);
      await expect(voice.improveButton('finalizar')).toHaveText(/Melhorar via IA/);
      await expect(voice.improveButton('finalizar')).toBeEnabled();
      await expect(voice.handsFree('finalizar')).toHaveCount(0);
      await expect(voice.help('finalizar')).toHaveCount(0);
      await expect(voice.target('finalizar')).toHaveCount(0);
      expect(mock.callsTo('balance')).toHaveLength(1);
    });

    test('[PAC-VOZ-057] Finalizar sem fala reconhecida avisa e não mostra a dica de revisão', async () => {
      test.info().annotations.push({ type: 'fixed', description: 'R20 — treatment-completion-ai-voice.facade.ts:53-55 sem aviso de fala vazia' });
      await voice.openFinalizar(openTreatment);
      await voice.startRecording('finalizar');
      await voice.stopRecording('finalizar');
      await expect(voice.finalizeHint()).toBeHidden({ timeout: 3_000 });
      await voice.expectVoiceToast('warn', 'Nenhuma fala foi reconhecida. Tente novamente.', 3_000);
    });

    test('[PAC-VOZ-105] ditado grátis na evolução anexa com espaço e mostra a dica de revisão', async ({ page }) => {
      await voice.openFinalizar(openTreatment);
      await voice.evolucao().fill('Ok.');
      await voice.startRecording('finalizar');
      await say(page, 'sem', false);
      await expect(voice.dialog('finalizar').locator('.pf-trat-fin-modal__ai-interim')).toHaveText('sem');
      await say(page, 'sem dor');
      await expect(voice.evolucao()).toHaveValue('Ok. sem dor');
      await voice.stopRecording('finalizar');
      await expect(voice.finalizeHint()).toContainText('Revise o texto antes de salvar.');
      await expect(voice.dialog('finalizar').locator('.pf-trat-fin-modal__ai-interim')).toHaveCount(0);
      expect(mock.chargedCalls()).toHaveLength(0);
      await voice.undoButton('finalizar').click();
      await expect(voice.evolucao()).toHaveValue('Ok.');
      await expect(voice.undoButton('finalizar')).toHaveCount(0);
    });

    test('[PAC-VOZ-174] loading do Melhorar no Finalizar bloqueia Gravar/Desfazer e anuncia "Processando com IA"', async ({ page }) => {
      const gate = createGate();
      mock.reply('textImprove', { gate: gate.promise, json: AI_VOICE_OK.text('Evolução revisada.', 9) });
      await voice.openFinalizar(openTreatment);
      await voice.evolucao().fill('');
      await voice.startRecording('finalizar');
      await say(page, 'paciente sem dor');
      await voice.stopRecording('finalizar');
      await expect(voice.undoButton('finalizar')).toBeEnabled();
      await voice.improveButton('finalizar').click();
      await expect(voice.improveButton('finalizar')).toHaveText(/Processando…/);
      await expect(voice.improveButton('finalizar').locator('[role="status"]')).toBeAttached();
      await expect(voice.recordButton('finalizar')).toBeDisabled();
      await expect(voice.undoButton('finalizar')).toBeDisabled();
      await expect(voice.liveRegion('finalizar')).toHaveText('Processando com IA');
      gate.release();
      await expect(voice.evolucao()).toHaveValue('Evolução revisada.');
      await expect(voice.improveButton('finalizar')).toHaveText(/Melhorar via IA/);
      await expect(voice.recordButton('finalizar')).toBeEnabled();
      await expect(voice.liveRegion('finalizar')).toHaveText('');
      expect(mock.callsTo('textImprove')).toHaveLength(1);
    });

    test('[PAC-VOZ-175] resposta tardia do Melhorar não cai no Finalizar reaberto', async () => {
      const gate = createGate();
      mock.reply('textImprove', { gate: gate.promise, json: AI_VOICE_OK.text('TEXTO TARDIO DA IA', 9) });
      await voice.openFinalizar(openTreatment);
      await voice.evolucao().fill('evolução que será cancelada');
      await voice.improveButton('finalizar').click();
      await expect(voice.improveButton('finalizar')).toHaveText(/Processando…/);
      await voice.cancelButton('finalizar').click();
      await expect(voice.dialog('finalizar')).toBeHidden();
      await voice.openFinalizar(openTreatment);
      const reopened = await voice.evolucao().inputValue();
      gate.release();
      await expect.poll(() => mock.callsTo('textImprove').length).toBe(1);
      await expect(voice.improveButton('finalizar')).toHaveText(/Melhorar via IA/);
      await expect(voice.evolucao()).toHaveValue(reopened);
      await expect(voice.evolucao()).not.toHaveValue(/TEXTO TARDIO/);
    });

    test('[PAC-VOZ-177] HTML devolvido pela IA no Finalizar aparece literal e não executa', async ({ page }) => {
      let dialogOpened = false;
      page.on('dialog', async (d) => {
        dialogOpened = true;
        await d.dismiss();
      });
      const payload = '<img src=x onerror="window.__xss=7">evolução';
      mock.reply('textImprove', { json: AI_VOICE_OK.text(payload, 9) }, { status: 500, json: { erro: '<img src=x onerror="window.__xss=8">Falhou' } });
      await voice.openFinalizar(openTreatment);
      await voice.evolucao().fill('texto');
      await voice.improveButton('finalizar').click();
      await expect(voice.evolucao()).toHaveValue(payload);
      await voice.improveButton('finalizar').click();
      await expect(voice.voiceToast('error').first()).toBeVisible();
      await expect(page.locator('.p-toast img[src="x"], .p-dialog img[src="x"]')).toHaveCount(0);
      expect(await page.evaluate(() => window.__xss)).toBeUndefined();
      expect(dialogOpened).toBe(false);
    });

    test('[PAC-VOZ-137] Finalizar: 500 no Melhorar mostra erro, mantém a evolução e o saldo', async () => {
      mock.reply('textImprove', { status: 500, json: {} });
      await voice.openFinalizar(openTreatment);
      await voice.evolucao().fill('evolução que deve ficar');
      await voice.improveButton('finalizar').click();
      await voice.expectVoiceToast('error', 'Não foi possível melhorar o texto.');
      await expect(voice.evolucao()).toHaveValue('evolução que deve ficar');
      await expect(voice.undoButton('finalizar')).toHaveCount(0);
      await expect(voice.credits('finalizar')).toHaveText('10 créditos restantes');
      await expect(voice.dialog('finalizar')).toBeVisible();
    });

    test('[PAC-VOZ-106] "salvar" vira texto no Finalizar (não confirma o modal)', async ({ page }) => {
      await voice.openFinalizar(openTreatment);
      await voice.evolucao().fill('');
      await voice.startRecording('finalizar');
      await say(page, 'paciente liberado salvar');
      await expect(voice.recordButton('finalizar')).toHaveAttribute('aria-pressed', 'true');
      await voice.stopRecording('finalizar');
      await expect(voice.evolucao()).toHaveValue('paciente liberado salvar');
      await expect(voice.dialog('finalizar')).toBeVisible();
    });

    test('[PAC-VOZ-107] Melhorar via IA substitui a evolução e Desfazer restaura', async () => {
      mock.reply('textImprove', { json: AI_VOICE_OK.text('Paciente sem dor, evolução satisfatória.', 9) });
      await voice.openFinalizar(openTreatment);
      await voice.evolucao().fill('paciente sem dor');
      await voice.improveButton('finalizar').click();
      await expect(voice.evolucao()).toHaveValue('Paciente sem dor, evolução satisfatória.');
      expect(mock.lastBody('textImprove')).toEqual({ contexto: 'treatment_completion', texto: 'paciente sem dor' });
      await expect(voice.credits('finalizar')).toHaveText('9 créditos restantes');
      await voice.undoButton('finalizar').click();
      await expect(voice.evolucao()).toHaveValue('paciente sem dor');
    });

    test('[PAC-VOZ-109] Melhorar devolvendo texto vazio não apaga a evolução', async () => {
      test.info().annotations.push({ type: 'fixed', description: 'R19 — treatment-completion-ai-voice.facade.ts:20-33 apaga a evolução quando a IA devolve ""' });
      mock.reply('textImprove', { json: AI_VOICE_OK.text('', 9) });
      await voice.openFinalizar(openTreatment);
      await voice.evolucao().fill('texto original da evolução');
      await voice.improveButton('finalizar').click();
      await expect(voice.credits('finalizar')).toHaveText('9 créditos restantes');
      await expect(voice.evolucao()).toHaveValue('texto original da evolução', { timeout: 3_000 });
    });

    test('[PAC-VOZ-110] finalizar com texto ditado persiste status e evolução', async ({ page, prontuarioPage }) => {
      const spoken = `evolução ditada sem intercorrências ${Date.now()}`;
      await voice.openFinalizar(persistTreatment);
      await voice.evolucao().fill('');
      await voice.dictate('finalizar', spoken);
      await expect(voice.evolucao()).toHaveValue(spoken);
      await voice.dialog('finalizar').getByRole('button', { name: /Finalizar tratamento/ }).click();
      await expect(voice.dialog('finalizar')).toBeHidden({ timeout: 20_000 });
      await prontuarioPage.goToTab(patientId!, 'tratamentos');
      const row = page.locator('.pf-trat-tab__row').filter({ hasText: persistTreatment }).first();
      await expect(row).toBeVisible({ timeout: 20_000 });
      await expect(row.getByRole('button', { name: /^Finalizar$/ })).toHaveCount(0);
      await expect.poll(async () => String((await readTreatmentByApi(page, persistTreatment))?.obs ?? '')).toContain(spoken);
    });
  });

  test.describe('modo IA (navegador sem reconhecimento de voz)', () => {
    test('[PAC-VOZ-108] gravação paga envia contexto treatment_completion e anexa com quebra de linha', async ({ page, appShell, prontuarioPage }) => {
      test.skip(!patientId, 'Paciente E2E não criado');
      const { mock, voice } = await openTratamentos({ page, appShell, prontuarioPage }, { speech: 'none' });
      mock.reply('textRecord', { json: AI_VOICE_OK.text('Evolução organizada pela IA.', 9) });
      await voice.openFinalizar(openTreatment);
      await expect(voice.recordButton('finalizar')).toHaveText(/Gravar\s*· 1 crédito/);
      await voice.evolucao().fill('Base');
      await voice.startRecording('finalizar');
      await voice.stopRecording('finalizar');
      const body = await mock.waitForCall('textRecord');
      expect(body.contexto).toBe('treatment_completion');
      expect(String(body.audio_base64)).toMatch(/^[A-Za-z0-9+/]+=*$/);
      expect(String(body.mime_type)).toMatch(/^audio\/webm/);
      expect(Number.isInteger(body.duracao_segundos)).toBe(true);
      await expect(voice.evolucao()).toHaveValue('Base\nEvolução organizada pela IA.');
      await expect(voice.credits('finalizar')).toHaveText('9 créditos restantes');
      await voice.undoButton('finalizar').click();
      await expect(voice.evolucao()).toHaveValue('Base');
    });

    test('[PAC-VOZ-138] Finalizar: 500 na gravação paga mostra "Não foi possível transcrever a gravação."', async ({ page, appShell, prontuarioPage }) => {
      test.skip(!patientId, 'Paciente E2E não criado');
      const { mock, voice } = await openTratamentos({ page, appShell, prontuarioPage }, { speech: 'none' });
      mock.reply('textRecord', { status: 500, json: {} });
      await voice.openFinalizar(openTreatment);
      await voice.evolucao().fill('Base');
      await voice.startRecording('finalizar');
      await voice.stopRecording('finalizar');
      await voice.expectVoiceToast('error', 'Não foi possível transcrever a gravação.');
      expect(mock.callsTo('textRecord')).toHaveLength(1);
      await expect(voice.evolucao()).toHaveValue('Base');
      await expect(voice.undoButton('finalizar')).toHaveCount(0);
      await expect(voice.credits('finalizar')).toHaveText('10 créditos restantes');
    });

    test('[PAC-VOZ-124] Finalizar: cancelar durante a gravação paga libera o microfone sem enviar', async ({ page, appShell, prontuarioPage }) => {
      test.skip(!patientId, 'Paciente E2E não criado');
      const { mock, voice } = await openTratamentos({ page, appShell, prontuarioPage }, { speech: 'none' });
      await voice.openFinalizar(openTreatment);
      await voice.startRecording('finalizar');
      await expect.poll(() => voiceStats(page).then((s) => s.liveTracks)).toBe(1);
      await voice.cancelButton('finalizar').click();
      await expect(voice.dialog('finalizar')).toBeHidden();
      await expect.poll(() => voiceStats(page).then((s) => s.liveTracks)).toBe(0);
      const balanceCalls = mock.callsTo('balance').length;
      await voice.openFinalizar(openTreatment);
      await expect.poll(() => mock.callsTo('balance').length).toBe(balanceCalls + 1);
      await expect(voice.recordButton('finalizar')).toHaveAttribute('aria-pressed', 'false');
      expect(mock.chargedCalls()).toHaveLength(0);
    });
  });

  test.describe('regressão sem voz', () => {
    test('[PAC-VOZ-136] com a flag ligada e sem usar voz, registro (criar/editar), tratamento e finalização funcionam e só /balance é chamado', async ({ page, appShell, prontuarioPage }) => {
      test.skip(!patientId, 'Paciente E2E não criado');
      test.setTimeout(120_000);
      const { mock, voice } = await openTratamentos({ page, appShell, prontuarioPage });
      await voice.openFinalizar(regressionTreatment);
      await voice.evolucao().fill('Finalizado sem usar voz.');
      await voice.dialog('finalizar').getByRole('button', { name: /Finalizar tratamento/ }).click();
      await expect(voice.dialog('finalizar')).toBeHidden({ timeout: 20_000 });
      await expect(
        page.locator('.pf-trat-tab__row').filter({ hasText: regressionTreatment }).first().getByRole('button', { name: /^Finalizar$/ })
      ).toHaveCount(0, { timeout: 20_000 });

      await prontuarioPage.goToTab(patientId!, 'plano-ficha');
      await appShell.dismissBlockingModals();
      const text = `Registro sem voz ${Date.now()}`;
      await voice.openNovoRegistro();
      await voice.realizado().fill(text);
      await voice.recordSaveButton().click();
      await expect(page.locator('.p-toast-message-success').filter({ hasText: 'Registro adicionado.' }).first()).toBeVisible();
      await expect(voice.dialog('registro')).toBeHidden();

      await voice.openEditarRegistro(text);
      await expect(voice.toolbar('registro')).toBeVisible();
      await voice.realizado().fill(`${text} editado`);
      await voice.recordSaveButton().click();
      await expect(page.locator('.p-toast-message-success').filter({ hasText: 'Registro atualizado.' }).first()).toBeVisible();
      await expect(page.locator('app-dc-timeline-item').filter({ hasText: `${text} editado` }).first()).toBeVisible({ timeout: 20_000 });

      await prontuarioPage.goToTab(patientId!, 'tratamentos');
      await appShell.dismissBlockingModals();
      const procedure = await prontuarioPage.createTratamentoBasico(e2eName('Voz-Regressao'));
      await expect(prontuarioPage.tratamentoRow(procedure).first()).toBeVisible();

      expect(mock.chargedCalls()).toHaveLength(0);
      expect(mock.callsTo('balance').length).toBeGreaterThanOrEqual(4);
    });
  });
});
