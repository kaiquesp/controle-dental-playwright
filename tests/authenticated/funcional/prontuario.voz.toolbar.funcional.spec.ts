import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/test.fixture';
import { AiVoicePage } from '../../pages/ai-voice.page';
import type { AppShellPage } from '../../pages/app-shell.page';
import type { ProntuarioPage } from '../../pages/prontuario.page';
import {
  AI_VOICE_ERROR_BODIES,
  AI_VOICE_OK,
  AiVoiceMock,
  aiVoiceBalance,
  createE2eClinicalTreatmentByApi,
  createGate,
  installFakeVoiceBrowser,
  say,
  speechError,
  speechSessionEnd,
  voiceStats,
  type FakeVoiceBrowserOptions,
} from '../../support/ai-voice-mocks';
import { e2eName } from '../../support/crud-helpers';
import { setAiVoiceFeatureFlag } from '../../support/feature-mocks';
import { createE2ePatientByApi, deleteE2ePatient } from '../../support/pacientes-helpers';

/**
 * Assistente IA por Voz — barra compartilhada (`app-dc-ai-voice-toolbar`): gating, créditos,
 * microfone/estratégia de transcrição, timer e limites, Mãos livres, ciclo de vida, erros de API,
 * acessibilidade e responsividade. Exercitada principalmente no modal Novo registro.
 */

type Fixtures = { page: Page; appShell: AppShellPage; prontuarioPage: ProntuarioPage };

let patientId: string | null = null;
const treatmentName = e2eName('Voz-Toolbar-Trat');

async function openTab(
  { page, appShell, prontuarioPage }: Fixtures,
  browser: FakeVoiceBrowserOptions = {},
  tab: 'plano-ficha' | 'tratamentos' = 'plano-ficha'
): Promise<{ mock: AiVoiceMock; voice: AiVoicePage }> {
  const mock = await new AiVoiceMock(page).install();
  await installFakeVoiceBrowser(page, browser);
  await prontuarioPage.goToTab(patientId!, tab);
  await appShell.dismissBlockingModals();
  return { mock, voice: new AiVoicePage(page) };
}

