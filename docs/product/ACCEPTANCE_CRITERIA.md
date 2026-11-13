# Critérios de Aceite da Primeira Entrega (Acceptance Criteria)

> **Documento:** Functional & Technical Acceptance Criteria  
> **Status:** Aprovado para Homologação  
> **Versão:** 1.0.0  
> **Data:** 13 de Novembro de 2026  
> **Padrão:** Given-When-Then (Gherkin BDD)  

---

## 1. Construtor Visual (Frontend)

### AC-001: Interação no Canvas e Adição de Nós
- **Dado** que o operador está autenticado e acessa a tela de edição de fluxo,
- **Quando** ele arrasta um nó da barra lateral (ex: `message_text`, `buttons`, `condition`) para o canvas,
- **Então** o nó deve ser renderizado nas coordenadas corretas com suas portas de entrada e saída correspondentes.

### AC-002: Validação de Conexões entre Portas
- **Dado** que existem nós no canvas,
- **Quando** o operador tenta conectar uma porta de saída a uma porta de entrada incompatível (ex: conectar saída de um nó na entrada de um nó `trigger`, ou ligar um nó a si mesmo),
- **Então** o canvas deve impedir a criação do edge e exibir feedback visual de conexão inválida.

### AC-003: Edição de Propriedades na Gaveta Lateral
- **Dado** que um nó está selecionado no canvas,
- **Quando** o operador clica sobre o nó,
- **Então** a gaveta lateral de configuração deve abrir apresentando os campos específicos do tipo do nó (ex: texto e Spintax para `message_text`, lista de botões para `buttons`, regras para `condition`), persistindo alterações no estado local do grafo.

### AC-004: Validação Estrutural Antes da Publicação
- **Dado** que o operador clica no botão "Publicar Fluxo",
- **Quando** o grafo contiver nós desconectados (órfãos), loops fechados sem nó bloqueante (`wait_reply`, `question_input`, `delay`) ou ausência de nó `trigger`,
- **Então** o sistema deve bloquear a publicação, destacar os nós problemáticos em vermelho e exibir a lista de pendências impeditivas.

### AC-005: Versionamento e Publicação Imutável
- **Dado** um fluxo válido no construtor,
- **Quando** o operador confirma a publicação,
- **Então** o backend deve registrar uma nova linha imutável na tabela `flow_versions` com número de versão incrementado (ex: `v2`), definir `isPublished = true` e atualizar o ponteiro `activeVersionId` no fluxo.

---

## 2. Ingestão de Webhooks e Identificação de Fluxos (Backend)

### AC-006: Ingestão de Webhooks com Idempotência
- **Dado** um evento `messages.upsert` enviado pela Evolution API,
- **Quando** o webhook atinge a rota `POST /webhooks/evolution/:instanceId`,
- **Então** o backend deve retornar status HTTP `200 OK` em menos de 100ms, verificar se o `data.key.id` já foi processado no Redis e, caso seja inédito, despachar o payload para a fila `flow-inbound-queue`.

### AC-007: Resolução de Sessão Ativa vs. Novo Gatilho
- **Dado** um evento na fila `flow-inbound-queue`,
- **Quando** o contato já possuir uma sessão com status `WAITING_USER_INPUT`,
- **Então** o motor deve entregar a mensagem para a sessão corrente sem avaliar palavras-chave de outros fluxos.
- **Quando** o contato não possuir sessão ativa,
- **Então** o motor deve avaliar os nós `trigger` publicados para o tenant e, havendo correspondência, instanciar uma nova `FlowSession` no estado `RUNNING`.

### AC-008: Controle Atômico de Concorrência
- **Dado** que um usuário envia duas mensagens quase instantaneamente no WhatsApp,
- **Quando** ambos os webhooks chegarem ao backend,
- **Então** o mecanismo de trava atômica no Redis (`lock:session:{tenantId}:{remoteJid}`) deve processar a primeira mensagem até o próximo estado bloqueante e manter a segunda na fila até a liberação do lock, evitando execuções bifurcadas.

---

## 3. Execução de Nós de Comunicação

