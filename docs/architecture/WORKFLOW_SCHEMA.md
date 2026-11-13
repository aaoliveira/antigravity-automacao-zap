# Especificação do Esquema de Dados dos Fluxos (Workflow Schema)

> **Documento:** Workflow JSON Schema & Data Model Specification  
> **Status:** Aprovado para Implementação  
> **Versão:** 1.0.0  
> **Data:** 13 de Novembro de 2026  
> **Autor:** Staff Software Engineer & Software Architect  

---

## 1. Visão Geral e Estratégia de Versionamento

Os fluxos criados no **Flow Builder** são armazenados no banco de dados como documentos JSON estruturados e imutáveis por versão. Essa estratégia oferece:

- **Performance Superior:** Leitura e persistência do grafo inteiro em uma única operação atômica, sem necessidade de joins relacionais complexos em tabelas de nós e conexões.
- **Rastreabilidade e Histórico:** Toda edição gera um novo rascunho (`DRAFT`) ou uma nova versão numerada (`flow_versions`), permitindo reversão imediata (rollback) sem corromper sessões em andamento.
- **Isolamento de Execução:** Uma sessão aberta em execução é vinculada permanentemente ao `flowVersionId` em que foi iniciada, assegurando que alterações em tempo real no construtor não quebrem conversas ativas.

---

## 2. Modelo de Dados Relacional (Prisma Schema)

O esquema relacional é estruturado para suportar multi-tenancy estrito, gerenciamento de instâncias, contatos, versionamento de fluxos e observabilidade:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum SessionStatus {
  RUNNING
  WAITING_USER_INPUT
  WAITING_DELAY
  HANDOVER_HUMAN
  COMPLETED
  FAILED
}

enum FlowStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

model Flow {
  id          String      @id @default(uuid()) @db.Uuid
  tenantId    String      @db.Uuid
  name        String      @db.VarChar(255)
  description String?     @db.Text
  status      FlowStatus  @default(DRAFT)
  activeVersionId String? @db.Uuid
  createdAt   DateTime    @default(now()) @db.Timestamptz
  updatedAt   DateTime    @updatedAt @db.Timestamptz

  versions    FlowVersion[]
  sessions    FlowSession[]

  @@index([tenantId])
  @@map("flows")
}

model FlowVersion {
  id            String      @id @default(uuid()) @db.Uuid
  flowId        String      @db.Uuid
  tenantId      String      @db.Uuid
  versionNumber Int         // 1, 2, 3...
  schemaVersion String      @default("1.0.0") @db.VarChar(20)
  definition    Json        // Contém nodes, edges, viewport e variables
  publishedBy   String?     @db.Uuid
  isPublished   Boolean     @default(false)
  createdAt     DateTime    @default(now()) @db.Timestamptz

  flow          Flow        @relation(fields: [flowId], references: [id], onDelete: Cascade)
  sessions      FlowSession[]

  @@unique([flowId, versionNumber])
  @@index([tenantId])
  @@map("flow_versions")
}

model FlowSession {
  id              String         @id @default(uuid()) @db.Uuid
  tenantId        String         @db.Uuid
  flowId          String         @db.Uuid
  flowVersionId   String         @db.Uuid
  contactId       String         @db.Uuid
  instanceId      String         @db.Uuid
  status          SessionStatus  @default(RUNNING)
  currentNodeId   String         @db.VarChar(100)
  previousNodeId  String?        @db.VarChar(100)
  stepCount       Int            @default(0)
  lastInteractionAt DateTime     @default(now()) @db.Timestamptz
  createdAt       DateTime       @default(now()) @db.Timestamptz
  completedAt     DateTime?      @db.Timestamptz

  flow            Flow           @relation(fields: [flowId], references: [id], onDelete: Restrict)
  flowVersion     FlowVersion    @relation(fields: [flowVersionId], references: [id], onDelete: Restrict)
  variables       SessionVariable[]
  stepLogs        FlowStepLog[]

  @@index([tenantId, contactId, status])
  @@index([flowId, status])
  @@map("flow_sessions")
}

model SessionVariable {
  id          String      @id @default(uuid()) @db.Uuid
  sessionId   String      @db.Uuid
  key         String      @db.VarChar(100)
  value       String      @db.Text
  type        String      @default("string") @db.VarChar(30)
  updatedAt   DateTime    @updatedAt @db.Timestamptz

  session     FlowSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@unique([sessionId, key])
  @@index([sessionId])
  @@map("session_variables")
}

