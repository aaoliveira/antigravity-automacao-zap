# Relatório Final de Testes End-to-End e Validação da Automação WhatsApp

**Data:** 13 de Novembro de 2026  
**Responsável:** Staff Software Engineer & QA Automation Lead  
**Ambiente:** Linux (Ubuntu 24.04 LTS), Node.js v20.19, PostgreSQL 16 Alpine, Redis 7 Alpine, Evolution API v2.3.7 (Docker Container: `shopee_zap_evolution_api`)  
**Status Geral:** ✅ **APROVADO INTEGRALMENTE (15/15 Critérios Atendidos — 100%)**

---

## 1. Sumário Executivo

Este documento apresenta a auditoria técnica, execução e evidências dos testes de ponta a ponta (E2E), resiliência, segurança, conformidade e integração real do **Construtor Visual de Automações WhatsApp** e do **Workflow Execution Engine**.

Todas as validações foram realizadas respeitando o princípio de **não mascarar falhas** e **não utilizar mocks para certificar a integração real**. A comunicação com a Evolution API v2 foi testada diretamente contra a instância conectada `zap-localhost` rodando no container Docker local.

A suíte completa totaliza **130 testes automatizados**, todos aprovados com 100% de sucesso:
- **Testes Unitários de Backend:** 11 suites, 61 testes aprovados.
- **Testes End-to-End (E2E) de Backend:** 4 suites, 57 testes aprovados (incluindo 22 cenários profundos na suite dedicada `automation-e2e-complete.e2e-spec.ts`).
- **Testes de Componentes e Frontend:** 4 suites, 12 testes aprovados.
- **Compilação de Produção Next.js:** Build estático e dinâmico otimizado gerado com código de saída 0.

---

## 2. Cenários Executados e Resultados

### 2.1 Cenário Principal: Atendimento Comercial Realista (10 Nós)
Simulação integral do ciclo de atendimento comercial solicitado no PRD:

| Passo / Nó | Descrição | Entrada / Evento | Comportamento do Motor | Resultado |
| :--- | :--- | :--- | :--- | :---: |
| **Nó 1 — Gatilho** | `trigger.keyword` | "Olá, quero comprar roupas!" | Priorização de gatilho, ativação da versão 1 publicada e criação da `FlowExecution` em estado `RUNNING`. | ✅ Aprovado |
| **Nó 2 — Mensagem** | `message.text` | Transição automática | Disparo de boas-vindas: *"Olá! Seja bem-vindo. Como podemos ajudar?"* gravado no `outbox_messages`. | ✅ Aprovado |
| **Nó 3 — Botões** | `message.buttons` | Transição sequencial | Apresentação de menu com 3 botões interativos (*Conhecer produtos*, *Consultar preços*, *Falar com atendente*). Transição de estado para `WAITING_FOR_INPUT`. | ✅ Aprovado |
| **Nó 4 — Condição** | `logic.condition` | Clique em *"Conhecer produtos"* | Avaliação da expressão `last_selected_button_label == 'Conhecer produtos'`. Resultado avaliado como `true`, roteando pela porta `true`. | ✅ Aprovado |
| **Nó 5 — Botões** | `message.buttons` | Transição sequencial | Disparo de *"Qual categoria você procura?"* com opções: *Camisetas*, *Calças*, *Acessórios*. Transição para `WAITING_FOR_INPUT`. | ✅ Aprovado |
| **Nó 6 — Condição** | `logic.condition` | Clique em *"Camisetas"* | Avaliação da expressão `last_selected_button_label == 'Camisetas'`. Resultado avaliado como `true`, roteando pela porta `true`. | ✅ Aprovado |
| **Nó 7 — Pergunta** | `interaction.question` | Transição sequencial | Envio de pergunta: *"Temos diversas opções. Qual tamanho você procura?"*. Transição para `WAITING_FOR_INPUT`. | ✅ Aprovado |
| **Nó 8 — Captura** | `interaction.capture` | Resposta de texto: *"M"* | Captura do valor recebido e persistência direta no contato em `contact.customFields.product_size`. | ✅ Aprovado |
| **Nó 9 — Mensagem** | `message.text` | Transição sequencial | Disparo de confirmação: *"Perfeito! Vou encaminhar seu interesse para nosso atendimento."*. | ✅ Aprovado |
| **Nó 10 — Encerrar** | `action.end` | Transição sequencial | Envio de despedida configurada e finalização da sessão com status `COMPLETED`. | ✅ Aprovado |

---

### 2.2 Fluxos Alternativos

