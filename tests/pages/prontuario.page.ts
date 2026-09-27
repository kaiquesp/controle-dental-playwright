import { expect, type Locator, type Page } from '@playwright/test';
import type { PatientFormTab } from '../data/routes';
import {
  ORCAMENTO_MODAL_OPTIONS,
  PACIENTES_SELECTORS,
  PRONTUARIO_ANAMNESES_SCREEN_MAP,
  PRONTUARIO_ARQUIVOS_SCREEN_MAP,
  PRONTUARIO_CONTRATO_SCREEN_MAP,
  PRONTUARIO_DOCUMENTO_SCREEN_MAP,
  PRONTUARIO_DOCUMENTOS_SCREEN_MAP,
  PRONTUARIO_INFORMACOES_SCREEN_MAP,
  PRONTUARIO_ORCAMENTOS_SCREEN_MAP,
  PRONTUARIO_PAGAMENTOS_SCREEN_MAP,
  PRONTUARIO_PLANO_FICHA_SCREEN_MAP,
  PRONTUARIO_RECEITUARIO_SCREEN_MAP,
  PRONTUARIO_TAB_LABELS,
  PRONTUARIO_TRATAMENTOS_SCREEN_MAP,
} from '../data/pacientes';
import { captureVisibleTexts, expectScreenMap, expectTextsInclude } from '../support/screen-map';
import { closeDialog, editableFields, expectDialogOpen, fillSearchSelect, selectIftaByInputId, visibleDialog } from '../support/interaction-helpers';
import { expectToast } from '../support/toast-helpers';
import { dismissBillingLockUi } from '../support/billing-mocks';

export type OrcamentoCreateOptions = {
  gerarContrato?: boolean;
  aprovarImediato?: boolean;
};

export class ProntuarioPage {
  readonly root: Locator;

  constructor(readonly page: Page) {
    this.root = page.locator(PACIENTES_SELECTORS.formRoot).first();
  }

  async dismissBlockingUi(): Promise<void> {
    await dismissBillingLockUi(this.page);
  }

  async goToTab(patientId: string, tab: PatientFormTab): Promise<void> {
    const urlPattern = new RegExp(`/pacientes/${patientId}/edit/${tab}`);
    const tabSelected = this.page.getByRole('tab', { name: PRONTUARIO_TAB_LABELS[tab], selected: true });

    await this.page.goto(`/pacientes/${patientId}/edit/${tab}`, { waitUntil: 'domcontentloaded' });
    await expect(this.page).toHaveURL(new RegExp(`/pacientes/${patientId}/edit`), { timeout: 30_000 });
    await this.dismissBlockingUi();

    if (urlPattern.test(this.page.url()) && (await tabSelected.isVisible().catch(() => false))) {
      await expect(this.root).toBeVisible({ timeout: 30_000 });
      return;
    }

    await this.page.goto(`/pacientes/${patientId}/edit/informacoes`, { waitUntil: 'domcontentloaded' });
    await expect(this.page).toHaveURL(new RegExp(`/pacientes/${patientId}/edit/informacoes`), { timeout: 30_000 });
    await this.dismissBlockingUi();
    await expect(this.root).toBeVisible({ timeout: 30_000 });

    const tabButton = this.page.getByRole('tab', { name: PRONTUARIO_TAB_LABELS[tab] });
    await expect(tabButton).toBeVisible({ timeout: 15_000 });
    await tabButton.click();
    await expect(this.page).toHaveURL(urlPattern, { timeout: 30_000 });
    await expect(tabSelected).toBeVisible({ timeout: 15_000 });
    await expect(this.root).toBeVisible({ timeout: 30_000 });
  }

  async clickTab(tab: PatientFormTab): Promise<void> {
    const tabButton = this.page.getByRole('tab', { name: PRONTUARIO_TAB_LABELS[tab] });
    if (!(await tabButton.isVisible().catch(() => false))) {
      throw new Error(`Aba ${tab} indisponível`);
    }
    await tabButton.click();
    await expect(this.page).toHaveURL(new RegExp(`/edit/${tab}`), { timeout: 30_000 });
  }

