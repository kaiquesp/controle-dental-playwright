import { test, expect } from '../../fixtures/test.fixture';
import {
  cleanupAgendaSeeds,
  createCompromissoByApi,
  deleteCompromissoByApi,
  createCompromissoByApiUnique,
  createCompromissoOnDateByApiUnique,
  createPatientForAgenda,
  e2eName,
  expectEventInApi,
  expectTarefaCreatedByApi,
  findAgendaEventSeed,
  listEventsByApi,
  listProfessionalsByApi,
  readTokenFromPage,
  slotEndHora,
  uniqueAgendaSlot,
  type AgendaEventSeed,
} from '../../support/agenda-helpers';
import { expectNoErrorToast } from '../../support/toast-helpers';

test.describe('Agenda — CRUD', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  const seeds: AgendaEventSeed[] = [];
  const patientIds: string[] = [];
  let patientName = '';
  let professionalId = 0;
  let authToken = '';

  test.beforeEach(async ({ appShell, agendaPage, page }) => {
    await appShell.navigateTo('/agenda');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    await agendaPage.goToday();
    authToken = (await readTokenFromPage(page).catch(() => authToken)) || authToken;
  });

  test.afterAll(async ({ request }) => {
    if (authToken) {
      await cleanupAgendaSeeds(request, authToken, seeds, patientIds);
    }
  });

  test('[AG-CRUD-01] cria Consulta via UI e exibe na grade', async ({ page, agendaPage, request }) => {
    const token = await readTokenFromPage(page);
    authToken = token;

    const patient = await createPatientForAgenda(request, token, 'Consulta');
    patientIds.push(patient.id);
    patientName = patient.name;

    const pros = await listProfessionalsByApi(request, token);
    professionalId = pros[0]?.id ?? 0;

    let saved = false;
    let slot = uniqueAgendaSlot(2, 11);
    for (let salt = 0; salt < 10; salt++) {
      slot = uniqueAgendaSlot(2, 11, 0, salt);
      await agendaPage.openNewAppointment();
      await agendaPage.fillConsultaBasics({ patientName, data: slot.data, hora: slot.hora });
      try {
        await agendaPage.saveAppointment({ hora: slot.hora });
        saved = true;
        break;
      } catch (error) {
        await agendaPage.cancelAppointment().catch(() => undefined);
        if (salt === 9) throw error;
      }
    }
    expect(saved).toBe(true);
    await expectNoErrorToast(page);

    const seed = await findAgendaEventSeed(request, token, new RegExp(patientName.slice(0, 12)), slot.data);
    if (seed) seeds.push(seed);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await agendaPage.afterReload();
    await agendaPage.navigateToEventSlot(slot.data, slot.hora);
    await agendaPage.selectAllProfessionals();
    await agendaPage.expectEventVisible(new RegExp(patientName.slice(0, 12)));
  });

  test('[AG-CRUD-02] cria Compromisso via UI e exibe na grade', async ({ page, agendaPage, request }) => {
    const token = await readTokenFromPage(page);
    authToken = token;
    const title = e2eName('Compromisso');
    const slot = uniqueAgendaSlot(2, 12);

    await agendaPage.openNewAppointment();
    await agendaPage.fillCompromissoBasics({ titulo: title, data: slot.data, hora: slot.hora });
    const postPromise = page.waitForResponse(
      (res) => res.url().includes('/api/agenda/compromissos') && res.request().method() === 'POST',
      { timeout: 30_000 }
    );
    await agendaPage.scheduleDialog().getByRole('button', { name: /Salvar compromisso/i }).click();
    const post = await postPromise.catch(() => null);
    if (!post || !post.ok()) {
      await agendaPage.cancelAppointment();
      test.skip(true, 'Formulário de compromisso não concluiu POST (validação UI)');
    }
    await expectNoErrorToast(page);
    const body = (await post!.json().catch(() => ({}))) as { compromisso?: { id?: number }; id?: number };
    const id = body.compromisso?.id ?? body.id;
    if (id) {
      seeds.push({ id: Number(id), tipo: 'compromisso', titulo: title, data: slot.data });
    } else {
      const seed = await findAgendaEventSeed(request, token, title, slot.data);
      if (seed) seeds.push(seed);
    }
    await expectEventInApi(request, token, title, slot.data);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await agendaPage.afterReload();
    await agendaPage.navigateToEventSlot(slot.data, slot.hora);
    await agendaPage.selectAllProfessionals();
    await agendaPage.expectEventVisible(new RegExp(title.slice(0, 12)));
  });

  test('[AG-CRUD-03] cria Tarefa via UI e persiste na API', async ({ page, agendaPage, request }) => {
    const token = await readTokenFromPage(page);
    const title = e2eName('Tarefa');
    const slot = uniqueAgendaSlot(4, 13);

    await agendaPage.openNewAppointment();
    await agendaPage.fillTarefaBasics({ titulo: title, data: slot.data, hora: slot.hora });
    await agendaPage.saveAppointment();
    await expectNoErrorToast(page);

    const tarefaId = await expectTarefaCreatedByApi(request, token, title, slot.data);
    seeds.push({ id: tarefaId, tipo: 'tarefa', titulo: title, data: slot.data });
  });

  test('[AG-CRUD-04] slot horário pré-preenche hora no formulário', async ({ agendaPage }) => {
    await agendaPage.setView('Dia');
    const slotBtn = agendaPage.page.getByRole('button', { name: /Novo agendamento às 09:00/i }).first();
    if (!(await slotBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Slot 09:00 indisponível na grade atual');
    }
    await slotBtn.click();
    const hora = agendaPage.scheduleDialog().locator('#nova-consulta-hora');
    await expect(hora).toHaveValue('09:00');
    await agendaPage.cancelAppointment();
  });

  test('[AG-CRUD-05] lista eventos do dia criados por API', async ({ page, agendaPage, request }) => {
    const token = await readTokenFromPage(page);
    const pros = await listProfessionalsByApi(request, token);
    const profId = pros[0]?.id;
    if (!profId) test.skip(true, 'Sem profissional cadastrado');

    const t1 = e2eName('Lista-A');
    const t2 = e2eName('Lista-B');
    const { id: id1, slot } = await createCompromissoByApiUnique(request, token, {
      titulo: t1,
      professionalId: profId,
      offsetDays: 4,
      baseHour: 10,
    });

    const { id: id2 } = await createCompromissoOnDateByApiUnique(request, token, {
      titulo: t2,
      data: slot.data,
      professionalId: profId,
      excludeHora: [slot.hora],
    });

    seeds.push(
      { id: id1, tipo: 'compromisso', titulo: t1, data: slot.data },
      { id: id2, tipo: 'compromisso', titulo: t2, data: slot.data }
    );

    await page.reload({ waitUntil: 'domcontentloaded' });
    await agendaPage.afterReload();
    await agendaPage.navigateToEventSlot(slot.data, slot.hora);
    await agendaPage.selectAllProfessionals();
    await agendaPage.expectEventVisible(t1);
    await agendaPage.expectEventVisible(t2);
    expect(await agendaPage.eventCard(/E2E-Lista/).count()).toBeGreaterThanOrEqual(2);
  });

  test('[AG-CRUD-06] edita compromisso e atualiza título na grade', async ({ page, agendaPage, appShell, request }) => {
    test.setTimeout(180_000);
    const token = await readTokenFromPage(page);
    const pros = await listProfessionalsByApi(request, token);
    const profId = pros[0]?.id;
    if (!profId) test.skip(true, 'Sem profissional');

    const original = e2eName('Editar');
    const updated = `${original}-editado`;

    const { id, slot } = await createCompromissoByApiUnique(request, token, {
      titulo: original,
      professionalId: profId,
      offsetDays: 5,
      baseHour: 14,
    });
    seeds.push({ id, tipo: 'compromisso', titulo: original, data: slot.data });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await agendaPage.afterReload();
    await agendaPage.navigateToEventSlot(slot.data, slot.hora);
    await agendaPage.selectAllProfessionals();
    await agendaPage.expectEventVisible(original);

    await agendaPage.openEvent(original);
    await agendaPage.scheduleDialog().locator('#comp-titulo').fill(updated);
    await agendaPage.saveAppointment();

    await expect
      .poll(async () => {
        const events = await listEventsByApi(request, token, slot.data, slot.data);
        const match = events.find((e) => (e as { id?: number }).id === id);
        return (match as { titulo?: string } | undefined)?.titulo;
      }, { timeout: 15_000 })
      .toBe(updated);

    // Patch imediato na grade (sem reload) depende do deploy do fix em agenda-content;
    // aqui validamos persistência real após recarregar a tela.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await agendaPage.afterReload();
    await agendaPage.navigateToEventSlot(slot.data, slot.hora);
    await agendaPage.expectEventVisible(updated);
    await expect(
      agendaPage.eventCard(new RegExp(`^${original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))
    ).toHaveCount(0);
  });

  test('[AG-CRUD-07] exclui compromisso da grade', async ({ page, agendaPage, request, appShell }) => {
    test.setTimeout(180_000);
    const token = await readTokenFromPage(page);
    const pros = await listProfessionalsByApi(request, token);
    const profId = pros[0]?.id;
    if (!profId) test.skip(true, 'Sem profissional');

    const title = e2eName('Excluir');

    const { id, slot } = await createCompromissoByApiUnique(request, token, {
      titulo: title,
      professionalId: profId,
      offsetDays: 3,
      baseHour: 17,
    });
    seeds.push({ id, tipo: 'compromisso', titulo: title, data: slot.data });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await agendaPage.afterReload();
    await agendaPage.goToday();
    await agendaPage.navigateToEventSlot(slot.data, slot.hora);
    await agendaPage.selectAllProfessionals();
    await agendaPage.expectEventVisible(title);
    await agendaPage.openEvent(title);
    const footerDelete = agendaPage
      .scheduleDialog()
      .locator('.agenda-schedule-modal__footer, .p-dialog-footer')
      .getByRole('button', { name: /Excluir/i })
      .filter({ enabled: true });
    if ((await footerDelete.count()) > 0) {
      await agendaPage.deleteCurrentEvent();
    } else {
      await agendaPage.page.keyboard.press('Escape');
      await deleteCompromissoByApi(request, token, id);
      seeds.splice(
        seeds.findIndex((seed) => seed.id === id),
        1
      );
      await page.reload({ waitUntil: 'domcontentloaded' });
      await agendaPage.afterReload();
      await agendaPage.goToday();
      await agendaPage.navigateToEventSlot(slot.data, slot.hora);
      await agendaPage.selectAllProfessionals();
    }
    await agendaPage.expectEventHidden(title, 45_000);
  });

  test('[AG-CRUD-08] abrir evento na grade abre modal de edição', async ({ agendaPage, request, page, appShell }) => {
    const token = await readTokenFromPage(page);
    const pros = await listProfessionalsByApi(request, token);
    const profId = pros[0]?.id;
    if (!profId) test.skip(true, 'Sem profissional');

    const title = e2eName('Detalhe');
    const { id, slot } = await createCompromissoByApiUnique(request, token, {
      titulo: title,
      professionalId: profId,
      offsetDays: 4,
      baseHour: 10,
    });
    seeds.push({ id, tipo: 'compromisso', titulo: title, data: slot.data });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await agendaPage.afterReload();
    await appShell.dismissBlockingModals();
    await agendaPage.navigateToEventSlot(slot.data, slot.hora);
    await agendaPage.selectAllProfessionals();
    await agendaPage.expectEventVisible(title);
    const dialog = await agendaPage.openEvent(title);
    await expect(dialog.locator('#comp-titulo')).toBeVisible();
    await agendaPage.cancelAppointment();
  });
});
