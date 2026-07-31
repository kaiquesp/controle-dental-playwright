export const PROTESE_KANBAN_COLUMNS = [
  'Solicitação',
  'Enviado para laboratório',
  'Retornado à clínica',
  'Instalado',
] as const;

export type ProteseKanbanColumn = (typeof PROTESE_KANBAN_COLUMNS)[number];

export const PROTESE_SELECTORS = {
  root: 'app-controle-protese-content, .controle-protese',
  kanban: '.controle-protese__kanban',
  kanbanBoard: '.controle-protese__kanban-board',
  column: '.controle-protese__column',
  columnBody: '.controle-protese__column-body',
  caseCard: '.controle-protese-case-card, [class*="case-card"]',
  casoModal: '.controle-protese-caso-modal',
  casoDetailModal: '.controle-protese-caso-detail-modal, .controle-protese-detalhe-modal',
  labModal: '.controle-protese-lab-modal',
  labsRoot: '.cp-labs',
} as const;

export const PROTESE_FORM_IDS = {
  busca: '#controle-protese-busca',
  patientSearch: '#controle-protese-patient-search',
  tipo: '#controle-protese-tipo',
  dente: '#controle-protese-dente',
  detalhes: '#controle-protese-detalhes',
  dataPrevista: '#controle-protese-data-prevista',
  labNome: '#controle-protese-lab-nome',
  labTel: '#controle-protese-lab-tel',
  labEmail: '#controle-protese-lab-email',
  labsBusca: '#controle-protese-labs-busca',
} as const;