  async expectPatientName(name: string): Promise<void> {
    await expect(this.page.getByText(name).first()).toBeVisible({ timeout: 15_000 });
  }

  async expectInformacoesScreenMap(): Promise<void> {
    await expectScreenMap(this.page, PRONTUARIO_INFORMACOES_SCREEN_MAP);
    await expect(this.page.getByRole('tablist', { name: /Seções do paciente/i })).toBeVisible({ timeout: 15_000 });
    await expect(this.page.getByRole('tab', { name: /^Informações$/i })).toBeVisible();
  }

  async expectPlanoFichaScreenMap(): Promise<void> {
    await expectScreenMap(this.page, PRONTUARIO_PLANO_FICHA_SCREEN_MAP);
  }

  async expectOrcamentosScreenMap(): Promise<void> {
    await expectScreenMap(this.page, PRONTUARIO_ORCAMENTOS_SCREEN_MAP);
  }

  async expectTratamentosScreenMap(): Promise<void> {
    await expectScreenMap(this.page, PRONTUARIO_TRATAMENTOS_SCREEN_MAP);
  }

  async expectReceituarioScreenMap(): Promise<void> {
    await expectScreenMap(this.page, PRONTUARIO_RECEITUARIO_SCREEN_MAP);
  }

  async expectArquivosScreenMap(): Promise<void> {
    await expectScreenMap(this.page, PRONTUARIO_ARQUIVOS_SCREEN_MAP);
  }

  async expectAnamnesesScreenMap(): Promise<void> {
    await expectScreenMap(this.page, PRONTUARIO_ANAMNESES_SCREEN_MAP);
  }

  async expectDocumentosScreenMap(): Promise<void> {
    await expectScreenMap(this.page, PRONTUARIO_DOCUMENTOS_SCREEN_MAP);
  }

  documentoEditor(): Locator {
    return this.page.locator('app-paciente-form-documento-avulso-editor');
  }

  documentoRow(titulo: string): Locator {
    return this.page.locator('li.novo-paciente__doc-card').filter({ hasText: titulo });
  }

  /** Cria um documento avulso pelo editor (Novo Documento → título + conteúdo + profissional → Gerar). */
  async createDocumentoAvulso(titulo: string): Promise<void> {
    await this.dismissBlockingUi();
    const novoBtn = this.page
      .locator('main, app-paciente-form-content')
      .first()
      .getByRole('button', { name: /Novo Documento/i })
      .first();
    await expect(novoBtn).toBeVisible({ timeout: 15_000 });
    await novoBtn.click();

    const editor = this.documentoEditor();
    await expect(editor).toBeVisible({ timeout: 15_000 });

    await editor.locator('#doc-avulso-titulo').fill(titulo);

    const conteudo = editor.locator('.ql-editor');
    await expect(conteudo).toBeVisible({ timeout: 15_000 });
    await conteudo.click();
    await this.page.keyboard.type(`Conteudo E2E do documento ${titulo}.`);

    await selectIftaByInputId(this.page, 'doc-avulso-profissional', /.+/i, editor).catch(
      () => undefined
    );

    // Sem assinatura digital: gera um documento simples e volta direto para a lista.
    for (const label of [/Solicitar assinatura do paciente/i, /Solicitar assinatura do profissional/i]) {
      await editor.getByRole('checkbox', { name: label }).uncheck().catch(() => undefined);
    }

    const gerar = editor.getByRole('button', { name: /Gerar documento/i });
    await expect(gerar).toBeEnabled({ timeout: 15_000 });
    await gerar.click();

    await expectToast(this.page, /Documento gerado/i, 30_000);

    // Fallback: se a assinatura ficou marcada, fecha o modal de links.
    const linksDialog = this.page.getByRole('dialog', { name: /Compartilhar link para assinatura/i });
    if (await linksDialog.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
      await linksDialog.getByRole('button', { name: /Fechar/i }).first().click().catch(() => undefined);
    }
    if (await this.documentoEditor().isVisible().catch(() => false)) {
      await this.documentoEditor().getByRole('button', { name: /^Voltar$/i }).first().click().catch(() => undefined);
    }

    await expect(this.documentoRow(titulo).first()).toBeVisible({ timeout: 20_000 });
  }

