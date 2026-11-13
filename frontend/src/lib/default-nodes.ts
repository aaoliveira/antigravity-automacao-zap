import {
  MessageSquare,
  KeyRound,
  FileText,
  Image,
  Video,
  Mic,
  FileCode,
  Smile,
  MapPin,
  User,
  LayoutGrid,
  List,
  Layers,
  HelpCircle,
  Inbox,
  CheckSquare,
  GitBranch,
  Split,
  Clock,
  Hourglass,
  Tag,
  Trash2,
  UserCheck,
  PlayCircle,
  Headphones,
  StopCircle,
} from 'lucide-react';

export interface CatalogItem {
  type: string;
  label: string;
  description: string;
  category: 'trigger' | 'message' | 'interaction' | 'logic' | 'action';
  icon: any;
  color: string;
  defaultConfig: Record<string, any>;
}

export const NODE_CATALOG: CatalogItem[] = [
  // ==========================================
  // GATILHOS
  // ==========================================
  {
    type: 'trigger.keyword',
    label: 'Palavra-chave',
    description: 'Inicia quando o cliente envia uma palavra ou termo específico',
    category: 'trigger',
    icon: KeyRound,
    color: '#8b5cf6', // Violet
    defaultConfig: {
      keywords: ['olá', 'preço', 'ajuda'],
      matchType: 'contains',
    },
  },
  {
    type: 'trigger.message_received',
    label: 'Qualquer Mensagem',
    description: 'Inicia a automação para qualquer mensagem de texto recebida',
    category: 'trigger',
    icon: MessageSquare,
    color: '#8b5cf6',
    defaultConfig: {},
  },

  // ==========================================
  // MENSAGENS
  // ==========================================
  {
    type: 'message.text',
    label: 'Mensagem de Texto',
    description: 'Envia mensagem com suporte a formatação WhatsApp e variáveis',
    category: 'message',
    icon: FileText,
    color: '#10b981', // Emerald
    defaultConfig: {
      text: 'Olá! Seja bem-vindo ao nosso atendimento.',
      delay: 0,
    },
  },
  {
    type: 'message.image',
    label: 'Imagem',
    description: 'Envia foto (JPG/PNG) com legenda opcional',
    category: 'message',
    icon: Image,
    color: '#10b981',
    defaultConfig: {
      url: 'https://images.unsplash.com/photo-1579202673506-ca3ce28943ef',
      caption: 'Veja a nossa novidade!',
    },
  },
  {
    type: 'message.video',
    label: 'Vídeo',
    description: 'Envia vídeo (MP4) com legenda',
    category: 'message',
    icon: Video,
    color: '#10b981',
    defaultConfig: {
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      caption: 'Assista a esta apresentação',
    },
  },
  {
    type: 'message.audio',
    label: 'Áudio (PTT)',
    description: 'Envia mensagem de voz simulando gravação na hora',
    category: 'message',
    icon: Mic,
    color: '#10b981',
    defaultConfig: {
      url: 'https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg',
      isPtt: true,
    },
  },
  {
    type: 'message.document',
    label: 'Documento / PDF',
    description: 'Envia arquivo anexado (PDF, DOCX, XLSX)',
    category: 'message',
    icon: FileCode,
    color: '#10b981',
    defaultConfig: {
      url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      fileName: 'Apresentacao-Comercial.pdf',
      caption: 'Segue a proposta solicitada',
    },
  },
  {
    type: 'message.sticker',
    label: 'Figurinha / Sticker',
    description: 'Envia figurinha animada ou estática (WEBP)',
    category: 'message',
    icon: Smile,
    color: '#10b981',
    defaultConfig: {
      url: 'https://raw.githubusercontent.com/WhatsApp/stickers/master/Android/app/src/main/assets/1/01_Cuppy_smile.webp',
    },
  },
  {
    type: 'message.location',
    label: 'Localização',
    description: 'Compartilha mapa com coordenadas geográficas e endereço',
    category: 'message',
    icon: MapPin,
    color: '#10b981',
    defaultConfig: {
      name: 'Nossa Sede',
      address: 'Av. Paulista, 1000 - São Paulo, SP',
      latitude: -23.561414,
      longitude: -46.6558819,
    },
  },
  {
    type: 'message.contact',
    label: 'Cartão de Contato',
    description: 'Compartilha dados de um contato (vCard)',
    category: 'message',
    icon: User,
    color: '#10b981',
    defaultConfig: {
      fullName: 'Suporte Técnico',
      phoneNumber: '5511999990000',
    },
  },
  {
    type: 'message.buttons',
    label: 'Botões de Resposta',
    description: 'Dispara mensagem com 1 a 3 botões clicáveis ou menu numérico',
    category: 'message',
    icon: LayoutGrid,
    color: '#10b981',
    defaultConfig: {
      title: 'Menu de Atendimento',
      description: 'Como podemos te ajudar hoje?',
      footer: 'Selecione uma opção abaixo:',
      buttons: [
        { id: 'btn_vendas', displayText: 'Comprar Produtos' },
        { id: 'btn_suporte', displayText: 'Falar com Suporte' },
      ],
    },
  },
  {
    type: 'message.list',
    label: 'Lista Interativa',
    description: 'Menu suspenso com seções e linhas selecionáveis',
    category: 'message',
    icon: List,
    color: '#10b981',
    defaultConfig: {
      title: 'Catálogo de Serviços',
      description: 'Selecione uma das categorias:',
      buttonText: 'Ver Categorias',
      footerText: 'Escolha uma opção para continuar',
      sections: [
        {
          title: 'Planos',
          rows: [
            { rowId: 'plan_basic', title: 'Plano Básico', description: 'R$ 49/mês' },
            { rowId: 'plan_pro', title: 'Plano Pro', description: 'R$ 99/mês' },
          ],
        },
      ],
    },
  },
  {
    type: 'message.template',
    label: 'Template Meta (Cloud API)',
    description: 'Modelo de mensagem pré-aprovado pela Meta para início de conversas',
    category: 'message',
    icon: Layers,
    color: '#10b981',
    defaultConfig: {
      templateName: 'boas_vindas_v1',
      languageCode: 'pt_BR',
      components: [],
    },
  },

  // ==========================================
  // INTERAÇÕES
  // ==========================================
  {
    type: 'interaction.question',
    label: 'Pergunta ao Usuário',
    description: 'Envia pergunta, aguarda resposta do cliente e salva em variável',
    category: 'interaction',
    icon: HelpCircle,
    color: '#06b6d4', // Cyan
    defaultConfig: {
      questionText: 'Qual o seu nome completo?',
      targetVariable: 'nome_cliente',
      expectedType: 'text',
      customErrorMessage: 'Por favor, informe seu nome corretamente.',
      timeoutSeconds: 300,
    },
  },
  {
    type: 'interaction.capture',
    label: 'Captura Específica',
    description: 'Captura e valida e-mail, telefone, CPF ou documento',
    category: 'interaction',
    icon: Inbox,
    color: '#06b6d4',
    defaultConfig: {
      questionText: 'Por favor, digite seu melhor e-mail:',
      targetVariable: 'email_cliente',
      expectedType: 'email',
      customErrorMessage: 'E-mail inválido. Ex: nome@empresa.com',
    },
  },
  {
    type: 'interaction.choice',
    label: 'Múltipla Escolha',
    description: 'Apresenta opções e ramifica a rota com base na resposta',
    category: 'interaction',
    icon: CheckSquare,
    color: '#06b6d4',
    defaultConfig: {
      questionText: 'Qual o seu nível de experiência com automações?',
      options: ['Iniciante', 'Intermediário', 'Avançado'],
      targetVariable: 'experiencia',
    },
  },

  // ==========================================
  // LÓGICA E CONTROLE DE FLUXO
  // ==========================================
  {
    type: 'logic.condition',
    label: 'Condição (Se / Senão)',
    description: 'Testa variáveis com operadores lógicos e ramifica para Verdadeiro ou Falso',
    category: 'logic',
    icon: GitBranch,
    color: '#f59e0b', // Amber
    defaultConfig: {
      rules: [
        {
          variable: 'nome_cliente',
          operator: 'IS_NOT_EMPTY',
          value: '',
        },
      ],
      logicalOperator: 'AND',
    },
  },
  {
    type: 'logic.switch',
    label: 'Switch (Múltiplos Casos)',
    description: 'Compara uma variável com múltiplos valores direcionando para rotas distintas',
    category: 'logic',
    icon: Split,
    color: '#f59e0b',
    defaultConfig: {
      variable: 'opcao_menu',
      cases: [
        { id: 'case_1', value: '1', label: 'Caso 1' },
        { id: 'case_2', value: '2', label: 'Caso 2' },
      ],
    },
  },
  {
    type: 'logic.delay',
    label: 'Atraso / Delay',
    description: 'Pausa a execução por alguns segundos simulando digitação humana',
    category: 'logic',
    icon: Clock,
    color: '#f59e0b',
    defaultConfig: {
      delaySeconds: 3,
      showPresence: true,
    },
  },
  {
    type: 'logic.wait_for_input',
    label: 'Esperar por Resposta',
    description: 'Pausa o fluxo até que o cliente envie uma nova mensagem',
    category: 'logic',
    icon: Hourglass,
    color: '#f59e0b',
    defaultConfig: {
      timeoutHours: 24,
    },
  },

  // ==========================================
  // AÇÕES
  // ==========================================
  {
    type: 'action.add_tag',
    label: 'Adicionar Tag',
    description: 'Aplica uma etiqueta ao contato no CRM',
    category: 'action',
    icon: Tag,
    color: '#ec4899', // Pink
    defaultConfig: {
      tag: 'lead_qualificado',
    },
  },
  {
    type: 'action.remove_tag',
    label: 'Remover Tag',
    description: 'Remove uma etiqueta existente do contato',
    category: 'action',
    icon: Trash2,
    color: '#ec4899',
    defaultConfig: {
      tag: 'aguardando_contato',
    },
  },
  {
    type: 'action.update_contact',
    label: 'Atualizar Contato',
    description: 'Salva nome ou campos customizados no registro do cliente',
    category: 'action',
    icon: UserCheck,
    color: '#ec4899',
    defaultConfig: {
      name: '{{nome_cliente}}',
      customFields: {},
    },
  },
  {
    type: 'action.start_flow',
    label: 'Iniciar Outro Fluxo',
    description: 'Transfere a execução para outra automação publicada',
    category: 'action',
    icon: PlayCircle,
    color: '#ec4899',
    defaultConfig: {
      targetFlowId: '',
    },
  },
  {
    type: 'action.human_handoff',
    label: 'Transferir Atendimento',
    description: 'Pausa o bot e encaminha a conversa para um atendente humano',
    category: 'action',
    icon: Headphones,
    color: '#ec4899',
    defaultConfig: {
      message: 'Estamos transferindo você para um atendente humano. Aguarde um instante!',
      department: 'Suporte',
    },
  },
  {
    type: 'action.end',
    label: 'Encerrar Fluxo',
    description: 'Finaliza formalmente a execução e arquiva a sessão',
    category: 'action',
    icon: StopCircle,
    color: '#ef4444', // Red
    defaultConfig: {
      reason: 'Atendimento concluído com sucesso',
    },
  },
];

export function getCatalogItemByType(type: string): CatalogItem | undefined {
  return NODE_CATALOG.find((item) => item.type === type);
}