model FlowStepLog {
  id              String      @id @default(uuid()) @db.Uuid
  sessionId       String      @db.Uuid
  nodeId          String      @db.VarChar(100)
  nodeType        String      @db.VarChar(50)
  inputPayload    Json?
  outputPayload   Json?
  exitHandleId    String?     @db.VarChar(50)
  executionTimeMs Int         @default(0)
  errorMessage    String?     @db.Text
  createdAt       DateTime    @default(now()) @db.Timestamptz

  session         FlowSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId, createdAt])
  @@map("flow_step_logs")
}
```

---

## 3. Tipos TypeScript do Grafo Conversacional

### 3.1 Raiz da Definição do Fluxo (`WorkflowDefinition`)

```typescript
export interface WorkflowDefinition {
  schemaVersion: "1.0.0";
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables: FlowVariableDeclaration[];
}

export interface FlowVariableDeclaration {
  name: string;
  type: "string" | "number" | "boolean" | "json";
  description?: string;
  defaultValue?: any;
}
```

### 3.2 Estrutura Base de Nós e Conexões

```typescript
export type FlowNodeType =
  | "trigger"
  | "message_text"
  | "message_media"
  | "buttons"
  | "list_interactive"
  | "question_input"
  | "condition"
  | "switch"
  | "delay"
  | "wait_reply"
  | "set_variable"
  | "human_transfer"
  | "end_flow";

export interface FlowNode<TData = any> {
  id: string; // Ex: "node_msg_1", UUID ou gerado pelo builder
  type: FlowNodeType;
  position: { x: number; y: number };
  data: TData;
}

export interface FlowEdge {
  id: string; // Ex: "edge_node1_node2"
  source: string; // ID do nó de origem
  target: string; // ID do nó de destino
  sourceHandle?: string; // ID da porta de saída (ex: "true", "false", "opt_1", "default")
  targetHandle?: string; // ID da porta de entrada
}
```

---

## 4. Tipos Específicos de Cada Nó

### 4.1 Nó de Gatilho (`trigger`)
```typescript
export interface TriggerNodeData {
  triggerType: "exact_keyword" | "contains_keyword" | "regex" | "first_interaction" | "any_message";
  keywords?: string[]; // Ex: ["oi", "olá", "preço"]
  regexPattern?: string;
  caseSensitive?: boolean;
}
```

### 4.2 Nó de Mensagem de Texto (`message_text`)
```typescript
export interface MessageTextNodeData {
  text: string; // Suporta Spintax e interpolação: "Olá {{contact.name}}! Como posso ajudar?"
  previewUrl?: boolean; // Habilita preview de link se houver URL no texto
}
```

### 4.3 Nó de Mídia (`message_media`)
```typescript
export interface MessageMediaNodeData {
  mediaType: "image" | "audio" | "video" | "document";
  mediaUrl: string; // URL pública HTTPS
  caption?: string; // Legenda textual (para imagem/vídeo/documento)
  fileName?: string; // Nome do arquivo visível para documentos (ex: "catalogo.pdf")
}
```

### 4.4 Nó de Botões de Resposta (`buttons`)
```typescript
export interface FlowButtonOption {
  id: string; // Identificador da porta de saída correspondente
  label: string; // Texto visível no botão (máximo 20 caracteres por regra do WhatsApp)
}

export interface ButtonsNodeData {
  title?: string;
  body: string; // Texto descritivo da mensagem
  footer?: string;
  buttons: FlowButtonOption[]; // Máximo 3 botões (limite padrão do WhatsApp)
  fallbackToTextList?: boolean; // Se true, gera lista numerada caso Baileys não renderize botões nativos
}
```

### 4.5 Nó de Lista Interativa (`list_interactive`)
```typescript
export interface FlowListRow {
  id: string; // ID da porta de saída
  title: string; // Título da linha (máx 24 caracteres)
  description?: string; // Descrição opcional (máx 72 caracteres)
}

export interface FlowListSection {
  title: string;
  rows: FlowListRow[];
}

export interface ListInteractiveNodeData {
  title: string;
  body: string;
  footer?: string;
  buttonText: string; // Texto do botão que abre a lista (ex: "Ver Opções")
  sections: FlowListSection[];
  fallbackToTextList?: boolean;
}
```

### 4.6 Nó de Pergunta e Captura (`question_input`)
```typescript
export interface QuestionInputNodeData {
  questionText: string;
  targetVariable: string; // Variável onde salvar a resposta (ex: "user_email")
  expectedType: "text" | "number" | "email" | "phone" | "regex";
  validationRegex?: string;
  customErrorMessage?: string; // Ex: "E-mail inválido. Por favor, digite um e-mail válido:"
  maxRetries?: number; // Padrão: 3
}
```

### 4.7 Nó de Condição (`condition`)
```typescript
export interface ConditionRule {
  variable: string;
  operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "regex_match" | "is_empty" | "is_not_empty";
  value?: string;
}

export interface ConditionNodeData {
  logicalOperator: "AND" | "OR";
  rules: ConditionRule[];
  // Portas de saída: "true" e "false"
}
```

### 4.8 Nó Switch (`switch`)
```typescript
export interface SwitchCase {
  id: string; // ID da porta de saída correspondente
  value: string; // Valor esperado (ex: "1", "suporte", "financeiro")
}