  async expectPagamentosScreenMap(): Promise<void> {
    await expectScreenMap(this.page, PRONTUARIO_PAGAMENTOS_SCREEN_MAP);
  }

  orcamentoDialog(): Locator {
    return this.page
      .locator('.p-dialog, [role="dialog"]')
      .filter({ has: this.page.getByRole('button', { name: /Salvar Orçamento|Salvar alterações/i }) })
      .last();
  }

  /** Espera o refresh (GET) da lista de orçamentos após uma alteração, para evitar checar a linha desatualizada. */
  async waitForOrcamentosReload(): Promise<void> {
    await this.page
      .waitForResponse(
        (res) => res.request().method() === 'GET' && /orcamento/i.test(res.url()) && res.status() < 500,
        { timeout: 15_000 }
      )
      .catch(() => undefined);
  }

  async openNovoOrcamento(): Promise<Locator> {
    const btn = this.page.getByRole('button', { name: /Novo orçamento|Novo Orçamento|Criar orçamento/i }).first();
    await expect(btn).toBeVisible({ timeout: 15_000 });
    await btn.click();
    return expectDialogOpen(this.page, /orçamento|procedimento|valor/i);
  }

  async fillOrcamentoBasico(descricao: string, valor = '150,00'): Promise<void> {
    const dialog = this.orcamentoDialog();
    await selectIftaByInputId(this.page, 'orc-catalog-procedure', /.+/i, dialog).catch(() =>
      fillSearchSelect(this.page, 'orc-catalog-procedure', 'consulta', dialog)
    );

    const tituloField = dialog.locator('#orc-modal-titulo');
    if (await tituloField.isVisible().catch(() => false)) {
      await tituloField.fill(descricao);
    }

    const obsField = dialog
      .locator('#orc-modal-condicoes, #orc-obs, textarea[name*="obs" i]')
      .or(editableFields(dialog))
      .first();
    if (await obsField.isVisible().catch(() => false)) {
      await obsField.fill(descricao);
    }

    const valorField = dialog.locator('input[placeholder*="valor" i], input[name*="valor" i], #orc-valor').first();
    if (await valorField.isVisible().catch(() => false)) {
      await valorField.fill(valor);
    }
  }

  async setOrcamentoOptions(options: OrcamentoCreateOptions): Promise<void> {
    const dialog = this.orcamentoDialog();
    if (options.gerarContrato) {
      const chk = dialog.getByLabel(ORCAMENTO_MODAL_OPTIONS.gerarContrato).or(
        dialog.getByText(ORCAMENTO_MODAL_OPTIONS.gerarContrato)
      );
      if (await chk.first().isVisible().catch(() => false)) {
        await chk.first().click();
      }
    }
    if (options.aprovarImediato) {
      const chk = dialog.getByLabel(ORCAMENTO_MODAL_OPTIONS.aprovarImediato).or(
        dialog.getByText(ORCAMENTO_MODAL_OPTIONS.aprovarImediato)
      );
      if (await chk.first().isVisible().catch(() => false)) {
        await chk.first().click();
      }
    }
  }

  async saveOrcamento(): Promise<void> {
    const dialog = this.orcamentoDialog();
    const save = dialog.getByRole('button', { name: /Salvar Orçamento/i });
    await expect(save).toBeEnabled({ timeout: 15_000 });
    const saveResponse = this.page
      .waitForResponse(
        (res) =>
          ['POST', 'PUT', 'PATCH'].includes(res.request().method()) &&
          res.url().includes('/api/') &&
          res.status() < 400,
        { timeout: 30_000 }
      )
      .catch(() => null);
    await Promise.all([saveResponse, save.click()]);
    await expect(dialog).toBeHidden({ timeout: 25_000 });
  }

