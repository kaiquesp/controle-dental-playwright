export const FINANCEIRO_SELECTORS = {
  root: 'app-financeiro-content, .financeiro, main',
  tabs: 'nav[aria-label="Seções do financeiro"], .financeiro__tabs',
  lancamentoModal: '[role="dialog"]:visible, .p-dialog:visible',
} as const;

export const FINANCEIRO_FORM_IDS = {
  periodoPainel: '#fin-periodo',
  periodoFluxo: '#fluxo-periodo',
  buscaFluxo: '#fluxo-busca',
  valor: '#nt-valor',
  data: '#nt-data',
  descricao: '#nt-desc',
  origem: '#nt-origem',
  statusPago: '#nt-st-pago',
  statusPendente: '#nt-st-pend',
} as const;

export const FINANCEIRO_PAINEL_INDICATORS = [
  /Entradas do período/i,
  /Saídas do período/i,
  /Receitas em aberto/i,
  /Saldo projetado/i,
] as const;

export const FINANCEIRO_PAINEL_SECTIONS = [
  /Evolução da clínica/i,
  /Fluxo financeiro do mês/i,
  /Vencimentos pendentes/i,
  /Alertas do financeiro/i,
] as const;

export const FINANCEIRO_FLUXO_TOTALS = [
  /Saldo inicial/i,
  /Entradas/i,
  /Saídas/i,
  /Saldo final previsto/i,
] as const;

export const FINANCEIRO_FLUXO_SECTIONS = [
  /Lançamentos do período/i,
  /Próximos movimentos/i,
  /Saídas por categoria/i,
] as const;

export const FEATURE_GATED_FINANCEIRO_PATHS = new Set([
  '/financeiro/boletos',
  '/financeiro/notas-fiscais',
]);
