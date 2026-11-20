import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/test.fixture';
import { AiVoicePage } from '../../pages/ai-voice.page';
import type { AppShellPage } from '../../pages/app-shell.page';
import type { ProntuarioPage } from '../../pages/prontuario.page';
import {
  AI_VOICE_ERROR_BODIES,
  AI_VOICE_OK,
  AiVoiceMock,
  brDate,
  createE2eClinicalRecordByApi,
  createGate,
  installFakeVoiceBrowser,
  isoDate,
  listClinicalRecordTextsByApi,
  mockProfessionals,
  say,
  unlockProfessionalField,
  type FakeVoiceBrowserOptions,
} from '../../support/ai-voice-mocks';
import { e2eName } from '../../support/crud-helpers';
import { createE2ePatientByApi, deleteE2ePatient } from '../../support/pacientes-helpers';

/**
 * Assistente IA por Voz — modal Novo/Editar registro (aba Plano e Ficha Clínica).
 * IA 100% mockada (`AiVoiceMock`); microfone e reconhecimento de voz fakes (`installFakeVoiceBrowser`).
 * Catálogo consolidado: qa-voice-catalog-final.md (PAC-VOZ-NNN).
 */

type Fixtures = { page: Page; appShell: AppShellPage; prontuarioPage: ProntuarioPage };

let patientId: string | null = null;
const editableRecordText = e2eName('Voz-Registro-Edit');

async function openPlanoFicha(
  { page, appShell, prontuarioPage }: Fixtures,
  browser: FakeVoiceBrowserOptions = {}
): Promise<{ mock: AiVoiceMock; voice: AiVoicePage }> {
  const mock = await new AiVoiceMock(page).install();
  await installFakeVoiceBrowser(page, browser);
  await prontuarioPage.goToTab(patientId!, 'plano-ficha');
  await appShell.dismissBlockingModals();
  return { mock, voice: new AiVoicePage(page) };
}