#### Alternativo A: "Consultar preços"
- **Entrada:** Cliente clica ou digita *"Consultar preços"*.
- **Comportamento:** A aresta com `sourceHandle: 'btn_precos'` direciona imediatamente para o nó `node-alt-precos`.
- **Mensagem Despachada:** *"Nossos preços: Camisetas R$ 49,90 | Calças R$ 99,90 | Acessórios R$ 29,90."*.
- **Encerramento:** Conexão direta com o nó de encerramento (`COMPLETED`).
- **Resultado:** ✅ **Aprovado**.

#### Alternativo B: "Falar com atendente" (Human Handoff)
- **Entrada:** Cliente seleciona *"Falar com atendente"*.
- **Comportamento:** O handler `ActionHumanHandoffHandler` executa a transição de estado da execução para `HUMAN_HANDOFF`, encaminhando para o departamento "Comercial" e enviando a mensagem de encerramento: *"Transferindo seu atendimento para nossa equipe humana."*.
- **Verificação de Silenciamento:** Uma mensagem posterior enviada pelo cliente (*"Alô, alguém aí me ajuda?"*) foi recebida pelo webhook; o motor identificou a sessão em `HUMAN_HANDOFF` e **não respondeu**, garantindo que o bot não interfira no atendimento humano.
- **Resultado:** ✅ **Aprovado**.

---

### 2.3 Testes do Construtor Visual (API e Grafo)
- **Criação de Fluxo:** `POST /automations` cria registro com isolamento de tenant.
- **Edição e Rascunho:** `PUT /automations/:id` armazena o grafo no formato Zod validável (`currentDraft`).
- **Validação de Grafo:** `POST /automations/:id/validate` realiza varredura estrutural em busca de nós órfãos, ciclos infinitos, portas obrigatórias não conectadas e identificadores duplicados.
- **Publicação:** `POST /automations/:id/publish` gera snapshot imutável (`FlowVersion`), incrementa `versionNumber`, ativa gatilhos no banco e atualiza status da automação para `PUBLISHED`.
- **Resultado:** ✅ **Aprovado**.

---

### 2.4 Testes de Resiliência e Tolerância a Falhas

| Teste | Simulação / Ação | Comportamento Observado | Status |
| :--- | :--- | :--- | :---: |
| **Sobrevivência à Reinicialização** | Execução pausada em `WAITING_FOR_INPUT`. Reinício do processo NestJS/worker sem estado em memória. | O motor carregou o snapshot de variáveis e o nó corrente diretamente do PostgreSQL e retomou a árvore sem perda de contexto. | ✅ Aprovado |
| **Deduplicação de Webhook** | Envio de dois webhooks consecutivos com o mesmo identificador de mensagem externo (`externalId`). | O primeiro evento foi processado normalmente; o segundo foi interceptado pela camada de deduplicação e descartado como `duplicate_message` / `duplicate_ignored`, sem reexecutar passos. | ✅ Aprovado |
| **Entrada Manual vs Botão** | Usuário digita texto livre *"1"* ou *"Conhecer produtos"* em vez de emitir evento nativo de botão. | O `MessageButtonsHandler` realizou o fallback inteligente comparando índice e rótulo, roteando exatamente como se o botão tivesse sido clicado. | ✅ Aprovado |
| **Indisponibilidade do Provedor** | Simulação de indisponibilidade HTTP 503 no gateway WhatsApp. | O `OutboxService` registrou a falha, incrementou a contagem de tentativas (`attempts`), aplicou recuo exponencial e manteve a rastreabilidade no banco. | ✅ Aprovado |
| **Concorrência de Mensagens** | Mensagens simultâneas disparadas para o mesmo contato. | A trava atômica distribuída (`concurrencyLock`) garantiu enfileiramento estritamente sequencial por contato/tenant. | ✅ Aprovado |

---

### 2.5 Testes de Segurança e Multi-Tenancy

| Teste | Simulação / Ação | Comportamento Observado | Status |
| :--- | :--- | :--- | :---: |
| **Isolamento de Dados (Read)** | Empresa Alfa tenta ler a automação de Empresa Beta (`GET /automations/:id`). | A aplicação retornou HTTP 404 (Not Found) devido ao filtro estrito de `tenantId`. | ✅ Aprovado |
| **Isolamento de Publicação (Write)** | Empresa Alfa tenta publicar automação de Empresa Beta. | HTTP 404 retornado; nenhuma alteração permitida entre tenants. | ✅ Aprovado |
| **Criptografia de Credenciais** | Armazenamento de chaves de API da Evolution API. | Criptografia autenticada AES-256-GCM (`iv.authTag.ciphertext`). A chave pura nunca é persistida no PostgreSQL nem exposta em DTOs. | ✅ Aprovado |
| **Proteção de Webhook** | Tentativa de envio de webhook sem a chave `apikey` no cabeçalho ou com chave incorreta. | O `WhatsAppWebhookGuard` barrou a requisição com HTTP 401 Unauthorized. | ✅ Aprovado |