  orcamentoRow(descricao: string): Locator {
    return this.page
      .locator('tr, article, [role="group"], .p-datatable-row, [class*="orcamento"]')
      .filter({ hasText: descricao });
  }

  async aprovarOrcamentoNaLista(descricao: string): Promise<void> {
    const row = this.orcamentoRow(descricao);
    await expect(row.first()).toBeVisible({ timeout: 20_000 });
    await row.first().getByRole('button', { name: /^Aprovar$/i }).first().click();
    await expect(this.page.getByText(/aprovado|sucesso/i).first()).toBeVisible({ timeout: 15_000 }).catch(() => undefined);
  }

  async openOrcamentoRowMenu(row: Locator): Promise<void> {
    const menuBtn = row
      .getByRole('button', { name: /ações|opções|mais|menu|abrir menu/i })
      .or(row.locator('button.p-button-icon-only, button[class*="icon"], button[aria-haspopup="menu"]'))
      .or(row.getByRole('button').filter({ hasNotText: /^Aprovar$/i }))
      .last();
    await expect(menuBtn).toBeVisible({ timeout: 10_000 });
    await menuBtn.click();
    await expect(this.page.getByRole('menuitem').first()).toBeVisible({ timeout: 5_000 });
  }

  private async confirmDestructiveAction(): Promise<void> {
    const confirm = this.page
      .locator('[role="alertdialog"]:visible, [role="dialog"]:visible')
      .filter({ hasText: /excluir|confirmar|remover|tem certeza/i })
      .last();
    if (!(await confirm.isVisible({ timeout: 8_000 }).catch(() => false))) return;
    await confirm.getByRole('button', { name: /Excluir|Confirmar|Sim|OK/i }).last().click();
    await expect(confirm).toBeHidden({ timeout: 15_000 });
  }

  async editarOrcamento(descricao: string, novoTexto: string): Promise<void> {
    const row = this.orcamentoRow(descricao);
    await expect(row.first()).toBeVisible({ timeout: 20_000 });
    const editBtn = row.first().getByRole('button', { name: /^Editar$/i });
    if (await editBtn.isVisible().catch(() => false)) {
      await editBtn.click();
    } else {
      await this.openOrcamentoRowMenu(row.first());
      await this.page.getByRole('menuitem', { name: /^Editar$/i }).click();
    }
    await expectDialogOpen(this.page, /editar orçamento|orçamento/i);

    const dialog = this.page
      .getByRole('dialog', { name: /Editar orçamento/i })
      .or(this.orcamentoDialog())
      .last();

    const nomeField = dialog.getByRole('textbox', { name: /Nome \/ Descrição do Orçamento/i });
    const tituloField = dialog.locator('#orc-modal-titulo');
    if (await nomeField.isVisible().catch(() => false)) {
      await nomeField.fill(novoTexto);
    } else if (await tituloField.isVisible().catch(() => false)) {
      await tituloField.fill(novoTexto);
    } else {
      throw new Error('Campo de nome/descrição do orçamento não encontrado para edição');
    }

    // A lista de orçamentos pode exibir observações/condições em vez do título — mantém os dois em sincronia,
    // igual ao preenchimento inicial em fillOrcamentoBasico, para que a linha reflita o novo texto.
    const obsField = dialog.locator('#orc-modal-condicoes, #orc-obs, textarea[name*="obs" i]').first();
    if (await obsField.isVisible().catch(() => false)) {
      await obsField.fill(novoTexto);
    }

    const save = dialog.getByRole('button', { name: /Salvar alterações|Salvar Orçamento|Salvar|Atualizar/i });
    await expect(save).toBeEnabled({ timeout: 15_000 });
    const saveResponse = this.page.waitForResponse(
      (res) =>
        ['POST', 'PUT', 'PATCH'].includes(res.request().method()) &&
        /orcamento/i.test(res.url()) &&
        res.status() < 400,
      { timeout: 20_000 }
    );
    await save.click();
    const response = await saveResponse;
    expect(response.ok(), `salvar edição do orçamento falhou (${response.status()})`).toBeTruthy();
    await expect(dialog).toBeHidden({ timeout: 25_000 });
    await this.waitForOrcamentosReload();
  }