test.describe('Prontuário — Assistente IA por Voz — Ficha clínica', () => {
  test.beforeAll(async ({ browser }) => {
    patientId = (await createE2ePatientByApi(browser, 'Voz-Ficha')).id;
    await createE2eClinicalRecordByApi(browser, patientId, editableRecordText);
  });

  test.afterAll(async ({ browser }) => {
    if (patientId) {
      await deleteE2ePatient(browser, patientId);
    }
  });

  test.describe('modo navegador (ditado grátis)', () => {
    let mock: AiVoiceMock;
    let voice: AiVoicePage;

    test.beforeEach(async ({ page, appShell, prontuarioPage }) => {
      test.skip(!patientId, 'Paciente E2E não criado');
      ({ mock, voice } = await openPlanoFicha({ page, appShell, prontuarioPage }));
    });

    test('[PAC-VOZ-001] barra visível no Novo registro com a flag ligada', async () => {
      await voice.openNovoRegistro();
      const toolbar = voice.toolbar('registro');
      await expect(toolbar).toBeVisible();
      await expect(toolbar.getByText('Assistente IA por Voz')).toBeVisible();
      await expect(voice.help('registro')).toBeVisible();
      await expect(voice.credits('registro')).toHaveText('10 créditos restantes');
      await expect(voice.target()).toHaveText(/em\s+O que foi feito/);
      await expect(voice.handsFree('registro')).toHaveText(/Mãos livres/);
      await expect(voice.recordButton('registro')).toHaveText(/Preencher por voz/);
      await expect(voice.recordButton('registro')).toBeEnabled();
      await expect(voice.improveButton('registro')).toHaveText(/Melhorar via IA/);
      await expect(voice.improveButton('registro')).toBeDisabled();
      expect(mock.callsTo('balance')).toHaveLength(1);
      expect(mock.chargedCalls()).toHaveLength(0);
    });

    test('[PAC-VOZ-012] barra presente no modal Editar registro', async () => {
      await voice.openEditarRegistro(editableRecordText);
      await expect(voice.toolbar('registro')).toBeVisible();
      await expect(voice.target()).toHaveText(/em\s+O que foi feito/);
      await expect(voice.recordSaveButton()).toHaveText('Salvar alterações');
      await expect(voice.improveButton('registro')).toBeEnabled();
    });

    test('[PAC-VOZ-018] saldo atualizado com o retorno da ação paga, sem novo GET', async () => {
      mock.reply('clinicalImprove', { json: AI_VOICE_OK.clinicalImprove('Profilaxia realizada.', '', 9) });
      await voice.openNovoRegistro();
      await voice.realizado().fill('fiz profilaxia');
      await voice.improveButton('registro').click();
      await expect(voice.credits('registro')).toHaveText('9 créditos restantes');
      expect(mock.callsTo('balance')).toHaveLength(1);
    });

    test('[PAC-VOZ-031] ditado grátis pelo navegador preenche o campo sem chamar a IA', async () => {
      await voice.openNovoRegistro();
      await voice.dictate('registro', 'profilaxia e raspagem');
      await expect(voice.realizado()).toHaveValue('Profilaxia e raspagem');
      await expect(voice.credits('registro')).toHaveText('10 créditos restantes');
      await expect(voice.undoButton('registro')).toBeVisible();
      expect(mock.chargedCalls()).toHaveLength(0);
    });

    test('[PAC-VOZ-047] texto ao vivo mostra o parcial e o final substitui sem duplicar', async ({ page }) => {
      await voice.openNovoRegistro();
      await voice.startRecording('registro');
      await say(page, 'profilaxia e', false);
      await expect(voice.recordLiveText().locator('.pf-clinical-record-modal__ai-interim')).toHaveText('profilaxia e');
      await expect(voice.realizado()).toHaveValue('Profilaxia e');
      await say(page, 'profilaxia e raspagem', true);
      await expect(voice.realizado()).toHaveValue('Profilaxia e raspagem');
      await expect(voice.recordLiveText()).toContainText('profilaxia e raspagem');
      await voice.stopRecording('registro');
      await expect(voice.recordLiveText()).toBeHidden();
      await expect(voice.realizado()).toHaveValue('Profilaxia e raspagem');
    });

    test('[PAC-VOZ-056] gravação sem fala reconhecida avisa e não cobra', async () => {
      await voice.openNovoRegistro();
      await voice.startRecording('registro');
      await voice.stopRecording('registro');
      await voice.expectVoiceToast('warn', 'Nenhuma fala foi reconhecida. Tente novamente.');
      await expect(voice.realizado()).toHaveValue('');
      expect(mock.chargedCalls()).toHaveLength(0);
    });

    test('[PAC-VOZ-058] comando "parar" isolado encerra; "pediu para parar" é conteúdo', async ({ page }) => {
      await voice.openNovoRegistro();
      await voice.startRecording('registro');
      await say(page, 'pare a gravação');
      await expect(voice.recordButton('registro')).toHaveAttribute('aria-pressed', 'false');
      await expect(voice.realizado()).toHaveValue('');

      await voice.startRecording('registro');
      await say(page, 'o paciente pediu para parar');
      await expect(voice.recordButton('registro')).toHaveAttribute('aria-pressed', 'true');
      await expect(voice.realizado()).toHaveValue('O paciente pediu para parar');
      await voice.stopRecording('registro');
    });

    test('[PAC-VOZ-059] alvo padrão é "O que foi feito"', async () => {
      await voice.openNovoRegistro();
      await expect(voice.target()).toHaveText(/em\s+O que foi feito/);
    });

    test('[PAC-VOZ-060] foco alterna o campo alvo', async () => {
      await voice.openNovoRegistro();
      await voice.plano().focus();
      await expect(voice.target()).toHaveText(/em\s+Plano \/ próxima consulta/);
      await voice.realizado().focus();
      await expect(voice.target()).toHaveText(/em\s+O que foi feito/);
    });

    test('[PAC-VOZ-061] alvo fica travado durante a gravação', async ({ page }) => {
      await voice.openNovoRegistro();
      await voice.plano().focus();
      await voice.startRecording('registro');
      await voice.realizado().focus();
      await expect(voice.target()).toHaveText(/em\s+Plano \/ próxima consulta/);
      await say(page, 'orientar higiene noturna');
      await expect(voice.plano()).toHaveValue('Orientar higiene noturna');
      await expect(voice.realizado()).toHaveValue('');
      await voice.stopRecording('registro');
      await voice.realizado().focus();
      await expect(voice.target()).toHaveText(/em\s+O que foi feito/);
    });

    test('[PAC-VOZ-062] alvo volta para "O que foi feito" ao reabrir', async () => {
      await voice.openNovoRegistro();
      await voice.plano().focus();
      await expect(voice.target()).toHaveText(/Plano/);
      await voice.cancelButton('registro').click();
      await expect(voice.dialog('registro')).toBeHidden();
      await voice.openNovoRegistro();
      await expect(voice.target()).toHaveText(/em\s+O que foi feito/);
    });

    test('[PAC-VOZ-063] ditado anexa ao texto existente com quebra de linha', async () => {
      await voice.openNovoRegistro();
      await voice.realizado().fill('Anestesia.');
      await voice.dictate('registro', 'profilaxia e raspagem');
      await expect(voice.realizado()).toHaveValue('Anestesia.\nProfilaxia e raspagem');
    });

    test('[PAC-VOZ-064] posição do cursor é ignorada: texto ditado vai ao final', async () => {
      await voice.openNovoRegistro();
      await voice.realizado().fill('Primeira linha');
      await voice.realizado().evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(3, 3));
      await voice.dictate('registro', 'nova frase');
      await expect(voice.realizado()).toHaveValue('Primeira linha\nNova frase');
    });

    test('[PAC-VOZ-065] rótulos falados distribuem os campos', async () => {
      await voice.openNovoRegistro();
      await voice.dictate('registro', 'o que foi feito profilaxia, próxima consulta retorno em 6 meses');
      await expect(voice.realizado()).toHaveValue('Profilaxia');
      await expect(voice.plano()).toHaveValue('Retorno em 6 meses');
    });

    test('[PAC-VOZ-066] "limpe o campo" e "apague a última frase" corrigem só o campo citado', async () => {
      await voice.openNovoRegistro();
      await voice.realizado().fill('Texto antigo');
      await voice.plano().fill('Plano antigo');
      await voice.realizado().focus();
      await voice.dictate('registro', 'limpe o campo o que foi feito', 'restauração', 'nova frase', 'apague a última frase');
      await expect(voice.realizado()).toHaveValue('Restauração');
      await expect(voice.plano()).toHaveValue('Plano antigo');
    });

    test('[PAC-VOZ-067] data por voz; data inválida mantém a anterior', async ({ page }) => {
      await voice.openNovoRegistro();
      await expect(voice.recordDate()).toHaveValue(brDate(isoDate(0)));
      await voice.startRecording('registro');
      await say(page, 'data ontem');
      await expect(voice.recordDate()).toHaveValue(brDate(isoDate(-1)));
      await say(page, 'data 31/02');
      await voice.stopRecording('registro');
      await expect(voice.recordDate()).toHaveValue(brDate(isoDate(-1)));
      await expect(voice.realizado()).toHaveValue('');

      const [year, month] = isoDate(0).split('-');
      await voice.startRecording('registro');
      await say(page, 'data dia 5');
      await expect(voice.recordDate()).toHaveValue(`05/${month}/${year}`);
      await say(page, 'data 10/03');
      await expect(voice.recordDate()).toHaveValue(`10/03/${year}`);
      await voice.stopRecording('registro');
      await expect(voice.realizado()).toHaveValue('');
      await expect(voice.plano()).toHaveValue('');
    });

    test('[PAC-VOZ-069] comando "salvar" grava o registro e fecha o modal', async ({ page }) => {
      const text = `Profilaxia completa ${Date.now()}`;
      await voice.openNovoRegistro();
      await voice.startRecording('registro');
      await say(page, `${text.toLowerCase()} salvar`);
      await expect(voice.dialog('registro')).toBeHidden({ timeout: 20_000 });
      await expect(page.locator('.p-toast-message-success').filter({ hasText: 'Registro adicionado.' }).first()).toBeVisible();
      await expect.poll(() => listClinicalRecordTextsByApi(page, patientId!)).toContain(text);
      expect(mock.chargedCalls()).toHaveLength(0);
    });

    test('[PAC-VOZ-070] "salvar" com "O que foi feito" vazio mostra erro no campo', async ({ page }) => {
      await voice.openNovoRegistro();
      await voice.plano().focus();
      await voice.startRecording('registro');
      await say(page, 'retorno em 1 mês salvar');
      await expect(voice.recordButton('registro')).toHaveAttribute('aria-pressed', 'false');
      await expect(voice.dialog('registro')).toBeVisible();
      await expect(voice.dialog('registro').locator('.invalid-feedback')).toHaveText('Informe o que foi feito na consulta.');
      await expect(page.locator('.p-toast-message-success')).toHaveCount(0);
    });

    test('[PAC-VOZ-071] digitação durante o ditado é preservada', async ({ page }) => {
      test.info().annotations.push({ type: 'fixed', description: 'R16 — clinical-record-ai-voice.facade.ts:175-194 sobrescreve a digitação feita durante o ditado' });
      await voice.openNovoRegistro();
      await voice.startRecording('registro');
      await say(page, 'primeira parte');
      await voice.plano().fill('digitado à mão');
      await say(page, 'segunda parte');
      await expect(voice.plano()).toHaveValue('digitado à mão', { timeout: 3_000 });
    });

    test('[PAC-VOZ-072] palavras de rótulo no meio da frase não desviam o conteúdo', async () => {
      test.info().annotations.push({ type: 'fixed', description: 'R17 — clinical-record-dictation.parser.ts:35-43 manda "oclusal" para o Plano' });
      await voice.openNovoRegistro();
      await voice.dictate('registro', 'restauração classe dois no plano oclusal');
      await expect(voice.realizado()).toHaveValue('Restauração classe dois no plano oclusal', { timeout: 3_000 });
      await expect(voice.plano()).toHaveValue('', { timeout: 3_000 });
    });

    test('[PAC-VOZ-073] frase iniciando com "dentista" não é descartada', async () => {
      test.info().annotations.push({ type: 'fixed', description: 'R18 — clinical-record-dictation.parser.ts:124-131 descarta "dentista orientou higiene"' });
      await voice.openNovoRegistro();
      await voice.dictate('registro', 'dentista orientou higiene');
      await expect(voice.realizado()).toHaveValue(/orientou higiene/i, { timeout: 3_000 });
    });

    test('[PAC-VOZ-075] Melhorar desabilitado com o campo alvo vazio', async () => {
      await voice.openNovoRegistro();
      await voice.plano().fill('Retorno em 30 dias');
      await voice.realizado().focus();
      await expect(voice.improveButton('registro')).toBeDisabled();
      await voice.plano().focus();
      await expect(voice.improveButton('registro')).toBeEnabled();
    });

    test('[PAC-VOZ-076] Melhorar habilita ao digitar e desabilita com vazio ou espaços', async () => {
      await voice.openNovoRegistro();
      await voice.realizado().fill('abc');
      await expect(voice.improveButton('registro')).toBeEnabled();
      await voice.realizado().fill('');
      await expect(voice.improveButton('registro')).toBeDisabled();
      await voice.realizado().fill('   ');
      await expect(voice.improveButton('registro')).toBeDisabled();
    });

    test('[PAC-VOZ-077] loading do Melhorar bloqueia ações e anuncia "Processando com IA"', async () => {
      const gate = createGate();
      mock.reply('clinicalImprove', { gate: gate.promise, json: AI_VOICE_OK.clinicalImprove('Texto revisado.') });
      await voice.openNovoRegistro();
      await voice.dictate('registro', 'texto base');
      await expect(voice.undoButton('registro')).toBeEnabled();
      await voice.improveButton('registro').click();
      await expect(voice.improveButton('registro')).toHaveText(/Processando…/);
      await expect(voice.improveButton('registro').locator('[role="status"]')).toBeAttached();
      await expect(voice.recordButton('registro')).toBeDisabled();
      await expect(voice.undoButton('registro')).toBeDisabled();
      await expect(voice.liveRegion('registro')).toHaveText('Processando com IA');
      gate.release();
      await expect(voice.improveButton('registro')).toHaveText(/Melhorar via IA/);
      await expect(voice.recordButton('registro')).toBeEnabled();
      await expect(voice.liveRegion('registro')).toHaveText('');
    });

    test('[PAC-VOZ-078] Melhorar "O que foi feito" envia os dois campos e substitui só o alvo', async () => {
      mock.reply('clinicalImprove', { json: AI_VOICE_OK.clinicalImprove('Profilaxia realizada com sucesso.', 'voltar', 9) });
      await voice.openNovoRegistro();
      await voice.realizado().fill('fiz limpeza');
      await voice.plano().fill('voltar');
      await voice.realizado().focus();
      await voice.improveButton('registro').click();
      await expect(voice.realizado()).toHaveValue('Profilaxia realizada com sucesso.');
      expect(mock.lastBody('clinicalImprove')).toEqual({ realizado: 'fiz limpeza', plano_proxima_consulta: 'voltar', campo: 'realizado' });
      await expect(voice.plano()).toHaveValue('voltar');
      await expect(voice.credits('registro')).toHaveText('9 créditos restantes');
      await expect(voice.undoButton('registro')).toBeVisible();
    });

    test('[PAC-VOZ-079] Melhorar o Plano (campo focado) muda só o plano', async () => {
      mock.reply('clinicalImprove', { json: AI_VOICE_OK.clinicalImprove('', 'Retorno em 30 dias para revisão.', 9) });
      await voice.openNovoRegistro();
      await voice.realizado().fill('profilaxia');
      await voice.plano().fill('voltar em um mes');
      await voice.plano().focus();
      await voice.improveButton('registro').click();
      await expect(voice.plano()).toHaveValue('Retorno em 30 dias para revisão.');
      expect(mock.lastBody('clinicalImprove')).toEqual({
        realizado: 'profilaxia',
        plano_proxima_consulta: 'voltar em um mes',
        campo: 'plano_proxima_consulta',
      });
      await expect(voice.realizado()).toHaveValue('profilaxia');
    });

    test('[PAC-VOZ-080] IA devolvendo campo vazio mantém o texto atual', async () => {
      mock.reply('clinicalImprove', { json: AI_VOICE_OK.clinicalImprove('', '', 9) });
      await voice.openNovoRegistro();
      await voice.realizado().fill('texto original');
      await voice.improveButton('registro').click();
      await expect(voice.credits('registro')).toHaveText('9 créditos restantes');
      await expect(voice.realizado()).toHaveValue('texto original');
    });

    test('[PAC-VOZ-081] Desfazer após Melhorar restaura o texto e some', async () => {
      mock.reply('clinicalImprove', { json: AI_VOICE_OK.clinicalImprove('Texto melhorado.', '', 9) });
      await voice.openNovoRegistro();
      await voice.realizado().fill('texto cru');
      await voice.improveButton('registro').click();
      await expect(voice.realizado()).toHaveValue('Texto melhorado.');
      await voice.undoButton('registro').click();
      await expect(voice.realizado()).toHaveValue('texto cru');
      await expect(voice.recordDate()).toHaveValue(brDate(isoDate(0)));
      await expect(voice.undoButton('registro')).toHaveCount(0);
    });

    test('[PAC-VOZ-082] Desfazer após ditado volta ao estado anterior (texto, plano e data)', async () => {
      await voice.openNovoRegistro();
      await voice.realizado().fill('Base');
      await voice.dictate('registro', 'nova frase ditada', 'data ontem', 'próxima consulta retorno em 7 dias');
      await expect(voice.realizado()).toHaveValue('Base\nNova frase ditada');
      await expect(voice.plano()).toHaveValue('Retorno em 7 dias');
      await expect(voice.recordDate()).toHaveValue(brDate(isoDate(-1)));
      await voice.undoButton('registro').click();
      await expect(voice.realizado()).toHaveValue('Base');
      await expect(voice.plano()).toHaveValue('');
      await expect(voice.recordDate()).toHaveValue(brDate(isoDate(0)));
      await expect(voice.undoButton('registro')).toHaveCount(0);
    });

    test('[PAC-VOZ-083] Desfazer tem um nível só', async () => {
      mock.reply(
        'clinicalImprove',
        { json: AI_VOICE_OK.clinicalImprove('Versão 1.', '', 9) },
        { json: AI_VOICE_OK.clinicalImprove('Versão 2.', '', 8) }
      );
      await voice.openNovoRegistro();
      await voice.realizado().fill('original');
      await voice.improveButton('registro').click();
      await expect(voice.realizado()).toHaveValue('Versão 1.');
      await voice.improveButton('registro').click();
      await expect(voice.realizado()).toHaveValue('Versão 2.');
      await voice.undoButton('registro').click();
      await expect(voice.realizado()).toHaveValue('Versão 1.');
      await expect(voice.undoButton('registro')).toHaveCount(0);
    });

    test('[PAC-VOZ-084] texto acima de 8000 caracteres: erro da API sem alterar o texto', async () => {
      mock.reply('clinicalImprove', { status: 400, json: AI_VOICE_ERROR_BODIES.textTooLong });
      const longText = 'a'.repeat(8_100);
      await voice.openNovoRegistro();
      await voice.realizado().fill(longText);
      await voice.improveButton('registro').click();
      await voice.expectVoiceToast('error', /Texto muito longo/);
      await expect(voice.realizado()).toHaveValue(longText);
      await expect(voice.credits('registro')).toHaveText('10 créditos restantes');
      await expect(voice.undoButton('registro')).toHaveCount(0);
    });

    test('[PAC-VOZ-085] Desfazer some ao fechar e reabrir o modal', async () => {
      await voice.openNovoRegistro();
      await voice.dictate('registro', 'frase qualquer');
      await expect(voice.undoButton('registro')).toBeVisible();
      await voice.cancelButton('registro').click();
      await expect(voice.dialog('registro')).toBeHidden();
      await voice.openNovoRegistro();
      await expect(voice.undoButton('registro')).toHaveCount(0);
    });

    test('[PAC-VOZ-086] edição feita durante o Melhorar é preservada', async () => {
      test.info().annotations.push({ type: 'fixed', description: 'R15 — clinical-record-ai-voice.facade.ts:83-97 sobrescreve o que foi digitado durante o processamento' });
      const gate = createGate();
      mock.reply('clinicalImprove', { gate: gate.promise, json: AI_VOICE_OK.clinicalImprove('Texto revisado.', '', 9) });
      await voice.openNovoRegistro();
      await voice.realizado().fill('texto cru');
      await voice.improveButton('registro').click();
      await expect(voice.improveButton('registro')).toHaveText(/Processando…/);
      await voice.plano().fill('editado durante o processamento');
      gate.release();
      await expect(voice.realizado()).toHaveValue('Texto revisado.');
      await expect(voice.plano()).toHaveValue('editado durante o processamento', { timeout: 3_000 });
    });

    test('[PAC-VOZ-126] resposta tardia da IA não cai no formulário reaberto', async () => {
      test.info().annotations.push({ type: 'fixed', description: 'R2 — ai-voice-assistant.base.ts:232-246 (runCharged) aplica a resposta no form reaberto' });
      const gate = createGate();
      mock.reply('clinicalImprove', { gate: gate.promise, json: AI_VOICE_OK.clinicalImprove('TEXTO TARDIO DA IA', '', 9) });
      await voice.openNovoRegistro();
      await voice.realizado().fill('registro que será cancelado');
      await voice.improveButton('registro').click();
      await expect(voice.improveButton('registro')).toHaveText(/Processando…/);
      await voice.cancelButton('registro').click();
      await expect(voice.dialog('registro')).toBeHidden();
      await voice.openNovoRegistro();
      gate.release();
      await expect.poll(() => mock.callsTo('clinicalImprove').length).toBe(1);
      await voice.page.waitForTimeout(1_000);
      await expect(voice.realizado()).toHaveValue('', { timeout: 3_000 });
    });

    test('[PAC-VOZ-128] salvar pelo botão durante a gravação salva o conteúdo atual', async ({ page }) => {
      const text = `Salvo durante gravação ${Date.now()}`;
      await voice.openNovoRegistro();
      await voice.realizado().fill(text);
      await voice.startRecording('registro');
      await voice.recordSaveButton().click();
      await expect(voice.dialog('registro')).toBeHidden({ timeout: 20_000 });
      await expect(page.locator('.p-toast-message-success').filter({ hasText: 'Registro adicionado.' }).first()).toBeVisible();
      await expect(voice.voiceToast('error')).toHaveCount(0);
      expect(await page.evaluate(() => window.__voice.current)).toBeNull();
      await expect.poll(() => listClinicalRecordTextsByApi(page, patientId!)).toContain(text);
    });

    test('[PAC-VOZ-130] Salvar fica desabilitado durante o processamento da IA', async () => {
      test.info().annotations.push({ type: 'fixed', description: 'R5 — paciente-clinical-record-modal.component.html:141-153 permite salvar sem o resultado já cobrado' });
      const gate = createGate();
      mock.reply('clinicalImprove', { gate: gate.promise, json: AI_VOICE_OK.clinicalImprove('Texto revisado.', '', 9) });
      await voice.openNovoRegistro();
      await voice.realizado().fill('texto cru');
      await voice.improveButton('registro').click();
      await expect(voice.improveButton('registro')).toHaveText(/Processando…/);
      try {
        await expect(voice.recordSaveButton()).toBeDisabled({ timeout: 3_000 });
      } finally {
        gate.release();
      }
    });

    test('[PAC-VOZ-132] registro ditado persiste após salvar e recarregar', async ({ page, prontuarioPage }) => {
      const marker = `${Date.now()}`;
      await voice.openNovoRegistro();
      await voice.dictate('registro', `o que foi feito restauração com anestesia ${marker}, próxima consulta retorno em 15 dias`);
      const expected = `Restauração com anestesia ${marker}`;
      await expect(voice.realizado()).toHaveValue(expected);
      await expect(voice.plano()).toHaveValue('Retorno em 15 dias');
      await voice.recordSaveButton().click();
      await expect(page.locator('.p-toast-message-success').filter({ hasText: 'Registro adicionado.' }).first()).toBeVisible();
      await prontuarioPage.goToTab(patientId!, 'plano-ficha');
      await expect(page.locator('app-dc-timeline-item').filter({ hasText: expected }).first()).toBeVisible({ timeout: 20_000 });
      await expect.poll(() => listClinicalRecordTextsByApi(page, patientId!)).toContain(expected);
    });

    test('[PAC-VOZ-133] edição com voz acrescenta ao texto e persiste', async ({ page, browser, appShell, prontuarioPage }) => {
      // Registro próprio e recém-criado (topo da linha do tempo), independente dos demais testes.
      const recordText = e2eName('Voz-Registro-Edit-Persist');
      await createE2eClinicalRecordByApi(browser, patientId!, recordText);
      await prontuarioPage.goToTab(patientId!, 'plano-ficha');
      await appShell.dismissBlockingModals();
      await voice.openEditarRegistro(recordText);
      await expect(voice.realizado()).toHaveValue(recordText);
      await voice.dictate('registro', 'complemento ditado');
      const expected = `${recordText}\nComplemento ditado`;
      await expect(voice.realizado()).toHaveValue(expected);
      await voice.recordSaveButton().click();
      await expect(page.locator('.p-toast-message-success').filter({ hasText: 'Registro atualizado.' }).first()).toBeVisible();
      await expect.poll(() => listClinicalRecordTextsByApi(page, patientId!)).toContain(expected);
    });

    test('[PAC-VOZ-135] cancelar após o ditado não persiste nada', async ({ page, prontuarioPage }) => {
      const marker = `Nao deve salvar ${Date.now()}`;
      const before = await listClinicalRecordTextsByApi(page, patientId!);
      await voice.openNovoRegistro();
      await voice.dictate('registro', marker);
      await voice.cancelButton('registro').click();
      await expect(voice.dialog('registro')).toBeHidden();
      await prontuarioPage.goToTab(patientId!, 'plano-ficha');
      const after = await listClinicalRecordTextsByApi(page, patientId!);
      expect(after).toHaveLength(before.length);
      expect(after.join('\n')).not.toContain(marker);
    });

    test('[PAC-VOZ-137] 500 no Melhorar: toast de erro, texto intacto, sem Desfazer', async () => {
      mock.reply('clinicalImprove', { status: 500, json: {} });
      await voice.openNovoRegistro();
      await voice.realizado().fill('texto que deve ficar');
      await voice.improveButton('registro').click();
      await voice.expectVoiceToast('error', 'Não foi possível melhorar o texto.');
      await expect(voice.realizado()).toHaveValue('texto que deve ficar');
      await expect(voice.undoButton('registro')).toHaveCount(0);
      await expect(voice.credits('registro')).toHaveText('10 créditos restantes');
    });

    test('[PAC-VOZ-151] duplo clique em Melhorar faz uma única chamada', async () => {
      mock.setDefault('clinicalImprove', { delayMs: 1_500, json: AI_VOICE_OK.clinicalImprove('Texto revisado.', '', 9) });
      await voice.openNovoRegistro();
      await voice.realizado().fill('texto cru');
      await voice.improveButton('registro').dblclick();
      // A resposta demora 1,5 s: um 2º POST do duplo clique já estaria registrado quando o texto é aplicado.
      await expect(voice.realizado()).toHaveValue('Texto revisado.');
      await expect(voice.credits('registro')).toHaveText('9 créditos restantes');
      expect(mock.callsTo('clinicalImprove')).toHaveLength(1);
    });

    test('[PAC-VOZ-154] Gravar fica desabilitado durante o processamento', async () => {
      const gate = createGate();
      mock.reply('clinicalImprove', { gate: gate.promise, json: AI_VOICE_OK.clinicalImprove('Texto revisado.', '', 9) });
      await voice.openNovoRegistro();
      await voice.realizado().fill('texto cru');
      await voice.improveButton('registro').click();
      await expect(voice.recordButton('registro')).toBeDisabled();
      gate.release();
      await expect(voice.recordButton('registro')).toBeEnabled();
    });

    test('[PAC-VOZ-158] Gravar pelo teclado não muda o campo alvo', async ({ page }) => {
      await voice.openNovoRegistro();
      await voice.plano().focus();
      await voice.recordButton('registro').focus();
      await page.keyboard.press('Enter');
      await expect(voice.recordButton('registro')).toHaveAttribute('aria-pressed', 'true');
      await expect(voice.target()).toHaveText(/Plano \/ próxima consulta/);
      await say(page, 'orientação de higiene');
      await expect(voice.plano()).toHaveValue('Orientação de higiene');
      await page.keyboard.press('Enter');
      await expect(voice.recordButton('registro')).toHaveAttribute('aria-pressed', 'false');
    });

    test('[PAC-VOZ-164] HTML devolvido pela IA aparece literal e não executa (campo, toast e lista)', async ({ page }) => {
      const marker = `xss-voz-${Date.now()}`;
      const payload = `<img src=x onerror="window.__xss=1"> ${marker}`;
      let dialogOpened = false;
      page.on('dialog', async (d) => {
        dialogOpened = true;
        await d.dismiss();
      });
      mock.reply(
        'clinicalImprove',
        { json: AI_VOICE_OK.clinicalImprove(payload, '', 9) },
        { status: 500, json: { erro: '<img src=x onerror="window.__xss=2">Falhou' } }
      );
      await voice.openNovoRegistro();
      await voice.realizado().fill('texto');
      await voice.improveButton('registro').click();
      await expect(voice.realizado()).toHaveValue(payload);
      await voice.improveButton('registro').click();
      await expect(voice.voiceToast('error').first()).toBeVisible();
      await expect(voice.voiceToast('error').first().locator('img')).toHaveCount(0);
      expect(await page.evaluate(() => window.__xss)).toBeUndefined();

      // Salvar e ver na linha do tempo: o texto continua literal (sem <img> renderizado).
      await expect(voice.realizado()).toHaveValue(payload);
      await voice.recordSaveButton().click();
      await expect(page.locator('.p-toast-message-success').filter({ hasText: 'Registro adicionado.' }).first()).toBeVisible();
      const item = page.locator('app-dc-timeline-item').filter({ hasText: marker }).first();
      await expect(item).toBeVisible({ timeout: 20_000 });
      await expect(item.locator('img[src="x"]')).toHaveCount(0);
      await expect(page.locator('img[src="x"]')).toHaveCount(0);
      expect(await page.evaluate(() => window.__xss)).toBeUndefined();
      expect(dialogOpened).toBe(false);
    });

    test('[PAC-VOZ-165] HTML na fala aparece literal no texto ao vivo e no campo', async ({ page }) => {
      const spoken = '<script>window.__xss=3</script> texto';
      await voice.openNovoRegistro();
      await voice.startRecording('registro');
      await say(page, spoken);
      await expect(voice.recordLiveText()).toContainText('<script>window.__xss=3</script>');
      await voice.stopRecording('registro');
      await expect(voice.realizado()).toHaveValue(/<script>window\.__xss=3<\/script> texto/);
      expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    });

    test('[PAC-VOZ-166] fluxos de voz não logam transcrição nem dados no console', async ({ page }) => {
      const logs: string[] = [];
      page.on('console', (msg) => logs.push(msg.text()));
      const marker = 'marcador sigiloso clinico';
      mock.reply('clinicalImprove', { json: AI_VOICE_OK.clinicalImprove(`Resposta ${marker}`, '', 9) });
      await voice.openNovoRegistro();
      await voice.dictate('registro', marker);
      await voice.improveButton('registro').click();
      await expect(voice.realizado()).toHaveValue(`Resposta ${marker}`);
      const leaked = logs.filter((line) => /marcador sigiloso|audio_base64|E2E-Voz-Ficha/i.test(line));
      expect(leaked).toEqual([]);
    });
  });

  test.describe('dentista por voz', () => {
    test('[PAC-VOZ-068] dentista por voz: nome único seleciona, ambíguo não altera, campo travado não muda', async ({ page, appShell, prontuarioPage }) => {
      test.skip(!patientId, 'Paciente E2E não criado');
      const professionals = [
        { id: 9101, nome: 'Ana Souza' },
        { id: 9102, nome: 'Bruno Lima' },
        { id: 9103, nome: 'Bruno Costa' },
        { id: 37, nome: 'Automação E2E' },
      ];
      await mockProfessionals(page, professionals);
      const { voice } = await openPlanoFicha({ page, appShell, prontuarioPage });

      // Campo travado (sessão real: o usuário E2E é o profissional logado) — a voz não altera.
      await voice.openNovoRegistro();
      const lockedLabel = (await voice.recordProfessional().innerText()).trim();
      await voice.startRecording('registro');
      await say(page, 'com a doutora Ana');
      await voice.stopRecording('registro');
      await expect(voice.recordProfessional()).toHaveText(lockedLabel);
      await voice.cancelButton('registro').click();

      // Campo livre: nome único seleciona; nome ambíguo não altera.
      await unlockProfessionalField(page);
      await prontuarioPage.goToTab(patientId!, 'plano-ficha');
      await appShell.dismissBlockingModals();
      await voice.openNovoRegistro();
      await voice.startRecording('registro');
      await say(page, 'com a doutora Ana');
      await expect(voice.recordProfessional()).toContainText('Ana Souza');
      await say(page, 'com o doutor Bruno');
      await voice.stopRecording('registro');
      await expect(voice.recordProfessional()).toContainText('Ana Souza');
      await expect(voice.realizado()).toHaveValue('');
    });
  });

  test.describe('modo IA (navegador sem reconhecimento de voz)', () => {
    let mock: AiVoiceMock;
    let voice: AiVoicePage;

    test.beforeEach(async ({ page, appShell, prontuarioPage }) => {
      test.skip(!patientId, 'Paciente E2E não criado');
      ({ mock, voice } = await openPlanoFicha({ page, appShell, prontuarioPage }, { speech: 'none' }));
    });

    test('[PAC-VOZ-032] gravação paga envia o áudio e anexa a sugestão da IA', async () => {
      mock.reply('clinicalRecord', { json: AI_VOICE_OK.clinicalRecord('Restauração classe II no 36.', '', 9) });
      await voice.openNovoRegistro();
      await expect(voice.recordButton('registro')).toHaveText(/Preencher por voz\s*· 1 crédito/);
      await voice.realizado().fill('Anestesia.');
      await voice.realizado().focus();
      await voice.startRecording('registro');
      await voice.stopRecording('registro');
      const body = await mock.waitForCall('clinicalRecord');
      expect(body.campo).toBe('realizado');
      expect(String(body.mime_type)).toMatch(/^audio\/webm/);
      expect(Number.isInteger(body.duracao_segundos)).toBe(true);
      expect(String(body.audio_base64)).not.toMatch(/^data:/);
      expect(String(body.audio_base64)).toMatch(/^[A-Za-z0-9+/]+=*$/);
      await expect(voice.realizado()).toHaveValue('Anestesia.\nRestauração classe II no 36.');
      await expect(voice.credits('registro')).toHaveText('9 créditos restantes');
      await expect(voice.undoButton('registro')).toBeVisible();
    });

    test('[PAC-VOZ-074] gravação paga com foco no Plano envia campo plano_proxima_consulta', async () => {
      mock.reply('clinicalRecord', { json: AI_VOICE_OK.clinicalRecord('', 'Retorno em 30 dias.', 9) });
      await voice.openNovoRegistro();
      await voice.plano().focus();
      await voice.startRecording('registro');
      await voice.stopRecording('registro');
      const body = await mock.waitForCall('clinicalRecord');
      expect(body.campo).toBe('plano_proxima_consulta');
      await expect(voice.plano()).toHaveValue('Retorno em 30 dias.');
      await expect(voice.realizado()).toHaveValue('');
    });
  });
});
