export const AGENDA_VIEWS = ['Dia', 'Semana', 'Mês'] as const;
export type AgendaView = (typeof AGENDA_VIEWS)[number];

export const AGENDA_EVENT_TABS = ['Consulta', 'Compromisso', 'Tarefa'] as const;
export type AgendaEventTab = (typeof AGENDA_EVENT_TABS)[number];

export const AGENDA_STATUSES = [
  'Confirmado',
  'Aguardando',
  'Atendido',
  'Cancelado',
  'Faltou',
] as const;

export const AGENDA_SELECTORS = {
  screen: '.agenda-screen, app-agenda-content',
  eventCard: '.agenda-screen__event-card',
  scheduleModalActiveTab: '.agenda-schedule-modal__tab--active',
  scheduleDialog: '.agenda-schedule-dialog.p-dialog:visible, .agenda-schedule-dialog[role="dialog"]:visible',
  consultaDetailsDialog: '.agenda-detalhe-dialog.p-dialog:visible, [role="dialog"]:has(.agenda-detalhe)',
  profFilter: '.agenda-screen__grade-prof-select',
  profPanel: '#agenda-grade-profissionais-panel',
  gradeViewPanel: '#agenda-grade-view-options-panel, [aria-label="Visualização da agenda"]',
} as const;

export const AGENDA_FORM_IDS = {
  consulta: {
    profissional: 'nova-consulta-prof',
    paciente: 'nova-consulta-paciente',
    sala: 'nova-consulta-sala',
    data: 'nova-consulta-data',
    hora: 'nova-consulta-hora',
    duracao: 'nova-consulta-duracao',
    procedimento: 'nova-consulta-proc',
    status: 'nova-consulta-status',
    detalheStatus: 'agenda-detalhe-status',
    recorrencia: 'agenda-consulta-recorrencia',
    retorno: 'agenda-consulta-retorno',
  },
  tarefa: {
    titulo: 'tarefa-titulo',
    prazoData: 'tarefa-prazo-data',
    prazoHora: 'tarefa-prazo-hora',
  },
  compromisso: {
    titulo: 'comp-titulo',
    data: 'comp-data',
    horaInicio: 'comp-inicio',
    horaFim: 'comp-fim',
  },
} as const;