  async excluirOrcamento(descricao: string): Promise<void> {
    const row = this.orcamentoRow(descricao);
    await expect(row.first()).toBeVisible({ timeout: 20_000 });

    const toggle = row.first().getByText(/^>\s*/).first();
    if (await toggle.isVisible().catch(() => false)) {
      await toggle.click();
    }

    const deleteBtn = row.first().getByRole('button', { name: /^Excluir$/i });
    if (await deleteBtn.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
      await deleteBtn.first().click();
    } else {
      await this.openOrcamentoRowMenu(row.first());
      const excluirItem = this.page.getByRole('menuitem', { name: /Excluir|Remover/i });
      if (await excluirItem.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
        await excluirItem.first().click();
      } else {
        await this.page.getByRole('menuitem', { name: /^Editar$/i }).click();
        const dialog = this.orcamentoDialog();
        await expect(dialog).toBeVisible({ timeout: 10_000 });
        const footerDelete = dialog.getByRole('button', { name: /Excluir|Remover/i });
        if (!(await footerDelete.first().isVisible({ timeout: 5_000 }).catch(() => false))) {
          throw new Error('Excluir orçamento indisponível na UI');
        }
        await footerDelete.first().click();
      }
    }

    const confirm = this.page
      .locator('[role="alertdialog"]:visible, [role="dialog"]:visible')
      .filter({ hasText: /orçamento|excluir|confirmar|remover/i })
      .last();
    if (await confirm.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await confirm.getByRole('button', { name: /Excluir|Sim|Confirmar/i }).last().click();
      await expect(confirm).toBeHidden({ timeout: 15_000 });
    }
    await expect(row).toHaveCount(0, { timeout: 20_000 });
  }

  async excluirArquivo(name: string): Promise<void> {
    const card = this.arquivoRow(name).first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    const deleteBtn = card
      .getByRole('button', { name: /Excluir|Remover|Delete/i })
      .or(card.locator('button[aria-label*="excluir" i], button[title*="excluir" i]'))
      .or(card.getByRole('button').last());
    await deleteBtn.first().click();

    const confirm = this.page
      .locator('[role="alertdialog"]:visible')
      .filter({ hasText: /Excluir arquivo|excluir|confirmar/i });
    await expect(confirm).toBeVisible({ timeout: 10_000 });
    await confirm.getByRole('button', { name: /Excluir|Sim|Confirmar/i }).last().click();
    await expect(card).toBeHidden({ timeout: 20_000 });
  }

  async openVisualizarContrato(descricao: string): Promise<string[]> {
    const row = this.orcamentoRow(descricao);
    await row.first().getByRole('button', { name: /Visualizar contrato/i }).click();
    const dialog = await expectDialogOpen(this.page, PRONTUARIO_CONTRATO_SCREEN_MAP.headings![0]);
    await expectScreenMap(this.page, PRONTUARIO_CONTRATO_SCREEN_MAP, dialog);
    const texts = await captureVisibleTexts(this.page, dialog);
    await closeDialog(this.page);
    return texts;
  }

  async openAbrirDocumento(descricao: string): Promise<string[]> {
    const row = this.orcamentoRow(descricao);
    await row.first().getByRole('button', { name: /Abrir documento/i }).first().click();
    const dialog = await expectDialogOpen(this.page, PRONTUARIO_DOCUMENTO_SCREEN_MAP.headings![0]);
    await expectScreenMap(this.page, PRONTUARIO_DOCUMENTO_SCREEN_MAP, dialog);
    const texts = await captureVisibleTexts(this.page, dialog);
    await closeDialog(this.page);
    return texts;
  }

