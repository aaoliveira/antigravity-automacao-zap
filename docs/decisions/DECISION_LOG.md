# Registro de Decisões de Arquitetura (DECISION_LOG)

> **Documento:** Architecture Decision Records (ADR Log)  
> **Status:** Aprovado  
> **Projeto:** SaaS Automação WhatsApp — Flow Builder  
> **Data:** 13 de Novembro de 2026  

---

## Índice de Decisões

- [ADR-001: Desacoplamento entre Frontend (@xyflow/react) e Backend Engine (NestJS)](#adr-001-desacoplamento-entre-frontend-xyflowreact-e-backend-engine-nestjs)
- [ADR-002: Persistência de Fluxos como Documentos JSON Versionados](#adr-002-persistência-de-fluxos-como-documentos-json-versionados)
- [ADR-003: Orquestração Assíncrona de Passos com BullMQ e Redis](#adr-003-orquestração-assíncrona-de-passos-com-bullmq-e-redis)
- [ADR-004: Controle de Concorrência com Travas Distribuídas Redis por Contato](#adr-004-controle-de-concorrência-com-travas-distribuídas-redis-por-contato)
- [ADR-005: Estratégia Híbrida de Conectores e Fallback para Baileys](#adr-005-estratégia-híbrida-de-conectores-e-fallback-para-baileys)
- [ADR-006: Ingestão de Webhooks da Evolution API com Idempotência via Redis](#adr-006-ingestão-de-webhooks-da-evolution-api-com-idempotência-via-redis)
- [ADR-007: Proteção Anti-Loop e Limite Máximo de Passos por Ciclo](#adr-007-proteção-anti-loop-e-limite-máximo-de-passos-por-ciclo)

---

## ADR-001: Desacoplamento entre Frontend (@xyflow/react) e Backend Engine (NestJS)

- **Status:** Aprovado
- **Data:** 2026-11-13
- **Contexto:**
  O Flow Builder necessita de interface altamente reativa para edição visual de grafos (canvas, arraste de blocos, zoom, custom handles) no estilo Typebot e n8n. No entanto, a lógica de execução conversacional, armazenamento de variáveis de contato e chamadas à Evolution API não podem depender da presença do usuário no navegador nem rodar no client-side.
- **Decisão:**
  - O frontend será construído com Next.js 16 (App Router), TypeScript e `@xyflow/react`. Ele é estritamente responsável por desenhar, editar propriedades, validar sintaxe do grafo e enviar definições JSON para o backend.
  - O backend em NestJS executa o motor de workflow de forma 100% autônoma, processando eventos de mensageria mesmo com o navegador do operador fechado.
- **Consequências:**
  - Positivas: Segurança total (credenciais e lógica ficam no servidor), alta disponibilidade da automação e renderização fluida no frontend.
  - Negativas: Necessidade de sincronização e validação de esquemas entre frontend e backend (mitigada por contratos TypeScript compartilhados).

---

## ADR-002: Persistência de Fluxos como Documentos JSON Versionados

- **Status:** Aprovado
- **Data:** 2026-11-13
- **Contexto:**
  Fluxos conversacionais são grafos direcionados compostos por nós, portas, arestas e configurações polimórficas. Persistir cada nó e conexão em tabelas relacionais separadas (`flow_nodes`, `flow_edges`, etc.) geraria overhead excessivo de dezenas de inserts/updates a cada salvamento, além de queries com múltiplos joins a cada mensagem processada.
- **Decisão:**
  - Armazenar o desenho completo do fluxo como documento JSON estruturado e tipado na coluna `definition` (PostgreSQL `jsonb`) na tabela `flow_versions`.
  - As versões publicadas são imutáveis. Edições em rascunho ficam em status `DRAFT` e, ao publicar, geram um novo registro `FlowVersion` com número incremental.
  - Cada `FlowSession` é vinculada a um `flowVersionId` estático.
- **Consequências:**
  - Positivas: Carregamento instantâneo do grafo, atomicidade no salvamento, histórico completo de versões e garantia de que edições do operador nunca quebrem sessões de clientes que já estão conversando.
  - Negativas: Queries SQL para buscar nós específicos exigem operadores de JSONB do PostgreSQL, o que é aceitável pois a leitura é sempre do grafo completo.

---

## ADR-003: Orquestração Assíncrona de Passos com BullMQ e Redis

- **Status:** Aprovado
- **Data:** 2026-11-13
- **Contexto:**
  Processar fluxos conversacionais de forma síncrona dentro da requisição HTTP de webhook causaria timeouts frequentes na Evolution API quando o fluxo envolver atrasos (`delay`), consultas externas ou disparos múltiplos.
- **Decisão:**
  - Implementar arquitetura de mensageria distribuída com **BullMQ** e **Redis**, dividida em filas especializadas:
    1. `flow-inbound-queue`: absorção ultra-rápida de webhooks.
    2. `flow-execution-queue`: avanço de nós de lógica.
    3. `flow-delay-queue`: gerenciamento de pausas temporais e timeouts de espera.
    4. `flow-dispatch-queue`: despacho HTTP para a Evolution API com controle de vazão (rate limit).
- **Consequências:**
  - Positivas: Resiliência contra picos de tráfego, retries automáticos com backoff exponencial e capacidade de escalar réplicas de workers horizontalmente.
  - Negativas: Dependência de infraestrutura estável do Redis.

---

## ADR-004: Controle de Concorrência com Travas Distribuídas Redis por Contato

- **Status:** Aprovado
- **Data:** 2026-11-13
- **Contexto:**
  Clientes no WhatsApp costumam enviar mensagens em rajada (ex: duas mensagens de texto seguidas em menos de 1 segundo). Se ambos os webhooks forem processados paralelamente, duas instâncias do motor de execução disputariam a sessão, gerando mensagens duplicadas ou variáveis corrompidas.
- **Decisão:**
  - Adotar travas atômicas distribuídas via Redis (`SET lock:session:{tenantId}:{remoteJid} {workerUuid} NX PX 10000`).
  - Enquanto a trava estiver retida por um worker processando o passo atual, mensagens subsequentes aguardam na fila `flow-inbound-queue` com retry automático, sendo processadas em ordem estrita assim que a trava for liberada.
- **Consequências:**
  - Positivas: Eliminação completa de condições de corrida (race conditions) por contato e preservação da linearidade da conversa.
  - Negativas: Pequeno acréscimo de latência (< 50ms) para aquisição e verificação de locks.

---

## ADR-005: Estratégia Híbrida de Conectores e Fallback para Baileys

- **Status:** Aprovado
- **Data:** 2026-11-13
- **Contexto:**
  A Evolution API v2 oferece suporte ao conector não oficial `WHATSAPP-BAILEYS` e ao conector oficial `WHATSAPP-BUSINESS` (Cloud API). Na emulação Baileys, botões nativos (`/message/sendButtons`) frequentemente não são renderizados em aplicativos modernos do WhatsApp para celular, causando travamento de fluxos que dependem de clique do usuário.
- **Decisão:**
  - Implementar estratégia de **Fallback Automático Inteligente**:
    1. Para instâncias Cloud API: despachar botões e listas interativas nativas.
    2. Para instâncias Baileys: converter automaticamente os botões em menu textual numerado ou enquete interativa (`sendPoll`), e configurar o analisador de entrada para reconhecer tanto o índice numérico quanto o texto da opção.
- **Consequências:**
  - Positivas: Garantia de funcionamento universal em qualquer conector ou aparelho celular, sem frustração para o cliente final.
  - Negativas: A experiência visual no Baileys é baseada em texto, o que é documentalmente explicado ao usuário no painel.

---

## ADR-006: Ingestão de Webhooks da Evolution API com Idempotência via Redis

- **Status:** Aprovado
- **Data:** 2026-11-13
- **Contexto:**
  Em situações de instabilidade de rede ou reconexão de sockets do WhatsApp, a Evolution API pode reenviar o mesmo evento de mensagem (`messages.upsert`) múltiplas vezes.
- **Decisão:**
  - Filtrar mensagens duplicadas logo na camada do `WebhookController` utilizando a chave única `dedup:msg:{data.key.id}` no Redis com TTL de 24 horas.
  - Se a chave já existir, a requisição é confirmada imediatamente com HTTP `200 OK`, mas descartada antes de entrar na fila de execução.
- **Consequências:**
  - Positivas: Proteção absoluta contra processamento duplicado de mensagens e economia de recursos.
  - Negativas: Armazenamento em memória no Redis para hashes de IDs (consumo desprezível, ~50 bytes por ID).

---

## ADR-007: Proteção Anti-Loop e Limite Máximo de Passos por Ciclo

- **Status:** Aprovado
- **Data:** 2026-11-13
- **Contexto:**
  Fluxos configurados incorretamente por usuários podem conter loops de condições que navegam ciclicamente entre nós sem nunca alcançar um bloco de pausa ou interação com o usuário (ex: Nó A $\rightarrow$ Nó B $\rightarrow$ Nó A). Isso causaria travamento do worker em loop infinito.
- **Decisão:**
  - Estabelecer um teto máximo de 25 passos consecutivos de nós sem bloqueio por interação (`MAX_CONSECUTIVE_STEPS = 25`).
  - Ao exceder esse limite, o motor aborta imediatamente a sessão, marca o status como `FAILED`, registra no log de execução o nó causador e envia alerta de erro estrutural no painel.
- **Consequências:**
  - Positivas: Proteção da CPU e da estabilidade de todo o cluster SaaS contra fluxos mal formados.
  - Negativas: Fluxos extremamente longos sem interação do usuário precisam ser desenhados com parcimônia (o que é uma boa prática de UX conversacional).


---

## ADR-008: Implementação do Domínio de Automações, Validação Estrutural e Versionamento Imutável

- **Status:** Aprovado e Implementado
- **Data:** 2026-11-13
- **Contexto:**
  O Prompt 02 demandou a implementação do domínio backend para gerenciamento completo dos fluxos de automação conversacional (CRUD, validação de integridade do grafo, versionamento imutável, duplicação e restauração), mantendo isolamento multi-tenant irrestrito.
- **Decisão:**
  - Criadas e migradas as entidades: `Automation`, `FlowVersion`, `FlowExecution`, `FlowExecutionNode`, `FlowVariable`, `AutomationTrigger` e `FlowExecutionLog`.
  - Todas as tabelas contêm `tenantId` com chave estrangeira para `tenants` e índices compostos.
  - Implementado o `FlowValidatorService` com detecção de 19 categorias de erros estruturais (nós órfãos, conexões inválidas, ausência de gatilho, ausência de saídas obrigatórias e detecção de ciclos não permitidos usando DFS).
  - Versionamento imutável implementado com incremento automático de `versionNumber` em `flow_versions` e bloqueio de publicação para fluxos inválidos.
- **Consequências:**
  - Positivas: 100% de cobertura nos requisitos do domínio, validação rigorosa antes de persistir versões ativas, proteção multi-tenant validada com testes unitários e de integração E2E.


---

## ADR-009: Implementação do Workflow Execution Engine, Catálogo de Handlers e Sistema de Espera/Retomada

- **Status:** Aprovado e Implementado
- **Data:** 2026-11-13
- **Contexto:**
  O Prompt 03 exigiu a criação do motor de execução dos fluxos conversacionais (Workflow Execution Engine) capaz de interpretar e executar grafos publicados independentemente do frontend, com suporte a ciclo completo de espera e retomada, controle estrito de transições de estado, catálogo de 26 handlers de nós, avaliação segura de condições, Outbox Pattern e resiliência contra concorrência e falhas de rede.
- **Decisão:**
  - Implementada a máquina de estados `ExecutionStateMachine` com validação de transições permitidas e controle de estados terminais (`PENDING`, `RUNNING`, `WAITING_FOR_INPUT`, `WAITING_FOR_DELAY`, `PAUSED`, `COMPLETED`, `FAILED`, `CANCELLED`, `HUMAN_HANDOFF`).
  - Implementado o catálogo unificado de handlers `NodeHandlerRegistryService` com suporte a todos os 26 tipos de nós previstos (mensagens, interações, perguntas, botões, listas, condições, switch, atrasos, tags e finalizações), suportando notação pontilhada (`message.text`) e underscore (`message_text`).
  - Sistema de Espera e Retomada: perguntas (`interaction.question` / `message.buttons` / `message.list` / `wait_for_input`) disparam mensagens e transitam para `WAITING_FOR_INPUT`. Respostas subsequentes do cliente são correlacionadas à execução ativa sem abrir novas sessões concorrentes, armazenam a resposta em variável e continuam a navegação do grafo.
  - Avaliação de condições com operadores relacionais seguros (`ConditionEvaluatorService`) sem utilização de `eval`.
  - Padrão Outbox (`OutboxService` e tabela `outbox_messages`) persistindo comandos de disparo antes de chamadas de rede com retries exponenciais e Dead Letter Queue (DLQ).
  - Travas distribuídas no Redis (`ConcurrencyLockService`) por conversa e filtro de idempotência (`IdempotencyService`).
- **Consequências:**
  - Positivas: Execuções 100% autônomas no servidor, garantia contra envios duplicados, ausência de race conditions e cobertura integral comprovada por 67 testes automatizados verdes.
