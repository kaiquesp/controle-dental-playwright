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
  createGate,
  installFakeVoiceBrowser,
  isoDate,
  mockProfessionals,
  mockTreatmentCatalog,
  say,
  unlockProfessionalField,
  type FakeVoiceBrowserOptions,
} from '../../support/ai-voice-mocks';
import { createE2ePatientByApi, deleteE2ePatient } from '../../support/pacientes-helpers';

/**
 * Assistente IA por Voz — modal Novo/Editar tratamento (aba Tratamentos).
 * Catálogo de procedimentos mockado com ids reais do catálogo da conta E2E (gravação real funciona).
 */

type Fixtures = { page: Page; appShell: AppShellPage; prontuarioPage: ProntuarioPage };

/** Ids reais do catálogo da conta E2E; nomes simplificados para o casamento por voz ficar determinístico. */
const CATALOG = [
  { id: 80, nome: 'Restauração em resina', valor_base: 180 },
  { id: 220, nome: 'Profilaxia', valor_base: 120 },
  { id: 1, nome: 'Alveoloplastia', valor_base: 300 },
];
const RESIN_ID = 80;
const PROFESSIONALS = [
  { id: 9101, nome: 'Ana Souza' },
  { id: 37, nome: 'Automação E2E' },
];
const FULL_PHRASE =
  'restauração em resina no 36, oclusal e distal, em aberto, com a doutora Ana, retorno em 15 dias, observações paciente com sensibilidade';

let patientId: string | null = null;

async function openTratamentos(
  { page, appShell, prontuarioPage }: Fixtures,
  options: { browser?: FakeVoiceBrowserOptions; unlockProfessional?: boolean } = {}
): Promise<{ mock: AiVoiceMock; voice: AiVoicePage }> {
  const mock = await new AiVoiceMock(page).install();
  await installFakeVoiceBrowser(page, options.browser ?? {});
  await mockTreatmentCatalog(page, CATALOG);
  await mockProfessionals(page, PROFESSIONALS);
  if (options.unlockProfessional) {
    await unlockProfessionalField(page);
  }
  await prontuarioPage.goToTab(patientId!, 'tratamentos');
  await appShell.dismissBlockingModals();
  return { mock, voice: new AiVoicePage(page) };
}