  async expectContratoTexts(texts: string[], patientName: string): Promise<void> {
    await expectTextsInclude(texts, [new RegExp(patientName.slice(0, 8), 'i'), /contrato|orçamento/i]);
  }

  async openNovoTratamento(): Promise<void> {
    const btn = this.page
      .locator('main, app-paciente-form-content')
      .first()
      .getByRole('button', { name: /Novo tratamento/i })
      .first();
    await expect(btn).toBeVisible({ timeout: 15_000 });
    await btn.click();
    await expectDialogOpen(this.page, /tratamento|procedimento|dente/i);
  }

  /**
   * Cria um tratamento clínico básico vinculado ao dente 11 (com uma face) e
   * retorna o nome do procedimento escolhido — a lista identifica a linha por ele.
   */
  async createTratamentoBasico(descricao: string): Promise<string> {
    await this.dismissBlockingUi();
    await this.openNovoTratamento();
    const dialog = this.page
      .locator('.p-dialog, [role="dialog"]')
      .filter({ has: this.page.getByRole('button', { name: /Adicionar tratamento/i }) })
      .last();

    const proc = dialog.locator('#trat-modal-proc');
    let procedimento = '';
    for (const term of ['Limpeza', 'Avaliação', 'Restauração', 'Extração', 'Consulta', 'Profilaxia', 'a']) {
      await proc.fill(term);
      await this.page.waitForTimeout(600);
      const option = this.page
        .locator(
          '.pf-trat-clin-modal__proc-dropdown button, .p-autocomplete-option, .p-autocomplete-item, [role="option"]'
        )
        .first();
      if (await option.isVisible().catch(() => false)) {
        // O botão do dropdown traz "Nome\nCódigo: ..."; a lista mostra só o nome.
        procedimento = (await option.innerText()).trim().split('\n')[0].trim();
        await option.click();
        break;
      }
    }
    if (!procedimento) {
      throw new Error('Nenhum procedimento encontrado no catálogo da clínica');
    }

    // Vincula dente + face para o tratamento aparecer pintado no odontograma.
    const toothGroup = dialog.getByRole('group', { name: 'Dente' });
    const tooth = toothGroup
      .getByRole('button', { name: /^11$/ })
      .or(toothGroup.getByRole('button').first());
    await tooth.first().click({ timeout: 5_000 }).catch(() => undefined);
    await dialog
      .getByRole('group', { name: 'Faces' })
      .getByRole('button')
      .first()
      .click({ timeout: 3_000 })
      .catch(() => undefined);

    const detalhes = dialog.locator('#trat-modal-detalhes, #trat-modal-obs');
    if (await detalhes.first().isVisible().catch(() => false)) {
      await detalhes.first().fill(descricao);
    }

    const save = this.page.getByRole('button', { name: /^Adicionar tratamento$/i });
    await expect(save).toBeVisible({ timeout: 15_000 });
    const saveResponse = this.page
      .waitForResponse(
        (res) =>
          ['POST', 'PUT', 'PATCH'].includes(res.request().method()) &&
          res.url().includes('/api/') &&
          res.status() < 400,
        { timeout: 30_000 }
      )
      .catch(() => null);
    await Promise.all([saveResponse, save.click()]);
    await expect(this.tratamentoRow(procedimento).first()).toBeVisible({ timeout: 20_000 });
    return procedimento;
  }

  tratamentoRow(texto: string): Locator {
    return this.page
      .locator('.pf-trat-tab__row, article, tr')
      .filter({ hasText: texto });
  }

  /** Abre o menu "⋮" de uma linha de tratamento e devolve o `role="menu"`. */
  async openTratamentoRowMenu(texto: string): Promise<Locator> {
    const row = this.tratamentoRow(texto).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.getByRole('button', { name: /Mais opções do tratamento/i }).click();
    const menu = row.getByRole('menu').first();
    await expect(menu).toBeVisible({ timeout: 10_000 });
    return menu;
  }