### AC-009: Mensagem de Texto com Spintax e Variáveis
- **Dado** que o fluxo atinge um nó `message_text` com o texto `{Olá|Oi} {{contact.name}}, seu saldo é {{saldo}}!`,
- **Quando** o worker do BullMQ processa o nó,
- **Então** ele deve sortear uma opção de Spintax, substituir as variáveis pelos valores reais da sessão/contato e disparar `POST /message/sendText` para a Evolution API com delay humanizado.

### AC-010: Mensagem de Mídia com Legenda
- **Dado** um nó `message_media` com URL pública de imagem e legenda configurada,
- **Quando** o nó é executado,
- **Então** a Evolution API deve receber `POST /message/sendMedia` contendo `mediatype: "image"`, a URL da mídia e a legenda interpolada, entregando o arquivo no WhatsApp do cliente.

### AC-011: Botões com Fallback Inteligente para Baileys
- **Dado** um nó `buttons` com 2 opções ("Comprar", "Suporte"),
- **Quando** a instância conectada for do provedor `WHATSAPP-BAILEYS`,
- **Então** o motor deve enviar o menu textual formatado numerado (`1️⃣ Comprar\n2️⃣ Suporte`) e o analisador deve aceitar tanto a digitação do número (`1`) quanto da palavra (`comprar`) para avançar para o próximo nó.

---

## 4. Execução de Lógica, Controle e Variáveis

### AC-012: Pergunta, Validação e Captura de Resposta
- **Dado** um nó `question_input` configurado para capturar `email` na variável `user_email`,
- **Quando** o cliente responde `carlos.silva@exemplo.com`,
- **Então** o motor valida o formato, grava a variável em `session_variables` e avança pelo caminho de sucesso.
- **Quando** o cliente responde um texto inválido (ex: `não quero`),
- **Então** o motor envia a mensagem de erro configurada, incrementa o contador de tentativas e mantém a sessão em `WAITING_USER_INPUT`.

### AC-013: Condição If/Else e Switch
- **Dado** um nó `condition` avaliando `{{idade}} >= 18`,
- **Quando** o valor for `20`,
- **Então** a execução deve seguir obrigatoriamente pela saída `true`.
- **Quando** o valor for `16`,
- **Então** a execução deve seguir obrigatoriamente pela saída `false`.

### AC-014: Atrasos (Delay) com Presença
- **Dado** um nó `delay` configurado com 4 segundos e presença `composing`,
- **Quando** o nó é processado,
- **Então** o motor envia `sendPresence: composing`, pausa a execução via delayed job no BullMQ por 4.000ms e retoma automaticamente a execução do próximo nó após o término do tempo.

### AC-015: Timeout em Espera por Resposta
- **Dado** um nó `wait_reply` com timeout de 30 minutos,
- **Quando** o cliente não interagir dentro da janela de 30 minutos,
- **Então** o job agendado acorda, altera o nó para a porta `timeout` e continua o fluxo pelo caminho de lembrete ou encerramento.

---

## 5. Finalização e Transição de Atendimento

### AC-016: Transferência para Atendimento Humano
- **Dado** um nó `human_transfer`,
- **Quando** o fluxo o alcança,
- **Então** a sessão deve transitar para `HANDOVER_HUMAN`, o bot deve cessar imediatamente respostas automáticas para mensagens subsequentes desse contato e disparar evento de alerta no painel de atendimento.

### AC-017: Encerramento do Fluxo
- **Dado** um nó `end_flow`,
- **Quando** o fluxo o alcança,
- **Então** a sessão é marcada como `COMPLETED`, o registro de auditoria é consolidado com tempo total de conversa e o contato fica elegível para novos fluxos.

---

## 6. Critérios de Segurança e Robustez

### AC-018: Isolamento Multi-tenant
- **Dado** dois tenants distintos A e B cadastrados no sistema,
- **Quando** mensagens chegarem para instâncias do tenant A,
- **Então** em hipótese alguma variáveis, contatos, fluxos ou logs do tenant B poderão ser acessados ou alterados.

### AC-019: Proteção Anti-Loop
- **Dado** um fluxo mal configurado contendo loop fechado de mensagens sem nós bloqueantes,
- **Quando** o motor atingir 25 passos consecutivos em uma única mensagem recebida,
- **Então** a sessão deve ser abortada com status `FAILED`, registrando alerta crítico no log de execução e protegendo o servidor contra sobrecarga.