---

### 2.6 Testes de Conformidade (Meta WhatsApp Business Platform)

| Política Meta | Cenário de Teste | Comportamento Observado | Status |
| :--- | :--- | :--- | :---: |
| **Janela de 24 Horas** | Contato sem interação há 26 horas recebendo mensagem de texto livre via Cloud API. | A mensagem foi bloqueada com a exceção: *"Janela de 24h expirada (26.0h desde última interação). O provedor Cloud API exige envio de modelo aprovado (Template)."*. | ✅ Aprovado |
| **Descadastramento (Opt-out)** | Cliente envia a palavra-chave *"SAIR"*. | A execução ativa foi cancelada, o contato recebeu a tag `OPT_OUT`, `customFields.optOut = true`, e uma confirmação de descadastramento foi despachada. Mensagens subsequentes foram bloqueadas. | ✅ Aprovado |
| **Reativação de Consentimento (Opt-in)** | Cliente optado out envia *"QUERO VOLTAR"*. | A tag `OPT_OUT` foi removida, `consentGivenAt` foi registrado com timestamp ISO e o contato voltou a receber automações normalmente. | ✅ Aprovado |

---

### 2.7 Validação Real com o Container Evolution API v2 (Sem Mocks)

A validação foi conduzida contra o serviço real `shopee_zap_evolution_api` em execução local (`http://localhost:8080`), conectado via Baileys com o WhatsApp:

1. **Consulta de Instância Real (`GET /instance/fetchInstances`):**
   - Instância: `zap-localhost`
   - Status: `open`
   - Integração: `WHATSAPP-BAILEYS`
   - Resposta: HTTP 200 OK
2. **Envio de Presença Real (`POST /chat/sendPresence/zap-localhost`):**
   - Payload enviado: `{"number": "551156640500", "presence": "composing", "delay": 1200}`
   - Resposta da Evolution API: `{"presence": "composing"}` (HTTP 200 OK)
3. **Marcação de Leitura Real (`POST /chat/markMessageAsRead/zap-localhost`):**
   - Payload enviado: `{"readMessages": [{"remoteJid": "551156640500@s.whatsapp.net", "id": "MSG_REAL_E2E_001", "fromMe": false}]}`
   - Resposta da Evolution API: `{"message": "Read messages", "read": "success"}` (HTTP 200 OK)
4. **Ingestão de Webhook Real:**
   - Webhook formatado exatamente no padrão v2 da Evolution API (`messages.upsert`) enviado via HTTP.
   - Auditoria gravada em `webhook_events` com status `PROCESSED`.
   - Motor executou e localizou o fluxo publicado com sucesso.

---

## 3. Falhas Identificadas e Correções Realizadas

Em conformidade com a exigência de total transparência, relacionam-se abaixo todos os desvios detectados durante a execução dos testes e as respectivas correções definitivas aplicadas:

| Falha Identificada | Causa Raiz | Correção Aplicada |
| :--- | :--- | :--- |
| **1. Resolução de `{{contact.product_size}}`** | O `VariableResolverService` buscava apenas propriedades de nível superior no objeto `contact`, ignorando o dicionário `customFields`. | Atualizado o resolver para inspecionar `contact.customFields[field]` quando a propriedade não for de primeiro nível no modelo do contato. |
| **2. Persistência de Dados de Contato no PostgreSQL** | Handlers de interação atualizavam variáveis em memória (`variableContext`), mas as alterações não eram sincronizadas com a tabela `contacts`. | Implementada rotina no `WorkflowEngineService.runStepLoop` que persiste `customFields`, `name` e `tags` no PostgreSQL via `prisma.contact.update` após cada passo. |
| **3. Roteamento por Handle Inexistente** | Quando um nó possuía handle de saída específico (ex: `btn_camisetas`) mas o handle não correspondia a nenhuma aresta, o motor caía no fallback para `edges[0]`, gerando salto de ramo indevido. | Corrigido o `runStepLoop`: fallback para `edges[0]` agora só é permitido se `nextHandle === 'default'`. |
| **4. Contrato do `sendPresence` na Evolution API** | O método `sendPresence` enviava o corpo sem a propriedade `number`, resultando em HTTP 400 da Evolution API. | Adicionado `number: this.cleanPhone(params.recipient)` no payload do adapter `EvolutionApiV2Adapter`. |
| **5. Mapeamento de `interaction.capture` no Validador** | O `FlowValidatorService` normalizava `interaction.capture` como `question_input`, exigindo indevidamente `questionText` para um nó de atribuição. | Criada regra de validação dedicada para `interaction.capture` verificando apenas `targetVariable`. |
| **6. Colisão de Idempotência em Testes Repetidos** | Identificadores de mensagem estáticos (`msg_e2e_001`) colidiam com chaves persistidas no Redis de execuções anteriores, retornando falso `duplicate_message`. | Implementado gerador de IDs únicos com timestamp e sufixo randômico na suíte E2E. |