  async expectOdontogramaMarcado(): Promise<void> {
    await expect(
      this.page
        .locator(
          [
            '.odonto [class*="face--em_aberto"]',
            '.odonto [class*="face--finalizado"]',
            '.odonto [class*="coroa-btn--em_aberto"]',
            '.odonto [class*="coroa-btn--finalizado"]',
          ].join(', ')
        )
        .first()
    ).toBeVisible({ timeout: 15_000 });
  }

  annotationsPanel(): Locator {
    return this.page.locator('app-paciente-chart-annotations, .chart-notes').first();
  }

  async expectAnnotationsPanel(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: /^Anotações$/ })).toBeVisible({ timeout: 20_000 });
    await expect(this.annotationsPanel()).toBeVisible({ timeout: 20_000 });
  }

  async selectToothForAnnotation(fdi: number): Promise<void> {
    const crown = this.page.getByRole('button', { name: new RegExp(`Dente ${fdi}\\b`) }).first();
    await expect(crown).toBeVisible({ timeout: 20_000 });
    await crown.click();
    await expect(this.page.locator('.chart-notes__target')).toHaveText(new RegExp(`Dente ${fdi}`));
  }

  annotationNoteField(): Locator {
    return this.page.locator('#chart-annotation-note, textarea#chart-annotation-note').first();
  }

  async openReceituarioTipo(tipo: RegExp): Promise<Locator> {
    const btn = this.page.getByRole('button', { name: tipo }).first();
    await expect(btn).toBeVisible({ timeout: 15_000 });
    await btn.click();
    return expectDialogOpen(this.page, tipo);
  }

  async uploadArquivo(filePath: string): Promise<void> {
    await this.dismissBlockingUi();
    const panel = this.page.getByRole('tabpanel', { name: /Arquivos/i });
    const uploadBtn = panel.getByRole('button', { name: /Fazer Upload/i }).first();
    await expect(uploadBtn).toBeVisible({ timeout: 15_000 });
    await uploadBtn.click();

    const dialog = this.page.getByRole('dialog').filter({ hasText: /Enviar arquivos/i });
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    const dropzone = dialog.locator('[class*="upload"], [class*="drop"], label').filter({ hasText: /Arraste|selecionar/i }).first();
    const input = dialog.locator('input[type="file"]');

    const chooserPromise = this.page.waitForEvent('filechooser', { timeout: 8_000 }).catch(() => null);
    await dropzone.click();
    const chooser = await chooserPromise;
    if (chooser) {
      await chooser.setFiles(filePath);
    } else {
      await input.setInputFiles(filePath);
    }
    await input.evaluate((el) => {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const confirm = dialog.getByRole('button', { name: /^Enviar arquivos$/i });
    await expect(confirm).toBeEnabled({ timeout: 15_000 });
    await confirm.click();
    await expect(this.arquivoRow('e2e-sample').first()).toBeVisible({ timeout: 30_000 });
  }

  async createAnamneseBasica(titulo: string): Promise<void> {
    await this.dismissBlockingUi();
    const btn = this.page.getByRole('button', { name: /Nova anamnese|Criar primeira anamnese/i }).first();
    await btn.click();

    const dadosFicha = this.page.getByRole('button', { name: /Dados da ficha/i });
    if (await dadosFicha.isVisible().catch(() => false)) {
      await dadosFicha.click();
    }

    await selectIftaByInputId(this.page, 'anam-modelo', /.+/i).catch(async () => {
      const modelo = this.page.locator('#anam-modelo');
      if (await modelo.isVisible().catch(() => false)) {
        await modelo.click({ force: true });
        await this.page.locator('[role="option"], .p-select-option').first().click({ timeout: 5_000 }).catch(() => undefined);
      }
    });

    const questionario = this.page.getByRole('button', { name: /^Questionário$/i });
    if (await questionario.isVisible().catch(() => false)) {
      await questionario.click();
    }

    const queixa = this.page.locator('#anam-queixa');
    await expect(queixa).toBeVisible({ timeout: 15_000 });
    await queixa.fill(titulo);

    const obs = this.page.locator('#anam-obs-inicial');
    if (await obs.isVisible().catch(() => false)) {
      await obs.fill(`Observação E2E ${titulo}`);
    }

    const save = this.page.getByRole('button', { name: /Salvar anamnese/i });
    if (await save.isDisabled().catch(() => true)) {
      throw new Error('Formulário de anamnese inválido: selecione um modelo de anamnese antes de salvar');
    }

    await save.click();
    await expect(this.page.getByText(titulo).first()).toBeVisible({ timeout: 25_000 });
  }

  arquivoRow(name: string): Locator {
    const panel = this.page.getByRole('tabpanel', { name: /Arquivos/i });
    return panel.locator('article, [class*="file"], [class*="card"]').filter({ hasText: name });
  }

  async openNovaAnamnese(): Promise<void> {
    const btn = this.page.getByRole('button', { name: /Nova anamnese/i }).first();
    await expect(btn).toBeVisible({ timeout: 15_000 });
    await btn.click();
    await expectDialogOpen(this.page, /anamnese|modelo/i);
  }

  pagamentoRow(descricao: string): Locator {
    return this.page.locator('tr, article, [class*="pagamento"], [class*="lancamento"]').filter({ hasText: descricao });
  }

  async addPagamentoManual(descricao: string, valor: string): Promise<void> {
    const btn = this.page.getByRole('button', { name: /Novo lançamento|Adicionar|Nova receita|Nova despesa/i }).first();
    await expect(btn).toBeVisible({ timeout: 15_000 });
    await btn.click();
    const dialog = await expectDialogOpen(this.page, /lançamento|pagamento|valor/i);
    await editableFields(dialog).first().fill(descricao);
    const valorField = dialog.locator('input[placeholder*="valor" i], input[name*="valor" i]').first();
    if (await valorField.isVisible().catch(() => false)) {
      await valorField.fill(valor);
    }
    await dialog.getByRole('button', { name: /Salvar|Criar|Confirmar/i }).click();
    await expect(dialog).toBeHidden({ timeout: 20_000 });
  }

  pagamentoConfirmDialog(): Locator {
    return this.page.locator('.patient-payment-confirm-dialog:visible, [role="alertdialog"]:visible').filter({
      hasText: /Confirmar pagamento/i,
    });
  }

  posChargeDialog(): Locator {
    // Evita strict mode: o host <p-dialog> e o painel <div.p-dialog> compartilham
    // `role="dialog"` e nome acessível; fica só com o painel real.
    return this.page
      .getByRole('dialog', { name: /Cobrar na maquininha/i })
      .and(this.page.locator('.p-dialog'));
  }

  async openPagarOnRow(descricao: string): Promise<Locator> {
    const row = this.pagamentoRow(descricao);
    await expect(row.first()).toBeVisible({ timeout: 20_000 });
    await row.getByRole('button', { name: /^Pagar$/i }).click();
    const dialog = this.pagamentoConfirmDialog();
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    return dialog;
  }

  async chooseCanalMaquininha(): Promise<void> {
    await selectIftaByInputId(this.page, 'pag-confirm-canal', /Na maquininha/i, this.pagamentoConfirmDialog());
  }

  async confirmCobrarNaMaquininha(): Promise<Locator> {
    await this.pagamentoConfirmDialog().getByRole('button', { name: /Cobrar na maquininha/i }).click();
    const charge = this.posChargeDialog();
    await expect(charge).toBeVisible({ timeout: 15_000 });
    return charge;
  }

  async expectNoPaginatorOnTab(): Promise<void> {
    await expect(this.page.locator('.novo-paciente__prontuario-paginator, .p-paginator')).toHaveCount(0);
  }
}