export interface SwitchNodeData {
  variable: string; // Ex: "opcao_escolhida"
  cases: SwitchCase[];
  // Porta de saída padrão automática: "default"
}
```

### 4.9 Nó de Atraso (`delay`)
```typescript
export interface DelayNodeData {
  durationSeconds: number; // Intervalo de pausa (ex: 3 a 600 segundos)
  simulatePresence: "composing" | "recording" | "none"; // Simula "digitando..." ou "gravando áudio..."
}
```

### 4.10 Nó de Espera por Resposta (`wait_reply`)
```typescript
export interface WaitReplyNodeData {
  timeoutMinutes: number; // Tempo máximo de espera antes de avançar para a porta timeout
  // Portas de saída: "reply" (quando responde) e "timeout" (quando esgota o tempo)
}
```

### 4.11 Nó Definir Variável (`set_variable`)
```typescript
export interface SetVariableNodeData {
  variableName: string;
  operation: "set" | "increment" | "decrement" | "clear";
  expression: string; // Valor estático ou expressão (ex: "VIP", "{{contador}} + 1")
}
```

### 4.12 Nó de Transferência Humana (`human_transfer`)
```typescript
export interface HumanTransferNodeData {
  department?: string; // Ex: "Comercial", "Suporte Técnico"
  queueId?: string;
  internalNote?: string; // Nota enviada ao atendente com o resumo
  closingMessage?: string; // Mensagem ao cliente: "Aguarde um momento, vou transferir você."
}
```

### 4.13 Nó de Encerramento (`end_flow`)
```typescript
export interface EndFlowNodeData {
  farewellMessage?: string; // Ex: "Atendimento encerrado. Obrigado!"
  clearSessionVariables?: boolean;
}
```

---

## 5. Exemplo Completo de Fluxo Serializado (JSON)

Abaixo, um exemplo válido de fluxo de triagem com boas-vindas, botões de opção, captura de e-mail e transferência:

```json
{
  "schemaVersion": "1.0.0",
  "viewport": { "x": 0, "y": 0, "zoom": 1 },
  "variables": [
    { "name": "user_email", "type": "string" },
    { "name": "opcao_menu", "type": "string" }
  ],
  "nodes": [
    {
      "id": "node_trigger",
      "type": "trigger",
      "position": { "x": 100, "y": 200 },
      "data": {
        "triggerType": "exact_keyword",
        "keywords": ["oi", "ola", "bom dia"]
      }
    },
    {
      "id": "node_welcome",
      "type": "message_text",
      "position": { "x": 350, "y": 200 },
      "data": {
        "text": "{Olá|Oi}! Bem-vindo ao atendimento automatizado da nossa empresa."
      }
    },
    {
      "id": "node_menu",
      "type": "buttons",
      "position": { "x": 600, "y": 200 },
      "data": {
        "body": "Como podemos te ajudar hoje?",
        "fallbackToTextList": true,
        "buttons": [
          { "id": "btn_vendas", "label": "Comprar Produtos" },
          { "id": "btn_suporte", "label": "Falar com Suporte" }
        ]
      }
    },
    {
      "id": "node_ask_email",
      "type": "question_input",
      "position": { "x": 900, "y": 100 },
      "data": {
        "questionText": "Excelente! Por favor, digite seu e-mail para enviarmos nossa proposta:",
        "targetVariable": "user_email",
        "expectedType": "email",
        "maxRetries": 3
      }
    },
    {
      "id": "node_transfer",
      "type": "human_transfer",
      "position": { "x": 900, "y": 350 },
      "data": {
        "department": "Suporte Técnico",
        "closingMessage": "Transferindo seu contato para nossa equipe técnica. Por favor, aguarde alguns instantes."
      }
    },
    {
      "id": "node_end",
      "type": "end_flow",
      "position": { "x": 1200, "y": 100 },
      "data": {
        "farewellMessage": "Obrigado! Um especialista entrará em contato em breve."
      }
    }
  ],
  "edges": [
    {
      "id": "edge_trig_welc",
      "source": "node_trigger",
      "target": "node_welcome"
    },
    {
      "id": "edge_welc_menu",
      "source": "node_welcome",
      "target": "node_menu"
    },
    {
      "id": "edge_menu_vendas",
      "source": "node_menu",
      "sourceHandle": "btn_vendas",
      "target": "node_ask_email"
    },
    {
      "id": "edge_menu_suporte",
      "source": "node_menu",
      "sourceHandle": "btn_suporte",
      "target": "node_transfer"
    },
    {
      "id": "edge_email_end",
      "source": "node_ask_email",
      "target": "node_end"
    }
  ]
}
```