test.describe('Prontuário — Assistente IA por Voz — Tratamento', () => {
  test.beforeAll(async ({ browser }) => {
    patientId = (await createE2ePatientByApi(browser, 'Voz-Trat')).id;
  });

  test.afterAll(async ({ browser }) => {
    if (patientId) {
      await deleteE2ePatient(browser, patientId);
    }
  });

  test.describe('modo navegador (preenchimento grátis por regras)', () => {
    let mock: AiVoiceMock;
    let voice: AiVoicePage;

    test.beforeEach(async ({ page, appShell, prontuarioPage }) => {
      test.skip(!patientId, 'Paciente E2E não criado');
      ({ mock, voice } = await openTratamentos({ page, appShell, prontuarioPage }));
    });

    test('[PAC-VOZ-002] barra visível no Novo tratamento', async () => {
      await voice.openNovoTratamento();
      const section = voice.treatmentVoiceSection();
      await expect(section).toBeVisible();
      await expect(section.getByText('Assistente IA por Voz')).toBeVisible();
      await expect(voice.help('tratamento')).toBeVisible();
      await expect(voice.credits('tratamento')).toHaveText('10 créditos restantes');
      await expect(voice.handsFree('tratamento')).toHaveText(/Mãos livres/);
      await expect(voice.recordButton('tratamento')).toHaveText(/Preencher por voz/);
      await expect(voice.improveButton('tratamento')).toHaveText(/Organizar com IA/);
      await expect(voice.improveButton('tratamento')).toBeDisabled();
      await expect(voice.target('tratamento')).toHaveCount(0);
      await expect(voice.help('tratamento')).toHaveAttribute('aria-label', 'Como usar o Assistente IA por Voz');
      expect(mock.callsTo('balance')).toHaveLength(1);
      expect(mock.chargedCalls()).toHaveLength(0);
    });

    test('[PAC-VOZ-178] texto ao vivo do tratamento mostra o ditado e o parcial e some ao parar', async ({ page }) => {
      await voice.openNovoTratamento();
      const live = voice.dialog('tratamento').locator('.pf-trat-clin-modal__voice-fill-live');
      await expect(live).toHaveCount(0);
      await voice.startRecording('tratamento');
      await say(page, 'restauração em resina no 36');
      await expect(live).toContainText('restauração em resina no 36');
      await say(page, 'oclusal e', false);
      await expect(live.locator('.pf-trat-clin-modal__voice-fill-interim')).toHaveText('oclusal e');
      await say(page, 'oclusal e distal');
      await expect(live).toContainText('restauração em resina no 36 oclusal e distal');
      await expect(live.locator('.pf-trat-clin-modal__voice-fill-interim')).toHaveText('');
      await voice.stopRecording('tratamento');
      await expect(live).toHaveCount(0);
      await expect(voice.activeTooth()).toHaveText('36');
      await expect(voice.activeFaces()).toHaveText(['O/I', 'D']);
      expect(mock.chargedCalls()).toHaveLength(0);
    });

    test('[PAC-VOZ-176] HTML devolvido pela IA no tratamento aparece literal (campo e toasts) e não executa', async ({ page }) => {
      let dialogOpened = false;
      page.on('dialog', async (d) => {
        dialogOpened = true;
        await d.dismiss();
      });
      const procText = '<script>window.__xss=4</script>Proc IA';
      mock.reply('treatmentFill', {
        json: AI_VOICE_OK.treatmentFill({
          procedimento_texto: procText,
          obs: '<img src=x onerror="window.__xss=5">obs',
          nao_identificado: ['<img src=x onerror="window.__xss=6">cor'],
        }),
      });
      await voice.openNovoTratamento();
      await voice.dictate('tratamento', 'bom dia');
      await voice.improveButton('tratamento').click();
      await mock.waitForCall('treatmentFill');
      await expect(voice.treatmentField('proc')).toHaveValue(procText);
      await expect(voice.treatmentField('obs')).toHaveValue('<img src=x onerror="window.__xss=5">obs');
      const warn = voice.voiceToast('warn', 'cor').first();
      await expect(warn).toBeVisible();
      await expect(warn).toContainText('<img');
      await expect(page.locator('.p-toast img[src="x"], .p-dialog img[src="x"]')).toHaveCount(0);
      expect(await page.evaluate(() => window.__xss)).toBeUndefined();
      expect(dialogOpened).toBe(false);
    });

    test('[PAC-VOZ-180] resposta tardia do "Organizar com IA" não cai no tratamento reaberto', async () => {
      const gate = createGate();
      mock.reply('treatmentFill', {
        gate: gate.promise,
        json: AI_VOICE_OK.treatmentFill({ procedimento_id: RESIN_ID, procedimento_texto: 'restauração em resina', dente: '46', denticao: 'permanente', faces: ['M'] }),
      });
      await voice.openNovoTratamento();
      await voice.dictate('tratamento', 'bom dia');
      await voice.improveButton('tratamento').click();
      await expect(voice.improveButton('tratamento')).toHaveText(/Processando…/);
      await voice.cancelButton('tratamento').click();
      await expect(voice.dialog('tratamento')).toBeHidden();
      await voice.openNovoTratamento();
      await expect(voice.treatmentField('proc')).toHaveValue('');
      gate.release();
      await expect.poll(() => mock.callsTo('treatmentFill').length).toBe(1);
      // Fim do "Processando…" = resposta aplicada ou descartada pelo front; o form reaberto deve continuar vazio.
      await expect(voice.improveButton('tratamento')).toHaveText(/Organizar com IA/);
      await expect(voice.treatmentField('proc')).toHaveValue('');
      await expect(voice.activeTooth()).toHaveCount(0);
      await expect(voice.undoButton('tratamento')).toHaveCount(0);
    });

    test('[PAC-VOZ-089] fala sem campos reconhecíveis avisa e libera "Organizar com IA"', async () => {
      await voice.openNovoTratamento();
      await voice.dictate('tratamento', 'bom dia tudo bem');
      await voice.expectVoiceToast(
        'warn',
        'Não identifiquei campos do tratamento no que foi dito. Use "Organizar com IA" se algum campo não foi entendido.'
      );
      await expect(voice.improveButton('tratamento')).toBeEnabled();
      expect(mock.chargedCalls()).toHaveLength(0);
    });

    test('[PAC-VOZ-088] procedimento fora do catálogo vira nome livre com aviso', async () => {
      await voice.openNovoTratamento();
      await voice.dictate('tratamento', 'procedimento clareamento caseiro no 11');
      await expect(voice.treatmentField('proc')).toHaveValue(/clareamento caseiro/i);
      await voice.expectVoiceToast('warn', /Procedimento ".*clareamento caseiro.*" não encontrado no catálogo; revise o campo\./i);
      await expect(voice.activeTooth()).toHaveText('11');
    });

    test('[PAC-VOZ-090] correções na fala: dente substituído, faces acumulam e "retirar" desmarca', async ({ page }) => {
      await voice.openNovoTratamento();
      await voice.toothGroup().getByRole('button', { name: /^11$/ }).click();
      await voice.faceGroup().getByRole('button', { name: /^M$/ }).click();
      await voice.startRecording('tratamento');
      await say(page, 'dente 36');
      await say(page, 'dente 46');
      await say(page, 'oclusal e distal');
      await say(page, 'retirar oclusal');
      await voice.stopRecording('tratamento');
      await expect(voice.activeTooth()).toHaveText('46');
      await expect(voice.activeFaces()).toHaveText(['D', 'M']);
    });

    test('[PAC-VOZ-091] números por extenso e dente decíduo', async ({ page }) => {
      await voice.openNovoTratamento();
      await voice.startRecording('tratamento');
      await say(page, 'dente cinquenta e cinco');
      await say(page, 'retorno em 15 dias');
      await voice.stopRecording('tratamento');
      await expect(voice.activeArcada()).toHaveText('Decíduos');
      await expect(voice.activeTooth()).toHaveText('55');
      await expect(voice.treatmentField('detalhes')).toHaveValue('Retorno em 15 dias');
    });

    test('[PAC-VOZ-093] dentista travado: voz não altera e "Organizar" envia profissionais vazios', async ({ page }) => {
      mock.reply('treatmentFill', { json: AI_VOICE_OK.treatmentFill({ profissional_id: 9101 }) });
      await voice.openNovoTratamento();
      const lockedLabel = (await voice.dialog('tratamento').locator('#trat-modal-prof').innerText()).trim();
      await voice.startRecording('tratamento');
      await say(page, 'restauração em resina com a doutora Ana');
      await voice.stopRecording('tratamento');
      await expect(voice.dialog('tratamento').locator('#trat-modal-prof')).toHaveText(lockedLabel);
      await voice.improveButton('tratamento').click();
      const body = await mock.waitForCall('treatmentFill');
      expect(body.profissionais).toEqual([]);
      await expect(voice.dialog('tratamento').locator('#trat-modal-prof')).toHaveText(lockedLabel);
    });

    test('[PAC-VOZ-094] valor não é preenchido por voz (vem do catálogo)', async () => {
      await voice.openNovoTratamento();
      await voice.dictate('tratamento', 'restauração em resina no 36 valor 200 reais');
      await expect(voice.treatmentField('proc')).toHaveValue('Restauração em resina');
      await expect(voice.treatmentField('valor')).not.toHaveValue(/200/);
      await expect(voice.treatmentField('valor')).toHaveValue(/180/);
    });

    test('[PAC-VOZ-095] "Organizar com IA" envia a transcrição e aplica a sugestão', async () => {
      mock.reply('treatmentFill', {
        json: AI_VOICE_OK.treatmentFill(
          {
            procedimento_id: RESIN_ID,
            procedimento_texto: 'restauração em resina',
            denticao: 'permanente',
            dente: '46',
            faces: ['O', 'M'],
            status: 'planejado',
            data: isoDate(-2),
            detalhes_prox_consulta: 'Retorno em 7 dias',
            obs: 'Observação organizada pela IA',
            nao_identificado: ['cor da resina'],
          },
          9
        ),
      });
      await voice.openNovoTratamento();
      await expect(voice.improveButton('tratamento')).toBeDisabled();
      await voice.dictate('tratamento', 'restauração em resina no 36');
      await expect(voice.activeTooth()).toHaveText('36');
      await voice.improveButton('tratamento').click();
      const body = await mock.waitForCall('treatmentFill');
      expect(body.transcricao).toBe('restauração em resina no 36');
      expect(body.data_hoje).toBe(isoDate(0));
      expect(body.procedimentos).toEqual(CATALOG.map((item) => ({ id: item.id, nome: item.nome })));
      expect(body).not.toHaveProperty('audio_base64');
      await expect(voice.activeTooth()).toHaveText('46');
      await expect(voice.activeFaces()).toHaveText(['O/I', 'M']);
      await expect(voice.dialog('tratamento').locator('#trat-modal-status')).toHaveText('Planejado');
      await expect(voice.treatmentField('data')).toHaveValue(brDate(isoDate(-2)));
      await expect(voice.treatmentField('detalhes')).toHaveValue('Retorno em 7 dias');
      await expect(voice.treatmentField('obs')).toHaveValue('Observação organizada pela IA');
      await voice.expectVoiceToast('info', /^.*Preenchido: Procedimento, Dente, Faces, Situação, Data, Detalhes próx\. consulta, Observações\. Revise antes de salvar\./);
      await voice.expectVoiceToast('warn', 'cor da resina');
      await expect(voice.credits('tratamento')).toHaveText('9 créditos restantes');
      await voice.undoButton('tratamento').click();
      await expect(voice.activeTooth()).toHaveText('36');
    });

    test('[PAC-VOZ-097] sugestão da IA com dados inválidos aplica só o que é válido', async ({ page }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));
      mock.reply('treatmentFill', {
        json: AI_VOICE_OK.treatmentFill({
          procedimento_id: 9999,
          procedimento_texto: 'Procedimento sugerido',
          dente: '99',
          faces: ['X', 'O'],
          status: 'foo',
          data: '15/03',
          profissional_id: -1,
        }),
      });
      await voice.openNovoTratamento();
      await voice.dictate('tratamento', 'bom dia');
      await voice.improveButton('tratamento').click();
      await mock.waitForCall('treatmentFill');
      await expect(voice.treatmentField('proc')).toHaveValue('Procedimento sugerido');
      await expect(voice.dialog('tratamento').locator('#trat-modal-status')).toHaveText('Em aberto');
      await expect(voice.treatmentField('data')).toHaveValue(brDate(isoDate(0)));
      await expect(voice.activeFaces()).toHaveText(['O/I']);
      await expect(voice.dialog('tratamento')).toBeVisible();
      expect(pageErrors).toEqual([]);
    });

    test('[PAC-VOZ-098] comando "salvar o tratamento" adiciona; form inválido mantém o modal', async ({ page }) => {
      await voice.openNovoTratamento();
      await voice.startRecording('tratamento');
      await say(page, 'bom dia salvar');
      await expect(voice.dialog('tratamento')).toBeVisible();
      await expect(voice.dialog('tratamento').locator('.invalid-feedback').filter({ hasText: 'Informe o procedimento.' })).toBeVisible();
      await expect(page.locator('.p-toast-message-success')).toHaveCount(0);

      await voice.startRecording('tratamento');
      await say(page, 'restauração em resina no 36 oclusal em aberto salvar o tratamento');
      await expect(voice.dialog('tratamento')).toBeHidden({ timeout: 20_000 });
      await expect(page.locator('.p-toast-message-success').filter({ hasText: 'Tratamento adicionado.' }).first()).toBeVisible();
      await expect(page.locator('.pf-trat-tab__row').filter({ hasText: /Restaura/ }).first()).toBeVisible({ timeout: 20_000 });
      expect(mock.chargedCalls()).toHaveLength(0);
    });

    test('[PAC-VOZ-099] "Salvar e adicionar outro" limpa o estado de voz do tratamento anterior', async ({ page }) => {
      test.info().annotations.push({ type: 'fixed', description: 'R3 — tratamentos-prontuario.facade.ts:566-572 + treatment-voice-fill.facade.ts:69-78 (Desfazer/Organizar do tratamento anterior)' });
      await voice.openNovoTratamento();
      await voice.dictate('tratamento', 'restauração em resina no 36 oclusal');
      await expect(voice.undoButton('tratamento')).toBeVisible();
      await voice.dialog('tratamento').getByRole('button', { name: 'Salvar e adicionar outro' }).click();
      await expect(page.locator('.p-toast-message-success').filter({ hasText: 'Tratamento adicionado. Cadastre o próximo.' }).first()).toBeVisible({ timeout: 20_000 });
      await expect(voice.dialog('tratamento')).toBeVisible();
      await expect(voice.treatmentField('proc')).toHaveValue('');
      await expect(voice.undoButton('tratamento')).toHaveCount(0, { timeout: 3_000 });
      await expect(voice.improveButton('tratamento')).toBeDisabled({ timeout: 3_000 });
    });

    test('[PAC-VOZ-100] "Organizar com IA" preserva edições manuais feitas após o ditado', async () => {
      test.info().annotations.push({ type: 'fixed', description: 'R4 — treatment-voice-fill.facade.ts:84-90, 200-215 descarta edições manuais (dente escolhido à mão)' });
      mock.reply('treatmentFill', { json: AI_VOICE_OK.treatmentFill({ procedimento_id: RESIN_ID, status: 'a_realizar' }) });
      await voice.openNovoTratamento();
      await voice.dictate('tratamento', 'restauração em resina');
      await voice.toothGroup().getByRole('button', { name: /^21$/ }).click();
      await expect(voice.activeTooth()).toHaveText('21');
      await voice.improveButton('tratamento').click();
      await expect(voice.credits('tratamento')).toHaveText('9 créditos restantes');
      await expect(voice.activeTooth()).toHaveText('21', { timeout: 3_000 });
    });

    test('[PAC-VOZ-101] transcrição muito longa no Organizar: toast sem alterar campos', async () => {
      mock.reply('treatmentFill', { status: 400, json: AI_VOICE_ERROR_BODIES.transcriptTooLong });
      await voice.openNovoTratamento();
      await voice.dictate('tratamento', 'restauração em resina no 36');
      await voice.improveButton('tratamento').click();
      await voice.expectVoiceToast('error', /Transcri[cç][aã]o muito longa/);
      await expect(voice.activeTooth()).toHaveText('36');
      await expect(voice.credits('tratamento')).toHaveText('10 créditos restantes');
    });

    test('[PAC-VOZ-104] "sem" desmarca a face citada e encerra ao encontrar outra palavra', async ({ page }) => {
      await voice.openNovoTratamento();
      await voice.startRecording('tratamento');
      await say(page, 'dente 36 oclusal distal');
      await say(page, 'sem distal');
      await expect(voice.activeFaces()).toHaveText(['O/I']);
      await say(page, 'sem dor mesial');
      await voice.stopRecording('tratamento');
      await expect(voice.activeFaces()).toHaveText(['O/I', 'M']);
    });

    test('[PAC-VOZ-134] tratamento preenchido por voz persiste com odontograma marcado', async ({ page, prontuarioPage }) => {
      await voice.openNovoTratamento();
      await voice.dictate('tratamento', 'profilaxia no 26 oclusal e distal em aberto');
      await expect(voice.treatmentField('proc')).toHaveValue('Profilaxia');
      await expect(voice.activeTooth()).toHaveText('26');
      await voice.dialog('tratamento').getByRole('button', { name: /Adicionar tratamento/ }).click();
      await expect(page.locator('.p-toast-message-success').filter({ hasText: 'Tratamento adicionado.' }).first()).toBeVisible({ timeout: 20_000 });
      await prontuarioPage.goToTab(patientId!, 'tratamentos');
      const row = page.locator('.pf-trat-tab__row').filter({ hasText: /Profilaxia/ }).first();
      await expect(row).toBeVisible({ timeout: 20_000 });
      await expect(row).toContainText('26');
      await prontuarioPage.expectOdontogramaMarcado();
    });

    test('[PAC-VOZ-139] 500 no "Organizar com IA" mantém os campos', async () => {
      mock.reply('treatmentFill', { status: 500, json: {} });
      await voice.openNovoTratamento();
      await voice.dictate('tratamento', 'restauração em resina no 36');
      await voice.improveButton('tratamento').click();
      await voice.expectVoiceToast('error', 'Não foi possível organizar com a IA.');
      await expect(voice.activeTooth()).toHaveText('36');
      await expect(voice.treatmentField('proc')).toHaveValue('Restauração em resina');
      await expect(voice.undoButton('tratamento')).toBeVisible();
    });
  });

  test.describe('dentista livre', () => {
    test('[PAC-VOZ-087] frase completa preenche todos os campos por regras, sem IA', async ({ page, appShell, prontuarioPage }) => {
      test.skip(!patientId, 'Paciente E2E não criado');
      const { mock, voice } = await openTratamentos({ page, appShell, prontuarioPage }, { unlockProfessional: true });
      await voice.openNovoTratamento();
      await voice.dictate('tratamento', FULL_PHRASE);
      await expect(voice.treatmentField('proc')).toHaveValue('Restauração em resina');
      await expect(voice.activeArcada()).toHaveText('Permanentes');
      await expect(voice.activeTooth()).toHaveText('36');
      await expect(voice.activeFaces()).toHaveText(['O/I', 'D']);
      await expect(voice.dialog('tratamento').locator('#trat-modal-status')).toHaveText('Em aberto');
      await expect(voice.dialog('tratamento').locator('#trat-modal-prof')).toContainText('Ana Souza');
      await expect(voice.treatmentField('detalhes')).toHaveValue('Retorno em 15 dias');
      await expect(voice.treatmentField('obs')).toHaveValue('Paciente com sensibilidade');
      await voice.expectVoiceToast(
        'info',
        'Preenchido: Procedimento, Dente, Faces, Situação, Dentista, Detalhes próx. consulta, Observações. Revise antes de salvar.'
      );
      expect(mock.chargedCalls()).toHaveLength(0);
    });
  });

  test.describe('modo IA (navegador sem reconhecimento de voz)', () => {
    test('[PAC-VOZ-096] áudio vai para /treatment/fill e preenche o formulário', async ({ page, appShell, prontuarioPage }) => {
      test.skip(!patientId, 'Paciente E2E não criado');
      const { mock, voice } = await openTratamentos({ page, appShell, prontuarioPage }, { browser: { speech: 'none' } });
      const gate = createGate();
      mock.reply('treatmentFill', {
        gate: gate.promise,
        json: AI_VOICE_OK.treatmentFill(
          { procedimento_id: RESIN_ID, denticao: 'permanente', dente: '36', faces: ['O'], status: 'a_realizar' },
          9,
          'restauração em resina no 36 oclusal'
        ),
      });
      await voice.openNovoTratamento();
      await expect(voice.recordButton('tratamento')).toHaveText(/Preencher por voz\s*· 1 crédito/);
      await voice.startRecording('tratamento');
      await voice.recordButton('tratamento').click();
      await expect(voice.improveButton('tratamento')).toHaveText(/Processando…/);
      const body = await mock.waitForCall('treatmentFill');
      expect(String(body.audio_base64)).toMatch(/^[A-Za-z0-9+/]+=*$/);
      expect(String(body.mime_type)).toMatch(/^audio\/webm/);
      expect(Number.isInteger(body.duracao_segundos)).toBe(true);
      expect(body.data_hoje).toBe(isoDate(0));
      expect(Array.isArray(body.procedimentos)).toBe(true);
      expect(Array.isArray(body.profissionais)).toBe(true);
      expect(body).not.toHaveProperty('transcricao');
      gate.release();
      await expect(voice.treatmentField('proc')).toHaveValue('Restauração em resina');
      await expect(voice.activeTooth()).toHaveText('36');
      await expect(voice.credits('tratamento')).toHaveText('9 créditos restantes');
      await expect(voice.improveButton('tratamento')).toBeEnabled();
    });
  });
});
