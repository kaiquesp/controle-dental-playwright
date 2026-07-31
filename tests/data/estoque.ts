import type { ScreenMap } from '../support/screen-map';

export const ESTOQUE_SELECTORS = {
  root: 'app-estoque-content, .estoque',
  tableCard: '.estoque__table-card',
  table: '.estoque__table',
} as const;

export const ESTOQUE_FORM_IDS = {
  nome: '#nm-nome',
  descricao: '#nm-desc',
  codigo: '#nm-codigo',
  categoria: '#nm-cat',
  quantidade: '#nm-qtd',
  unidade: '#nm-un',
  minimo: '#nm-min',
  validade: '#nm-val',
  custo: '#nm-custo',
  fornecedor: '#nm-forn',
  alerta: '#nm-alerta',
  filtroCategoria: '#est-cat',
  filtroStatus: '#est-st',
} as const;

export const ESTOQUE_KPIS = [
  /Total de itens/i,
  /Estoque baixo/i,
  /Valor em estoque/i,
  /Vencendo em breve/i,
] as const;

export const ESTOQUE_TABLE_COLUMNS = [
  /Material/i,
  /Código/i,
  /Categoria/i,
  /Qtd\./i,
  /Status/i,
  /Validade/i,
  /Ações/i,
] as const;

export const ESTOQUE_SCREEN_MAP: ScreenMap = {
  headings: [/Estoque/i, /Itens em estoque/i],
  texts: [/Gestão de materiais e produtos odontológicos/i, ...ESTOQUE_KPIS],
  buttons: [/Novo material/i],
};