test.describe('Prontuário — Assistente IA por Voz — Barra, créditos e erros', () => {
  test.beforeAll(async ({ browser }) => {
    patientId = (await createE2ePatientByApi(browser, 'Voz-Toolbar')).id;
    await createE2eClinicalTreatmentByApi(browser, patientId, treatmentName);
  });

  test.afterAll(async ({ browser }) => {
    if (patientId) {
      await deleteE2ePatient(browser, patientId);
    }
  });

  test.beforeEach(async () => {
    test.skip(!patientId, 'Paciente E2E não criado');
  });

  // ------------------------------------------------------------------ Gating e saldo (modo navegador)
  test.describe('gating e créditos', () => {
    let mock: AiVoiceMock;
    let voice: AiVoicePage;

    test.beforeEach(async ({ page, appShell, prontuarioPage }) => {
      ({ mock, voice } = await openTab({ page, appShell, prontuarioPage }));
    });

    test('[PAC-VOZ-004] flag desligada ou ausente: sem barra nos três modais e sem chamadas de IA', async ({ page, appShell, prontuarioPage }) => {
      await setAiVoiceFeatureFlag(page, false);
      await prontuarioPage.goToTab(patientId!, 'plano-ficha');
      await appShell.dismissBlockingModals();
      const calls = mock.calls.length;
      await voice.openNovoRegistro();
      await expect(voice.dialog('registro').getByText('O que foi feito').first()).toBeVisible();
      await expect(voice.toolbar('registro')).toHaveCount(0);
      await voice.realizado().fill('Registro sem voz');
      await voice.cancelButton('registro').click();

      await prontuarioPage.goToTab(patientId!, 'tratamentos');
      await appShell.dismissBlockingModals();
      await voice.openNovoTratamento();
      await expect(voice.toolbar('tratamento')).toHaveCount(0);
      await voice.cancelButton('tratamento').click();
      await voice.openFinalizar(treatmentName);
      await expect(voice.toolbar('finalizar')).toHaveCount(0);
      await expect(voice.evolucao()).toBeVisible();
      await voice.cancelButton('finalizar').click();
      expect(mock.calls.slice(calls)).toHaveLength(0);

      await setAiVoiceFeatureFlag(page, 'omit');
      await prontuarioPage.goToTab(patientId!, 'plano-ficha');
      await appShell.dismissBlockingModals();
      await voice.openNovoRegistro();
      await expect(voice.toolbar('registro')).toHaveCount(0);
      expect(mock.calls.slice(calls)).toHaveLength(0);
    });

    test('[PAC-VOZ-005] flags carregadas depois da abertura: barra aparece e busca o saldo', async ({ page, appShell, prontuarioPage }) => {
      await setAiVoiceFeatureFlag(page, true, { delayMs: 10_000 });
      await prontuarioPage.goToTab(patientId!, 'plano-ficha');
      await appShell.dismissBlockingModals();
      await voice.openNovoRegistro();
      const balanceBefore = mock.callsTo('balance').length;
      await expect(voice.toolbar('registro')).toHaveCount(0);
      await expect(voice.toolbar('registro')).toBeVisible({ timeout: 20_000 });
      await expect(voice.credits('registro')).toHaveText('10 créditos restantes');
      expect(mock.callsTo('balance').length).toBeGreaterThan(balanceBefore);
    });

    test('[PAC-VOZ-007] perfil sem permissão (403 de role): ditado grátis funciona e ação paga mostra erro', async ({ page }) => {
      mock.setBalance({ status: 403, json: AI_VOICE_ERROR_BODIES.roleForbidden });
      mock.reply('clinicalImprove', { status: 403, json: AI_VOICE_ERROR_BODIES.roleForbidden });
      await voice.openNovoRegistro();
      await expect(voice.credits('registro')).toHaveText('Créditos');
      await voice.startRecording('registro');
      await say(page, 'profilaxia');
      await voice.stopRecording('registro');
      await expect(voice.realizado()).toHaveValue('Profilaxia');
      await voice.improveButton('registro').click();
      await voice.expectVoiceToast('error', /Sem permiss(ao|ão) para este recurso/);
      await expect(voice.realizado()).toHaveValue('Profilaxia');
    });

    test('[PAC-VOZ-008] plano sem o módulo / trial encerrado: gating + toast, texto intacto', async ({ page }) => {
      mock.reply(
        'clinicalImprove',
        { status: 403, json: AI_VOICE_ERROR_BODIES.featureNotInPlan },
        { status: 403, json: AI_VOICE_ERROR_BODIES.planBlocked }
      );
      await voice.openNovoRegistro();
      await voice.realizado().fill('texto clínico');
      await voice.improveButton('registro').click();
      await voice.expectVoiceToast('error', /Funcionalidade indispon/);
      const gatingDialog = page.locator('.p-dialog').filter({ hasText: 'Funcionalidade indisponível' }).last();
      await expect(gatingDialog).toBeVisible();
      await expect(voice.realizado()).toHaveValue('texto clínico');
      await expect(voice.credits('registro')).toHaveText('10 créditos restantes');
      expect(mock.callsTo('clinicalImprove')).toHaveLength(1);
      await gatingDialog.locator('.feature-gating-modal__btn-cancel').click();
      await expect(gatingDialog).toBeHidden();
      await expect(voice.realizado()).toHaveValue('texto clínico');
    });

    test('[PAC-VOZ-183] trial encerrado / assinatura inativa (403 acao=contratar) numa ação de IA aciona o bloqueio global', async ({ page }) => {
      test.info().annotations.push({
        type: 'risk',
        description: 'R36 — auth.interceptor.ts:43-50 marca o plano como não contratado e o app sai do prontuário: o texto não salvo do modal é descartado sem aviso',
      });
      mock.reply('clinicalImprove', { status: 403, json: AI_VOICE_ERROR_BODIES.planBlocked });
      await voice.openNovoRegistro();
      await voice.realizado().fill('texto clínico');
      await voice.improveButton('registro').click();
      // Fluxo global de bloqueio: o interceptor marca o plano como não contratado e o shell desmonta o prontuário (modal some).
      await expect(voice.dialog('registro')).toHaveCount(0, { timeout: 20_000 });
      expect(mock.callsTo('clinicalImprove')).toHaveLength(1);
      await expect(voice.undoButton('registro')).toHaveCount(0);
    });

    test('[PAC-VOZ-009] flag do back desligada: saldo "Créditos", ditado grátis ok, Melhorar com erro', async ({ page }) => {
      mock.setBalance({ status: 403, json: AI_VOICE_ERROR_BODIES.flagForbidden });
      mock.reply('clinicalImprove', { status: 403, json: AI_VOICE_ERROR_BODIES.flagForbidden });
      await voice.openNovoRegistro();
      await expect(voice.credits('registro')).toHaveText('Créditos');
      await voice.startRecording('registro');
      await say(page, 'raspagem');
      await voice.stopRecording('registro');
      await expect(voice.realizado()).toHaveValue('Raspagem');
      await voice.improveButton('registro').click();
      await voice.expectVoiceToast('error', /Funcionalidade indispon/);
      await expect(voice.realizado()).toHaveValue('Raspagem');
    });

    test('[PAC-VOZ-010] IA não configurada (503): aviso "ainda não está disponível" e texto intacto', async () => {
      // /balance anuncia IA disponível (com ia_disponivel:false o Melhorar fica desabilitado — PAC-VOZ-011, correção R12);
      // o 503 ai_not_configured vem do endpoint pago, cenário de config removida entre o /balance e a ação.
      mock.setBalance({ json: aiVoiceBalance(10) });
      mock.reply('clinicalImprove', { status: 503, json: AI_VOICE_ERROR_BODIES.aiNotConfigured });
      await voice.openNovoRegistro();
      await voice.realizado().fill('texto clínico');
      await voice.improveButton('registro').click();
      await voice.expectVoiceToast('warn', 'O Assistente IA ainda não está disponível.');
      await expect(voice.realizado()).toHaveValue('texto clínico');
      await expect(voice.credits('registro')).toHaveText('10 créditos restantes');
    });

    test('[PAC-VOZ-011] ia_disponivel=false desabilita as ações pagas', async () => {
      test.info().annotations.push({ type: 'fixed', description: 'R12 — ai-voice-assistant.base.ts:178-195 lê ia_disponivel mas não usa' });
      mock.setBalance({ json: aiVoiceBalance(10, { ia_disponivel: false }) });
      await voice.openNovoRegistro();
      await voice.realizado().fill('texto clínico');
      await expect(voice.improveButton('registro')).toBeDisabled({ timeout: 3_000 });
    });

    test('[PAC-VOZ-013] rótulo do saldo: plural, singular e zero', async () => {
      await voice.openNovoRegistro();
      await expect(voice.credits('registro')).toHaveText('10 créditos restantes');
      await expect(voice.credits('registro')).not.toHaveClass(/dc-ai-voice-toolbar__credits--empty/);
      await voice.cancelButton('registro').click();

      mock.setBalance({ json: aiVoiceBalance(1) });
      await voice.openNovoRegistro();
      await expect(voice.credits('registro')).toHaveText('1 crédito restante');
      await voice.cancelButton('registro').click();

      mock.setBalance({ json: aiVoiceBalance(0) });
      await voice.openNovoRegistro();
      await expect(voice.credits('registro')).toHaveText('0 créditos restantes');
      await expect(voice.credits('registro')).toHaveClass(/dc-ai-voice-toolbar__credits--empty/);
    });

    test('[PAC-VOZ-014] saldo recarregado a cada abertura do modal', async () => {
      await voice.openNovoRegistro();
      await expect(voice.credits('registro')).toHaveText('10 créditos restantes');
      expect(mock.callsTo('balance')).toHaveLength(1);
      await voice.cancelButton('registro').click();
      mock.setBalance({ json: aiVoiceBalance(7) });
      await voice.openNovoRegistro();
      await expect(voice.credits('registro')).toHaveText('7 créditos restantes');
      expect(mock.callsTo('balance')).toHaveLength(2);
    });

    test('[PAC-VOZ-015] falha no /balance: rótulo "Créditos", sem toast e ditado grátis habilitado', async ({ page }) => {
      // Cada variante parte de um saldo conhecido (10): a troca para "Créditos" prova que a falha foi tratada
      // (o rótulo inicial também é "Créditos", então só checar o texto não falharia se o erro fosse ignorado).
      const failures: { label: string; reply: Parameters<AiVoiceMock['setBalance']>[0]; timeout?: boolean }[] = [
        { label: '500', reply: { status: 500, json: { erro: 'falha' } } },
        { label: 'rede', reply: { abort: true } },
        { label: 'timeout 20 s', reply: { hang: true }, timeout: true },
      ];
      for (const failure of failures) {
        mock.setBalance({ json: aiVoiceBalance(10) });
        await voice.openNovoRegistro();
        await expect(voice.credits('registro'), failure.label).toHaveText('10 créditos restantes');
        await voice.cancelButton('registro').click();
        await expect(voice.dialog('registro')).toBeHidden();

        mock.setBalance(failure.reply);
        const balanceCalls = mock.callsTo('balance').length;
        if (failure.timeout) {
          await page.clock.install();
        }
        await voice.openNovoRegistro();
        await expect.poll(() => mock.callsTo('balance').length).toBe(balanceCalls + 1);
        if (failure.timeout) {
          await expect(voice.credits('registro'), 'saldo antigo exibido enquanto aguarda').toHaveText('10 créditos restantes');
          await page.clock.fastForward('00:21');
        }
        await expect(voice.credits('registro'), failure.label).toHaveText('Créditos');
        await expect(voice.recordButton('registro')).toBeEnabled();
        await voice.expectNoVoiceToast();
        await voice.cancelButton('registro').click();
        await expect(voice.dialog('registro')).toBeHidden();
      }
    });

    test('[PAC-VOZ-016] saldo desconhecido não libera ações pagas', async () => {
      test.info().annotations.push({ type: 'fixed', description: 'R13 — dc-ai-voice-toolbar.component.ts:71-80 habilita Melhorar sem saldo conhecido' });
      mock.setBalance({ status: 500, json: { erro: 'falha' } });
      await voice.openNovoRegistro();
      await expect(voice.credits('registro')).toHaveText('Créditos');
      await voice.realizado().fill('texto clínico');
      await expect(voice.improveButton('registro')).toBeDisabled({ timeout: 3_000 });
    });

    test('[PAC-VOZ-017] payload de saldo inesperado é tratado como zero', async () => {
      for (const saldo of ['abc', -5, undefined]) {
        mock.setBalance({ json: { ...aiVoiceBalance(0), saldo_creditos: saldo, max_segundos_gravacao: undefined } });
        await voice.openNovoRegistro();
        await expect(voice.credits('registro')).toHaveText('0 créditos restantes');
        await voice.cancelButton('registro').click();
        await expect(voice.dialog('registro')).toBeHidden();
      }
    });

    test('[PAC-VOZ-019] falha da IA (502) mostra erro e mantém texto e saldo', async () => {
      mock.reply('clinicalImprove', { status: 502, json: AI_VOICE_ERROR_BODIES.providerFailure });
      await voice.openNovoRegistro();
      await voice.realizado().fill('texto clínico');
      await voice.improveButton('registro').click();
      await voice.expectVoiceToast('error', /processar com a IA/);
      await expect(voice.realizado()).toHaveValue('texto clínico');
      await expect(voice.credits('registro')).toHaveText('10 créditos restantes');
      await expect(voice.undoButton('registro')).toHaveCount(0);
      await voice.cancelButton('registro').click();
      await voice.openNovoRegistro();
      await expect(voice.credits('registro')).toHaveText('10 créditos restantes');
    });

    test('[PAC-VOZ-020] 402 créditos insuficientes: aviso, saldo zerado e Melhorar desabilitado', async () => {
      mock.setBalance({ json: aiVoiceBalance(1) });
      mock.reply('clinicalImprove', { status: 402, json: AI_VOICE_ERROR_BODIES.insufficientCredits(0) });
      await voice.openNovoRegistro();
      await expect(voice.credits('registro')).toHaveText('1 crédito restante');
      await voice.realizado().fill('texto clínico');
      await voice.improveButton('registro').click();
      await voice.expectVoiceToast('warn', 'Seus créditos do Assistente IA acabaram. Compre um pacote para continuar.');
      await expect(voice.credits('registro')).toHaveText('0 créditos restantes');
      await expect(voice.improveButton('registro')).toBeDisabled();
      await expect(voice.realizado()).toHaveValue('texto clínico');
    });

    test('[PAC-VOZ-021] saldo zero no modo navegador: ditado grátis habilitado, Melhorar desabilitado', async () => {
      mock.setBalance({ json: aiVoiceBalance(0) });
      await voice.openNovoRegistro();
      await expect(voice.credits('registro')).toHaveClass(/dc-ai-voice-toolbar__credits--empty/);
      await expect(voice.recordButton('registro')).toBeEnabled();
      await expect(voice.recordButton('registro')).not.toContainText('1 crédito');
      await expect(voice.recordButton('registro')).toHaveAttribute('title', 'Transcreve sua fala pelo navegador (não consome créditos)');
      await voice.realizado().fill('texto clínico');
      await expect(voice.improveButton('registro')).toBeDisabled();
    });

    test('[PAC-VOZ-023] clique no saldo leva à compra de créditos', async ({ page }) => {
      await voice.openNovoRegistro();
      await voice.credits('registro').click();
      await expect(page).toHaveURL(/\/configuracoes\?aba=mensagens-creditos/, { timeout: 20_000 });
      const section = page.getByRole('region', { name: 'Créditos do Assistente IA por Voz' });
      await expect(section.getByRole('heading', { name: 'Assistente IA por Voz' })).toBeVisible({ timeout: 20_000 });
      await expect(section.getByTestId('ai-voice-credits-balance')).toHaveText(/10 disponíveis agora/);
      await expect(voice.dialog('registro')).toBeHidden();
    });

    test('[PAC-VOZ-026] tooltip de ajuda abre no hover/foco e traz as instruções', async ({ page }) => {
      await voice.openNovoRegistro();
      // O focus trap do modal foca o "i" ao abrir; tira o foco antes de testar o hover.
      await voice.realizado().click();
      await voice.help('registro').hover();
      const tooltip = page.locator('.dc-ai-voice-toolbar__tooltip');
      await expect(tooltip).toBeVisible();
      for (const text of ['Ok Controle Dental', 'limpe o campo', 'salvar', '5 segundos', 'O áudio não é armazenado']) {
        await expect(tooltip).toContainText(text);
      }
      await voice.realizado().hover();
      await expect(tooltip).toBeHidden();
      await voice.realizado().click();
      await voice.help('registro').focus();
      await expect(tooltip).toBeVisible();
    });

    test('[PAC-VOZ-028] títulos nativos dos botões explicam custo e Mãos livres', async () => {
      await voice.openNovoRegistro();
      await expect(voice.recordButton('registro')).toHaveAttribute('title', 'Transcreve sua fala pelo navegador (não consome créditos)');
      await expect(voice.improveButton('registro')).toHaveAttribute('title', 'A IA corrige e organiza o texto (consome 1 crédito)');
      await expect(voice.handsFree('registro')).toHaveAttribute('title', /processado no próprio computador/);
    });

    test('[PAC-VOZ-035] permissão negada no reconhecimento do navegador', async ({ page }) => {
      await voice.openNovoRegistro();
      await voice.startRecording('registro');
      await speechError(page, 'not-allowed');
      await voice.expectVoiceToast('error', 'Permita o acesso ao microfone no navegador para gravar.');
      await expect(voice.recordButton('registro')).toHaveAttribute('aria-pressed', 'false');
      await expect(voice.recordButton('registro')).toHaveText(/^\s*Preencher por voz\s*$/);
      expect(mock.chargedCalls()).toHaveLength(0);
    });

    test('[PAC-VOZ-041] erros no-speech/aborted são ignorados e a sessão reinicia', async ({ page }) => {
      await voice.openNovoRegistro();
      await voice.startRecording('registro');
      await speechError(page, 'no-speech');
      await speechError(page, 'aborted');
      await speechSessionEnd(page);
      await expect.poll(() => voiceStats(page).then((s) => s.starts)).toBe(2);
      await expect(voice.recordButton('registro')).toHaveAttribute('aria-pressed', 'true');
      await say(page, 'continua gravando');
      await voice.stopRecording('registro');
      await expect(voice.realizado()).toHaveValue('Continua gravando');
      await voice.expectNoVoiceToast();
    });

    test('[PAC-VOZ-046] estado gravando: timer, aria-pressed, classe e live region', async ({ page, appShell, prontuarioPage }) => {
      ({ mock, voice } = await openTab({ page, appShell, prontuarioPage }, { speech: 'none' }));
      mock.reply('clinicalRecord', { json: AI_VOICE_OK.clinicalRecord('Texto IA', '', 9) });
      await page.clock.install();
      await voice.openNovoRegistro();
      await voice.realizado().fill('texto prévio');
      // 1ª gravação curta só para existir um "Desfazer" e validar que ele fica desabilitado gravando.
      await voice.startRecording('registro');
      await expect(voice.timer('registro')).toHaveText('0:00');
      await voice.stopRecording('registro');
      await expect(voice.realizado()).toHaveValue('texto prévio\nTexto IA');
      await expect(voice.undoButton('registro')).toBeEnabled();
      await expect(voice.improveButton('registro')).toBeEnabled();
      await voice.startRecording('registro');
      await expect(voice.undoButton('registro')).toBeDisabled();
      await page.clock.fastForward('01:05');
      await expect(voice.timer('registro')).toHaveText('1:05');
      await expect(voice.recordButton('registro')).toContainText('Parar');
      await expect(voice.toolbarRoot('registro')).toHaveClass(/dc-ai-voice-toolbar--recording/);
      await expect(voice.liveRegion('registro')).toHaveText('Gravando');
      await expect(voice.improveButton('registro')).toBeDisabled();
      await voice.stopRecording('registro');
      await expect(voice.toolbarRoot('registro')).not.toHaveClass(/dc-ai-voice-toolbar--recording/);
    });

    test('[PAC-VOZ-048] auto-stop após 5 s sem fala no modo navegador', async ({ page }) => {
      await page.clock.install();
      await voice.openNovoRegistro();
      await voice.startRecording('registro');
      await page.clock.fastForward('00:04');
      await say(page, 'primeira frase');
      await page.clock.fastForward('00:04');
      await expect(voice.recordButton('registro')).toHaveAttribute('aria-pressed', 'true');
      await page.clock.fastForward('00:02');
      await expect(voice.recordButton('registro')).toHaveAttribute('aria-pressed', 'false');
      await voice.expectVoiceToast('info', 'Gravação encerrada após 5 segundos sem fala.');
      await expect(voice.realizado()).toHaveValue('Primeira frase');

      await voice.startRecording('registro');
      await page.clock.fastForward('00:06');
      await expect(voice.recordButton('registro')).toHaveAttribute('aria-pressed', 'false');
      await voice.expectVoiceToast('warn', 'Nenhuma fala foi reconhecida. Tente novamente.');
    });

    test('[PAC-VOZ-123] fechar (X) durante o ditado descarta a gravação e reabre limpo', async ({ page }) => {
      await voice.openNovoRegistro();
      await voice.startRecording('registro');
      await say(page, 'texto parcial', false);
      await voice.closeButton('registro').click();
      await expect(voice.dialog('registro')).toBeHidden();
      expect(await page.evaluate(() => window.__voice.current)).toBeNull();
      await voice.expectNoVoiceToast();
      await voice.openNovoRegistro();
      await expect(voice.recordButton('registro')).toHaveAttribute('aria-pressed', 'false');
      await expect(voice.realizado()).toHaveValue('');
      expect(mock.chargedCalls()).toHaveLength(0);
    });

    test('[PAC-VOZ-140] mensagens de erro da API aparecem com acentuação correta', async () => {
      test.info().annotations.push({ type: 'fixed', description: 'R21 — routes/ai-voice.route.ts: "Nao foi possivel processar com a IA." exibido cru; "Nenhum credito foi debitado" (mensagem) nunca aparece' });
      mock.reply('clinicalImprove', { status: 502, json: AI_VOICE_ERROR_BODIES.providerFailure });
      await voice.openNovoRegistro();
      await voice.realizado().fill('texto');
      await voice.improveButton('registro').click();
      await expect(voice.voiceToast('error').first()).toBeVisible();
      await expect(voice.voiceToast('error').first()).toContainText('Não foi possível processar', { timeout: 3_000 });
    });

    test('[PAC-VOZ-141] 503 ai_provider_failure mostra erro (não o aviso de indisponível)', async () => {
      mock.reply('clinicalImprove', { status: 503, json: AI_VOICE_ERROR_BODIES.providerFailure });
      await voice.openNovoRegistro();
      await voice.realizado().fill('texto');
      await voice.improveButton('registro').click();
      await voice.expectVoiceToast('error', /processar com a IA/);
      await expect(voice.voiceToast('warn', 'ainda não está disponível')).toHaveCount(0);
      await expect(voice.credits('registro')).toHaveText('10 créditos restantes');
    });

    test('[PAC-VOZ-142] 401 em ação paga encerra a sessão e leva ao login', async ({ page }) => {
      await page.route('**/api/auth/logout', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
      mock.reply('clinicalImprove', { status: 401, json: { erro: 'Token expirado.' } });
      await voice.openNovoRegistro();
      await voice.realizado().fill('texto');
      await voice.improveButton('registro').click();
      await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    });

    test('[PAC-VOZ-143] timeout de 90 s do front: toast fallback e botões reabilitados', async ({ page }) => {
      mock.reply('clinicalImprove', { hang: true });
      await page.clock.install();
      await voice.openNovoRegistro();
      await voice.realizado().fill('texto clínico');
      await voice.improveButton('registro').click();
      await expect(voice.improveButton('registro')).toHaveText(/Processando…/);
      await page.clock.fastForward('01:31');
      await voice.expectVoiceToast('error', 'Não foi possível melhorar o texto.');
      await expect(voice.improveButton('registro')).toHaveText(/Melhorar via IA/);
      await expect(voice.improveButton('registro')).toBeEnabled();
      await expect(voice.recordButton('registro')).toBeEnabled();
      await expect(voice.realizado()).toHaveValue('texto clínico');
    });

    test('[PAC-VOZ-144] rede offline: toast de erro sem detalhe técnico', async () => {
      mock.reply('clinicalImprove', { abort: true });
      await voice.openNovoRegistro();
      await voice.realizado().fill('texto clínico');
      await voice.improveButton('registro').click();
      const toast = voice.voiceToast('error').first();
      await expect(toast).toContainText('Não foi possível melhorar o texto.');
      await expect(toast).not.toContainText(/Http failure|HttpErrorResponse|stack|undefined|status/i);
      await expect(voice.realizado()).toHaveValue('texto clínico');
      await expect(voice.improveButton('registro')).toBeEnabled();
      await expect(voice.credits('registro')).toHaveText('10 créditos restantes');
    });

    test('[PAC-VOZ-145] 200 sem saldo_creditos não zera o saldo', async () => {
      test.info().annotations.push({ type: 'fixed', description: 'R29 — ai-voice-api.service.ts parse* usa 0 como fallback de saldo_creditos' });
      mock.reply('clinicalImprove', { json: {} });
      await voice.openNovoRegistro();
      await voice.realizado().fill('texto clínico');
      await voice.improveButton('registro').click();
      await expect.poll(() => mock.callsTo('clinicalImprove').length).toBe(1);
      await expect(voice.realizado()).toHaveValue('texto clínico');
      await expect(voice.credits('registro')).toHaveText('10 créditos restantes', { timeout: 3_000 });
    });

    test('[PAC-VOZ-156] navegação por teclado na barra e foco preso no modal', async ({ page }) => {
      await voice.openNovoRegistro();
      await voice.help('registro').focus();
      await page.keyboard.press('Tab');
      await expect(voice.credits('registro')).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(voice.handsFree('registro')).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(voice.recordButton('registro')).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(voice.recordButton('registro')).toHaveAttribute('aria-pressed', 'true');
      await page.keyboard.press('Space');
      await expect(voice.recordButton('registro')).toHaveAttribute('aria-pressed', 'false');
      for (let i = 0; i < 25; i++) {
        await page.keyboard.press('Tab');
      }
      expect(await voice.dialog('registro').evaluate((el) => el.contains(document.activeElement))).toBe(true);
    });

    test('[PAC-VOZ-157] estados ARIA: aria-pressed, live region, ícones e spinner', async ({ page }) => {
      const gate = createGate();
      mock.reply('clinicalImprove', { gate: gate.promise, json: AI_VOICE_OK.clinicalImprove('Texto.', '', 9) });
      await voice.openNovoRegistro();
      const toolbar = voice.toolbar('registro');
      await expect(toolbar.locator('svg:not([aria-hidden="true"])')).toHaveCount(0);
      await expect(voice.recordButton('registro')).toHaveAttribute('aria-pressed', 'false');
      await expect(voice.handsFree('registro')).toHaveAttribute('aria-pressed', 'false');
      await voice.startRecording('registro');
      await expect(voice.liveRegion('registro')).toHaveText('Gravando');
      await say(page, 'texto ditado');
      await voice.stopRecording('registro');
      await expect(voice.liveRegion('registro')).toHaveText('');
      await voice.improveButton('registro').click();
      await expect(voice.liveRegion('registro')).toHaveText('Processando com IA');
      await expect(voice.improveButton('registro').locator('[role="status"]')).toBeAttached();
      gate.release();
      await expect(voice.liveRegion('registro')).toHaveText('');
    });

    test('[PAC-VOZ-161] botão de saldo tem nome acessível de compra de créditos', async () => {
      test.info().annotations.push({ type: 'fixed', description: 'R33 — dc-ai-voice-toolbar.component.html:35-42 sem aria-label/title de "comprar créditos"' });
      await voice.openNovoRegistro();
      await expect(voice.page.getByRole('button', { name: /comprar/i })).toBeVisible({ timeout: 3_000 });
    });
  });

  // ------------------------------------------------------------------ Modo IA (sem SpeechRecognition)
  test.describe('modo IA (gravação paga)', () => {
    let mock: AiVoiceMock;
    let voice: AiVoicePage;

    test.beforeEach(async ({ page, appShell, prontuarioPage }) => {
      ({ mock, voice } = await openTab({ page, appShell, prontuarioPage }, { speech: 'none' }));
      mock.setDefault('clinicalRecord', { json: AI_VOICE_OK.clinicalRecord('Texto transcrito pela IA.', '', 9) });
    });

    test('[PAC-VOZ-022] saldo zero no modo IA: gravação paga desabilitada', async () => {
      mock.setBalance({ json: aiVoiceBalance(0) });
      await voice.openNovoRegistro();
      await expect(voice.recordButton('registro')).toHaveText(/Preencher por voz\s*· 1 crédito/);
      await expect(voice.recordButton('registro')).toBeDisabled();
      await expect(voice.recordButton('registro')).toHaveAttribute('title', 'Grava o áudio e a IA organiza o texto (consome 1 crédito)');
    });

    test('[PAC-VOZ-024] clique no saldo durante a gravação navega e libera o microfone', async ({ page }) => {
      await voice.openNovoRegistro();
      await voice.realizado().fill('texto não salvo');
      await voice.startRecording('registro');
      await expect.poll(() => voiceStats(page).then((s) => s.liveTracks)).toBe(1);
      await voice.credits('registro').click();
      await expect(page).toHaveURL(/\/configuracoes\?aba=mensagens-creditos/, { timeout: 20_000 });
      await expect.poll(() => voiceStats(page).then((s) => s.liveTracks)).toBe(0);
      expect(mock.chargedCalls()).toHaveLength(0);
    });

    test('[PAC-VOZ-034] permissão negada no modo IA (getUserMedia)', async ({ page, appShell, prontuarioPage }) => {
      ({ mock, voice } = await openTab({ page, appShell, prontuarioPage }, { speech: 'none', getUserMediaError: 'NotAllowedError' }));
      await voice.openNovoRegistro();
      await voice.recordButton('registro').click();
      await voice.expectVoiceToast('error', 'Permita o acesso ao microfone no navegador para gravar.');
      await expect(voice.recordButton('registro')).toHaveAttribute('aria-pressed', 'false');
      expect(mock.chargedCalls()).toHaveLength(0);
    });

    test('[PAC-VOZ-036] sem microfone (NotFoundError)', async ({ page, appShell, prontuarioPage }) => {
      ({ mock, voice } = await openTab({ page, appShell, prontuarioPage }, { speech: 'none', getUserMediaError: 'NotFoundError' }));
      await voice.openNovoRegistro();
      await voice.recordButton('registro').click();
      await voice.expectVoiceToast('error', 'Nenhum microfone foi encontrado neste dispositivo.');
      await expect(voice.recordButton('registro')).toHaveAttribute('aria-pressed', 'false');
    });

    test('[PAC-VOZ-037] microfone ocupado / erro desconhecido', async ({ page, appShell, prontuarioPage }) => {
      ({ mock, voice } = await openTab({ page, appShell, prontuarioPage }, { speech: 'none', getUserMediaError: 'NotReadableError' }));
      await voice.openNovoRegistro();
      await voice.recordButton('registro').click();
      await voice.expectVoiceToast('error', 'Não foi possível iniciar a gravação.');
      await expect(voice.recordButton('registro')).toHaveAttribute('aria-pressed', 'false');
    });

    test('[PAC-VOZ-049] silêncio no modo IA para em 5 s, envia o áudio e 502 não debita', async ({ page, appShell, prontuarioPage }) => {
      ({ mock, voice } = await openTab({ page, appShell, prontuarioPage }, { speech: 'none', stream: 'silent' }));
      mock.reply('clinicalRecord', { status: 502, json: AI_VOICE_ERROR_BODIES.providerFailure });
      await page.clock.install();
      await voice.openNovoRegistro();
      await voice.startRecording('registro');
      await page.clock.fastForward('00:06');
      await expect(voice.recordButton('registro')).toHaveAttribute('aria-pressed', 'false');
      await voice.expectVoiceToast('info', 'Gravação encerrada após 5 segundos sem fala.');
      await mock.waitForCall('clinicalRecord');
      await voice.expectVoiceToast('error', /processar com a IA/);
      await expect(voice.credits('registro')).toHaveText('10 créditos restantes');
    });

    test('[PAC-VOZ-050] ruído contínuo impede o auto-stop; para no tempo máximo', async ({ page, appShell, prontuarioPage }) => {
      ({ mock, voice } = await openTab({ page, appShell, prontuarioPage }, { speech: 'none', stream: 'noise' }));
      mock.setBalance({ json: aiVoiceBalance(10, { max_segundos_gravacao: 10 }) });
      mock.setDefault('clinicalRecord', { json: AI_VOICE_OK.clinicalRecord('Texto.', '', 9) });
      await page.clock.install();
      await voice.openNovoRegistro();
      await voice.startRecording('registro');
      for (let second = 1; second <= 7; second++) {
        await page.waitForTimeout(150);
        await page.clock.runFor(1_000);
      }
      await expect(voice.recordButton('registro')).toHaveAttribute('aria-pressed', 'true');
      await page.clock.fastForward('00:03');
      await expect(voice.recordButton('registro')).toHaveAttribute('aria-pressed', 'false');
      await voice.expectVoiceToast('info', 'Tempo máximo de gravação atingido.');
      await expect(voice.voiceToast('info', 'sem fala')).toHaveCount(0);
    });

    test('[PAC-VOZ-051] sem AudioContext não há auto-stop por silêncio', async ({ page, appShell, prontuarioPage }) => {
      ({ mock, voice } = await openTab({ page, appShell, prontuarioPage }, { speech: 'none', stream: 'silent', noAudioContext: true }));
      await page.clock.install();
      await voice.openNovoRegistro();
      await voice.startRecording('registro');
      await page.clock.fastForward('00:08');
      await expect(voice.timer('registro')).toHaveText('0:08');
      await expect(voice.recordButton('registro')).toHaveAttribute('aria-pressed', 'true');
      await voice.stopRecording('registro');
      await mock.waitForCall('clinicalRecord');
    });

    test('[PAC-VOZ-052] tempo máximo de gravação encerra e envia duração dentro do limite', async ({ page }) => {
      mock.setBalance({ json: aiVoiceBalance(10, { max_segundos_gravacao: 10 }) });
      await page.clock.install();
      await voice.openNovoRegistro();
      await voice.startRecording('registro');
      await page.clock.fastForward('00:09');
      await expect(voice.timer('registro')).toHaveText('0:09');
      await page.clock.fastForward('00:01');
      await expect(voice.recordButton('registro')).toHaveAttribute('aria-pressed', 'false');
      await voice.expectVoiceToast('info', 'Tempo máximo de gravação atingido.');
      const body = await mock.waitForCall('clinicalRecord');
      expect(Number(body.duracao_segundos)).toBeLessThanOrEqual(10);
      await expect(voice.realizado()).toHaveValue('Texto transcrito pela IA.');
    });

    test('[PAC-VOZ-053] duração acima do limite no backend (400) mostra erro sem alterar o texto', async () => {
      mock.reply('clinicalRecord', { status: 400, json: AI_VOICE_ERROR_BODIES.durationExceeded(300) });
      await voice.openNovoRegistro();
      await voice.realizado().fill('texto prévio');
      await voice.startRecording('registro');
      await voice.stopRecording('registro');
      await voice.expectVoiceToast('error', /excede 300 segundos/);
      await expect(voice.realizado()).toHaveValue('texto prévio');
      await expect(voice.credits('registro')).toHaveText('10 créditos restantes');
    });

    test('[PAC-VOZ-054] áudio maior que 15 MB (400) mostra a mensagem', async () => {
      mock.reply('clinicalRecord', { status: 400, json: AI_VOICE_ERROR_BODIES.audioTooBig });
      await voice.openNovoRegistro();
      await voice.startRecording('registro');
      await voice.stopRecording('registro');
      await voice.expectVoiceToast('error', /muito grande/);
      await expect(voice.credits('registro')).toHaveText('10 créditos restantes');
    });

    test('[PAC-VOZ-055] áudio vazio não envia nada e avisa', async ({ page, appShell, prontuarioPage }) => {
      ({ mock, voice } = await openTab({ page, appShell, prontuarioPage }, { speech: 'none', mediaRecorder: 'empty' }));
      await voice.openNovoRegistro();
      await voice.startRecording('registro');
      await voice.stopRecording('registro');
      await voice.expectVoiceToast('warn', 'Nenhum áudio foi captado. Tente gravar novamente.');
      expect(mock.chargedCalls()).toHaveLength(0);
      await expect(voice.credits('registro')).toHaveText('10 créditos restantes');
    });

    test('[PAC-VOZ-124] cancelar durante a gravação paga libera o microfone sem enviar', async ({ page }) => {
      await voice.openNovoRegistro();
      await voice.startRecording('registro');
      await expect.poll(() => voiceStats(page).then((s) => s.liveTracks)).toBe(1);
      await voice.cancelButton('registro').click();
      await expect(voice.dialog('registro')).toBeHidden();
      await expect.poll(() => voiceStats(page).then((s) => s.liveTracks)).toBe(0);
      expect((await voiceStats(page)).trackStops).toBe(1);
      // Reabrir exige um round-trip ao /balance: qualquer POST disparado pelo cancelamento já teria sido registrado.
      const balanceCalls = mock.callsTo('balance').length;
      await voice.openNovoRegistro();
      await expect.poll(() => mock.callsTo('balance').length).toBe(balanceCalls + 1);
      await expect(voice.credits('registro')).toHaveText('10 créditos restantes');
      await expect(voice.recordButton('registro')).toHaveAttribute('aria-pressed', 'false');
      expect(mock.chargedCalls()).toHaveLength(0);
    });

    test('[PAC-VOZ-125] Esc durante a gravação fecha, libera o microfone e não envia', async ({ page }) => {
      test.info().annotations.push({ type: 'fixed', description: 'R34 — paciente-clinical-record-modal.component.html:6-7 closeOnEscape sem efeito com closable=false (Esc não fecha nem encerra a gravação)' });
      await voice.openNovoRegistro();
      await voice.startRecording('registro');
      await page.keyboard.press('Escape');
      await expect(voice.dialog('registro')).toBeHidden({ timeout: 3_000 });
      await expect.poll(() => voiceStats(page).then((s) => s.liveTracks)).toBe(0);
      // Reabrir exige um round-trip ao /balance: qualquer POST disparado pelo Esc já teria sido registrado.
      const balanceCalls = mock.callsTo('balance').length;
      await voice.openNovoRegistro();
      await expect.poll(() => mock.callsTo('balance').length).toBe(balanceCalls + 1);
      await expect(voice.recordButton('registro')).toHaveAttribute('aria-pressed', 'false');
      expect(mock.chargedCalls()).toHaveLength(0);
    });

    test('[PAC-VOZ-127] trocar de rota durante a gravação libera o microfone sem enviar', async ({ page }) => {
      await voice.openNovoRegistro();
      await voice.startRecording('registro');
      await expect.poll(() => voiceStats(page).then((s) => s.liveTracks)).toBe(1);
      await page.evaluate(() => {
        window.history.pushState({}, '', '/agenda');
        window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
      });
      await expect(page).toHaveURL(/\/agenda/, { timeout: 20_000 });
      await expect.poll(() => voiceStats(page).then((s) => s.liveTracks)).toBe(0);
      expect(mock.chargedCalls()).toHaveLength(0);
    });

    test('[PAC-VOZ-138] 500 na gravação paga mostra "Não foi possível transcrever a gravação."', async () => {
      mock.reply('clinicalRecord', { status: 500, json: {} });
      await voice.openNovoRegistro();
      await voice.realizado().fill('texto prévio');
      await voice.startRecording('registro');
      await voice.stopRecording('registro');
      await voice.expectVoiceToast('error', 'Não foi possível transcrever a gravação.');
      await expect(voice.realizado()).toHaveValue('texto prévio');
      await expect(voice.undoButton('registro')).toHaveCount(0);
    });

    test('[PAC-VOZ-152] duplo clique em Gravar antes da permissão abre um único microfone', async ({ page, appShell, prontuarioPage }) => {
      test.info().annotations.push({ type: 'fixed', description: 'R27 — audio-recorder.service.ts:59-81 / ai-voice-assistant.base.ts startServerRecording: duplo clique abre 2 streams e o 1º não é liberado' });
      ({ mock, voice } = await openTab({ page, appShell, prontuarioPage }, { speech: 'none', getUserMediaDelayMs: 800 }));
      mock.setDefault('clinicalRecord', { json: AI_VOICE_OK.clinicalRecord('Texto.', '', 9) });
      await voice.openNovoRegistro();
      await voice.recordButton('registro').dblclick();
      await expect(voice.recordButton('registro')).toHaveAttribute('aria-pressed', 'true');
      await page.waitForTimeout(1_500);
      await voice.recordButton('registro').click();
      await expect(voice.recordButton('registro')).toHaveAttribute('aria-pressed', 'false');
      await mock.waitForCall('clinicalRecord');
      const stats = await voiceStats(page);
      expect(stats.gumCalls, 'getUserMedia chamado mais de uma vez').toBe(1);
      expect(stats.liveTracks, 'microfone continua aberto após parar').toBe(0);
    });

    test('[PAC-VOZ-153] duplo clique em Parar envia uma única gravação', async ({ page }) => {
      await voice.openNovoRegistro();
      await voice.startRecording('registro');
      await voice.recordButton('registro').dblclick();
      await mock.waitForCall('clinicalRecord');
      // Resultado aplicado = fluxo concluído; um 2º envio (ou nova gravação) já teria ocorrido.
      await expect(voice.realizado()).toHaveValue('Texto transcrito pela IA.');
      await expect(voice.credits('registro')).toHaveText('9 créditos restantes');
      expect(mock.callsTo('clinicalRecord')).toHaveLength(1);
      expect((await voiceStats(page)).recorderStarts).toBe(1);
      await expect(voice.recordButton('registro')).toHaveAttribute('aria-pressed', 'false');
    });
  });

  // ------------------------------------------------------------------ Estratégias e fallback
  test.describe('estratégia de transcrição', () => {
    test('[PAC-VOZ-033] sem SpeechRecognition e sem MediaRecorder: gravar desabilitado, Melhorar usável', async ({ page, appShell, prontuarioPage }) => {
      const { voice } = await openTab({ page, appShell, prontuarioPage }, { speech: 'none', mediaRecorder: 'none' });
      await voice.openNovoRegistro();
      await expect(voice.recordButton('registro')).toBeDisabled();
      await voice.realizado().fill('texto digitado');
      await expect(voice.improveButton('registro')).toBeEnabled();
    });

    test('[PAC-VOZ-038] falha do reconhecimento do navegador cai no modo pago', async ({ page, appShell, prontuarioPage }) => {
      const { mock, voice } = await openTab({ page, appShell, prontuarioPage });
      mock.setDefault('clinicalRecord', { json: AI_VOICE_OK.clinicalRecord('Texto IA.', '', 9) });
      await voice.openNovoRegistro();
      await expect(voice.recordButton('registro')).not.toContainText('1 crédito');
      await voice.startRecording('registro');
      await speechError(page, 'network');
      await voice.expectVoiceToast('warn', /O reconhecimento de voz do navegador falhou\. Clique em .* novamente para usar a IA \(consome 1 crédito\)\./);
      await expect(voice.recordButton('registro')).toHaveAttribute('aria-pressed', 'false');
      await expect(voice.recordButton('registro')).toHaveText(/Preencher por voz\s*· 1 crédito/);
      await voice.startRecording('registro');
      expect((await voiceStats(page)).recorderStarts).toBe(1);
      await voice.stopRecording('registro');
      await mock.waitForCall('clinicalRecord');
      await expect(voice.realizado()).toHaveValue('Texto IA.');
    });

    test('[PAC-VOZ-039] toast de fallback cita o botão real "Preencher por voz"', async ({ page, appShell, prontuarioPage }) => {
      test.info().annotations.push({ type: 'fixed', description: 'R22 — ai-voice-assistant.base.ts:394-400 copy do fallback' });
      const { voice } = await openTab({ page, appShell, prontuarioPage });
      await voice.openNovoRegistro();
      await voice.startRecording('registro');
      await speechError(page, 'network');
      await expect(voice.voiceToast('warn').first()).toBeVisible();
      await expect(voice.voiceToast('warn').first()).toContainText('Preencher por voz', { timeout: 3_000 });
    });

    test('[PAC-VOZ-179] SpeechRecognition.start() lançando exceção não deixa a barra presa em "gravando"', async ({ page, appShell, prontuarioPage }) => {
      test.info().annotations.push({
        type: 'fixed',
        description: 'R35 — browser-speech-transcriber.service.ts:91-100 (start retorna true após handleError em startSession:128-132) + ai-voice-assistant.base.ts:297-305 (beginRecordingState após onError): gravação fantasma; Parar mostra "Nenhum áudio foi captado"',
      });
      const { mock, voice } = await openTab({ page, appShell, prontuarioPage }, { speechStartThrows: true });
      await voice.openNovoRegistro();
      await voice.recordButton('registro').click();
      await voice.expectVoiceToast('warn', /O reconhecimento de voz do navegador falhou/);
      await expect(voice.recordButton('registro'), 'gravação fantasma: nada está capturando áudio').toHaveAttribute('aria-pressed', 'false', { timeout: 3_000 });
      await expect(voice.toolbarRoot('registro')).not.toHaveClass(/dc-ai-voice-toolbar--recording/);
      await expect(voice.recordButton('registro')).toHaveText(/Preencher por voz\s*· 1 crédito/);
      await expect(voice.voiceToast('warn', 'Nenhum áudio foi captado')).toHaveCount(0);
      expect(mock.chargedCalls()).toHaveLength(0);
    });

    test('[PAC-VOZ-040] falha do reconhecimento sem MediaRecorder mostra erro', async ({ page, appShell, prontuarioPage }) => {
      const { voice } = await openTab({ page, appShell, prontuarioPage }, { mediaRecorder: 'none' });
      await voice.openNovoRegistro();
      await voice.startRecording('registro');
      await speechError(page, 'network');
      await voice.expectVoiceToast('error', 'O reconhecimento de voz do navegador falhou.');
      await expect(voice.voiceToast('warn')).toHaveCount(0);
      await expect(voice.voiceToast('error').first()).not.toContainText('consome 1 crédito');
      await expect(voice.recordButton('registro')).toHaveAttribute('aria-pressed', 'false');
    });
  });

  // ------------------------------------------------------------------ Mãos livres (sem modelo Vosk real)
  test.describe('Mãos livres', () => {
    test('[PAC-VOZ-111] ligar Mãos livres mostra "Carregando…" e baixa o modelo sem token', async ({ page, appShell, prontuarioPage }) => {
      const { mock, voice } = await openTab({ page, appShell, prontuarioPage });
      const gate = createGate();
      mock.setWakeWordModel({ gate: gate.promise, status: 404, json: { erro: 'Modelo de voz indisponivel.' } });
      await voice.openNovoRegistro();
      await voice.handsFree('registro').click();
      await expect(voice.handsFree('registro')).toHaveText(/Carregando…/);
      await expect(voice.handsFree('registro')).toBeDisabled();
      await expect(voice.handsFree('registro')).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(() => mock.wakeWordModelRequests.length, { timeout: 20_000 }).toBeGreaterThan(0);
      expect(mock.wakeWordModelRequests[0].url).toContain('/api/ai-voice-public/wake-word-model');
      expect(mock.wakeWordModelRequests[0].hasAuthorization).toBe(false);
      gate.release();
      await expect(voice.handsFree('registro')).toHaveText(/Mãos livres/, { timeout: 20_000 });
    });

    test('[PAC-VOZ-116] Mãos livres com microfone negado não baixa o modelo', async ({ page, appShell, prontuarioPage }) => {
      const { mock, voice } = await openTab({ page, appShell, prontuarioPage }, { getUserMediaError: 'NotAllowedError' });
      await voice.openNovoRegistro();
      await voice.handsFree('registro').click();
      await voice.expectVoiceToast(
        'error',
        'Permita o acesso ao microfone no navegador (ícone do cadeado na barra de endereço) para usar o modo mãos livres.'
      );
      await expect(voice.handsFree('registro')).toHaveAttribute('aria-pressed', 'false');
      await expect(voice.handsFree('registro')).toHaveText(/Mãos livres/);
      expect(mock.wakeWordModelRequests).toHaveLength(0);
    });

    test('[PAC-VOZ-117] Mãos livres sem microfone', async ({ page, appShell, prontuarioPage }) => {
      const { voice } = await openTab({ page, appShell, prontuarioPage }, { getUserMediaError: 'NotFoundError' });
      await voice.openNovoRegistro();
      await voice.handsFree('registro').click();
      await voice.expectVoiceToast('error', 'Nenhum microfone disponível para o modo mãos livres.');
      await expect(voice.handsFree('registro')).toHaveAttribute('aria-pressed', 'false');
    });

    test('[PAC-VOZ-118] modelo indisponível (404/429): erro e nova tentativa refaz o download', async ({ page, appShell, prontuarioPage }) => {
      const { mock, voice } = await openTab({ page, appShell, prontuarioPage });
      await voice.openNovoRegistro();
      await voice.handsFree('registro').click();
      await voice.expectVoiceToast(
        'error',
        'Não foi possível carregar o reconhecimento de voz do modo mãos livres. Verifique a conexão e tente novamente.',
        30_000
      );
      await expect(voice.handsFree('registro')).toHaveAttribute('aria-pressed', 'false');
      const firstAttempt = mock.wakeWordModelRequests.length;
      expect(firstAttempt).toBeGreaterThan(0);
      mock.setWakeWordModel({ status: 429, json: { erro: 'Muitas requisicoes.' } });
      await voice.handsFree('registro').click();
      await expect.poll(() => mock.wakeWordModelRequests.length, { timeout: 30_000 }).toBeGreaterThan(firstAttempt);
      await expect(voice.handsFree('registro')).toHaveAttribute('aria-pressed', 'false', { timeout: 30_000 });
    });
  });

  // ------------------------------------------------------------------ Responsividade
  test.describe('responsividade', () => {
    for (const viewport of [
      { id: 'PAC-VOZ-162', width: 375, height: 812, label: 'mobile 375 px' },
      { id: 'PAC-VOZ-163', width: 768, height: 1024, label: 'tablet 768 px' },
    ]) {
      test(`[${viewport.id}] barra íntegra e sem scroll horizontal em ${viewport.label}`, async ({ page, appShell, prontuarioPage }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        const { voice } = await openTab({ page, appShell, prontuarioPage });
        const checkToolbar = async (kind: 'registro' | 'tratamento' | 'finalizar') => {
          const root = voice.toolbarRoot(kind);
          await expect(root).toBeVisible();
          const overflow = await root.evaluate((el) => el.scrollWidth - el.clientWidth);
          expect(overflow, `scroll horizontal na barra (${kind})`).toBeLessThanOrEqual(1);
          const box = await root.boundingBox();
          expect(box && box.x >= 0 && box.x + box.width <= viewport.width + 1, `barra fora da viewport (${kind})`).toBe(true);
          for (const btn of [voice.recordButton(kind), voice.improveButton(kind), voice.credits(kind)]) {
            await btn.scrollIntoViewIfNeeded();
            await expect(btn).toBeInViewport();
          }
        };
        await voice.openNovoRegistro();
        await checkToolbar('registro');
        await voice.startRecording('registro');
        await expect(voice.timer('registro')).toBeVisible();
        await voice.stopRecording('registro');
        await voice.cancelButton('registro').click();

        await prontuarioPage.goToTab(patientId!, 'tratamentos');
        await appShell.dismissBlockingModals();
        await voice.openNovoTratamento();
        await checkToolbar('tratamento');
        await voice.cancelButton('tratamento').click();
        await voice.openFinalizar(treatmentName);
        await checkToolbar('finalizar');
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      });
    }
  });
});