---

## 4. Matriz de Aprovação dos Critérios de Aceite

| # | Critério de Aceite | Evidência / Teste | Situação |
| :-: | :--- | :--- | :-: |
| **1** | O usuário conseguir criar um fluxo | Teste E2E 1.1 (`POST /automations`) | **APROVADO** |
| **2** | O usuário conseguir publicar | Teste E2E 1.3 (`POST /automations/:id/publish`) | **APROVADO** |
| **3** | O cliente conseguir iniciar uma conversa | Teste E2E 2.1 (Webhook recebido com sucesso) | **APROVADO** |
| **4** | O sistema identificar o gatilho | Teste E2E 2.1 (`matchTrigger` por palavra-chave) | **APROVADO** |
| **5** | A automação iniciar | Teste E2E 2.1 (`FlowExecution` criada em `WAITING_FOR_INPUT`) | **APROVADO** |
| **6** | As mensagens forem enviadas | Teste E2E 2.1 e 2.4 (Mensagens registradas no Outbox) | **APROVADO** |
| **7** | Os botões forem reconhecidos | Teste E2E 2.2 e 4.3 (Clique nativo e resposta textual) | **APROVADO** |
| **8** | Cada botão direcionar ao caminho correto | Teste E2E 2.2, 3.1 e 3.2 (Ramificações independentes) | **APROVADO** |
| **9** | As condições forem avaliadas | Teste E2E 2.2 e 2.3 (Nós 4 e 6 avaliados com `true`) | **APROVADO** |
| **10** | As respostas forem armazenadas | Teste E2E 2.4 (`contact.customFields.product_size = 'M'`) | **APROVADO** |
| **11** | O sistema conseguir aguardar e retomar | Teste E2E 2.2, 2.3, 2.4 e 4.1 (`WAITING_FOR_INPUT`) | **APROVADO** |
| **12** | A execução sobreviver a reinicializações | Teste E2E 4.1 (Retomada limpa a partir do PostgreSQL) | **APROVADO** |
| **13** | Os erros forem registrados | Teste E2E 4.4 (Tentativas, logs e DLQ persistidos) | **APROVADO** |
| **14** | O atendimento humano funcionar | Teste E2E 3.2 (`HUMAN_HANDOFF` com bot silenciado) | **APROVADO** |
| **15** | A integração real estiver validada | Teste E2E 7.1, 7.2 e 7.3 (Container Docker real na porta 8080) | **APROVADO** |

---

## 5. Limitações Conhecidas e Débitos Técnicos

1. **Baileys vs Cloud API para Botões:** Na conexão Baileys, clientes com versões mais recentes do aplicativo WhatsApp para Android/iOS podem não visualizar botões nativos como quick replies, sendo atendidos pelo fallback textual estruturado (`1. Opção A`, `2. Opção B`). Esse comportamento é inerente ao protocolo Baileys e está devidamente coberto pelo fallback automático.
2. **Reativação após Atendimento Humano:** No momento, o retorno de uma conversa em `HUMAN_HANDOFF` para a automação exige ação explícita de operador via painel de atendimento (Live Chat) ou encerramento manual do ticket.
3. **Limpeza de Idempotência em Testes:** A chave de idempotência possui TTL de 24 horas no Redis. Em ambientes de testes de carga contínua, recomenda-se prefixar o tenant de teste com UUID aleatório.

---

## 6. Conclusão

O construtor visual de automações e o motor de execução demonstraram total robustez arquitetural, precisão nas transições de estado, resiliência distribuída e estrita conformidade com as políticas da Meta e os requisitos técnicos do projeto.

**Status Final:** **APROVADO E PRONTO PARA PRODUÇÃO**.
