import type { ScreenMap } from '../support/screen-map';

export const CONFIG_SELECTORS = {
  root: 'app-configuracoes-content, .config',
  tabsNav: 'nav[aria-label="Seções"], .config__tabs',
  activeTab: '.config__tab--active',
} as const;

/** Alias de labels da UI (billing). */
export const CONFIG_TAB_ALIASES: Record<string, RegExp> = {
  'Plano e cobrança': /Plano e cobrança|Assinatura/i,
  Assinatura: /Assinatura|Plano e cobrança/i,
};

export const CONFIG_FORM_IDS = {
  perfil: {
    nome: '#cfg-nome',
    email: '#cfg-email',
    tel: '#cfg-tel',
    esp: '#cfg-esp',
    cro: '#cfg-cro',
    senhaAtual: '#cfg-senha-atual',
    senhaNova: '#cfg-senha-nova',
    senhaConf: '#cfg-senha-conf',
  },
  clinica: {
    nomeFantasia: '#cfg-cli-nome-fantasia',
    razao: '#cfg-cli-razao',
    cpfCnpj: '#cfg-cli-cpf-cnpj',
    tel: '#cfg-cli-tel',
    email: '#cfg-cli-email',
    ie: '#cfg-cli-ie',
    cep: '#cfg-cli-cep',
    logradouro: '#cfg-cli-logr',
    numero: '#cfg-cli-num',
    complemento: '#cfg-cli-comp',
    bairro: '#cfg-cli-bairro',
    cidade: '#cfg-cli-cidade',
    uf: '#cfg-cli-uf',
  },
  equipe: {
    nome: '#eq-m-nome',
    email: '#eq-m-email',
    tel: '#eq-m-tel',
    esp: '#eq-m-esp',
    cro: '#eq-m-cro',
  },
  dentista: {
    busca: '#config-prof-busca',
    nome: '#pf-nome',
    especialidade: '#pf-esp',
    ativo: '#pf-ativo',
  },
  fornecedor: {
    nome: '#f-nome',
    cpfCnpj: '#f-cpf-cnpj',
    tel: '#f-tel',
    email: '#f-email',
    obs: '#f-obs',
    ativo: '#f-ativo',
  },
  sala: {
    nome: '#sc-nome',
    desc: '#sc-desc',
    ativo: '#sc-ativo',
  },
  tratamento: {
    search: '#trat-search',
    nome: '#tcf-nome',
    codigo: '#tcf-codigo',
    desc: '#tcf-desc',
    valor: '#tcf-valor',
    custo: '#tcf-custo',
    comissao: '#tcf-comissao',
  },
  medicamento: {
    filtro: '#med-filtro-q',
    nome: '#med-form-nome',
    principio: '#med-form-principio',
    categoria: '#med-form-categoria',
    apresentacao: '#med-form-apresentacao',
    concentracao: '#med-form-concentracao',
    via: '#med-form-via',
    codigo: '#med-form-codigo',
    posologia: '#med-form-posologia',
    orientacoes: '#med-form-orientacoes',
    obs: '#med-form-obs',
  },
  encaminhamento: {
    filtro: '#enc-filtro-q',
    nome: '#enc-nome',
    titulo: '#enc-titulo',
    destino: '#enc-destino',
    validade: '#enc-validade',
    local: '#enc-local',
    motivo: '#enc-motivo',
    solicitacao: '#enc-solicitacao',
    historico: '#enc-historico',
    orientacoes: '#enc-orientacoes',
    corpo: '#enc-corpo',
  },
  mensagem: {
    busca: '#msg-rel-busca',
    nome: '#msg-rel-nome',
    corpo: '#msg-rel-corpo',
    desc: '#msg-rel-desc',
    objetivo: '#msg-rel-obj',
    padrao: '#msg-rel-padrao',
    ativo: '#msg-rel-ativo',
  },
  notificacoes: {
    inApp: '#notif-in-app',
    webPush: '#notif-web-push',
  },
  convenio: {
    search: '#conv-list-search',
  },
} as const;

export const CONFIG_CTAS = {
  salvarAlteracoes: /Salvar alterações/i,
  atualizarSenha: /Atualizar senha/i,
  adicionarMembro: /Adicionar membro/i,
  novoDentista: /Novo dentista/i,
  criarConvenio: /Criar convênio|Novo convênio/i,
  novoFornecedor: /Novo fornecedor|Adicionar fornecedor/i,
  novaSala: /Nova sala|Adicionar sala|Nova cadeira/i,
  novoTratamento: /Novo tratamento|Novo procedimento|Adicionar procedimento/i,
  novoMedicamento: /Novo medicamento|Adicionar medicamento/i,
  novoEncaminhamento: /Novo modelo|Adicionar modelo|Novo encaminhamento/i,
  novoModeloMensagem: /Novo modelo|Adicionar modelo|Criar modelo/i,
  novoModeloAnamnese: /Novo modelo|Adicionar modelo|Nova anamnese/i,
  novoContrato: /Novo modelo|Criar modelo|Novo contrato/i,
} as const;

export const SUCCESS_TOAST =
  /salvo|salva|criado|criada|atualizado|atualizada|excluído|excluída|removido|removida|sucesso|cadastrado/i;

export const ERROR_TOAST =
  /erro|falha|inválid|obrigatór|informe|não foi possível|nao foi possivel|required/i;

export const VALIDATION_HINTS = {
  procedimentoNome: /Informe o nome do procedimento/i,
  campoObrigatorio: /obrigatór|informe|preencha|inválid/i,
} as const;

/** Endpoints confirmados no probe (`docs/configuracoes-api-probe.json`). */
export const CONFIG_API = {
  perfil: '/configuracoes/perfil/me',
  clinica: '/configuracoes/clinica',
  notificacoes: '/configuracoes/perfil/notificacoes',
  convenios: '/configuracoes/convenios',
  equipeMembros: '/configuracoes/equipe/membros',
  anamneseModelos: '/configuracoes/anamnese-modelos',
  mensagensRelacionamento: '/configuracoes/mensagens-relacionamento',
  integracoes: '/configuracoes/integracoes',
  profissionais: '/profissionais',
  salas: '/salas-cadeiras',
  fornecedores: '/fornecedores',
  formasPagamento: '/formas-pagamento',
  medicamentos: '/medicamentos',
  tratamentos: '/tratamentos',
  modelosEncaminhamento: '/modelos-encaminhamento',
  modelosContrato: '/config-clinica/modelos-contrato',
} as const;

export const CONFIG_SCREEN_MAP: ScreenMap = {
  headings: [/Configurações/i],
  texts: [/Conta e sistema|Gestão da clínica|Prontuário e clínico/i],
  buttons: [/Meu perfil/i, /Dados da clínica/i],
};
