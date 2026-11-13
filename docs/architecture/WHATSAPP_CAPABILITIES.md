# Matriz de Capacidades do Provedor WhatsApp (WhatsApp Capabilities Matrix)

> **Documento:** WhatsApp Integration & Connector Capabilities Specification  
> **Status:** Aprovado para Implementação  
> **Versão:** 1.0.0  
> **Data:** 13 de Novembro de 2026  
> **Autor:** Staff Software Engineer & Software Architect  

---

## 1. Visão Geral e Contexto Técnico

A plataforma utiliza a **Evolution API v2** como gateway de comunicação com o WhatsApp. No entanto, no ecossistema do WhatsApp, os comportamentos de entrega e suporte a componentes visuais (botões, listas e enquetes) variam criticamente de acordo com o conector subjacente configurado na instância:

1. **`WHATSAPP-BAILEYS`:** Emulador Web Multi-Device baseado no protocolo reverso do WhatsApp Web. É gratuito, ágil e não cobra por conversas iniciadas, porém sofre constantes descontinuidades impostas pela Meta para mensagens interativas nativas (botões e listas).
2. **`WHATSAPP-BUSINESS` (Meta Cloud API Oficial):** Conexão oficial corporativa via Meta Graph API. Suporta botões de resposta rápida e listas nativas com 100% de estabilidade visual em todas as plataformas móveis, mas exige conformidade com a janela de 24 horas e aprovação de modelos (*templates*).

---

## 2. Matriz Comparativa de Capacidades por Conector

| Recurso do Flow Builder | Suporte no Baileys (`WHATSAPP-BAILEYS`) | Suporte no Cloud API (`WHATSAPP-BUSINESS`) | Endpoint Oficial da Evolution API | Estratégia de Fallback Recomendada |
| :--- | :---: | :---: | :--- | :--- |
| **Texto Simples e Spintax** | **NATIVO** | **NATIVO** | `POST /message/sendText/{instance}` | N/A (Suportado universalmente) |
| **Imagem com Legenda** | **NATIVO** | **NATIVO** | `POST /message/sendMedia/{instance}` | N/A |
| **Áudio Gravado na Hora (PTT)** | **NATIVO** | **NATIVO** | `POST /message/sendWhatsAppAudio/{instance}` | Enviar como áudio regular |
| **Vídeo com Legenda** | **NATIVO** | **NATIVO** | `POST /message/sendMedia/{instance}` | N/A |
| **Documento (PDF/Docx/XLSX)** | **NATIVO** | **NATIVO** | `POST /message/sendMedia/{instance}` | N/A |
| **Simulação de Digitação** | **NATIVO** | **NATIVO** | `POST /chat/sendPresence/{instance}` | N/A |
| **Botões de Resposta Rápida (1 a 3)** | **INSTÁVEL / DESCONTINUADO** | **NATIVO** | `POST /message/sendButtons/{instance}` | **Fallback para Menu Textual Numerado ou Enquete (`sendPoll`)** |
| **Lista Interativa de Opções** | **EXPERIMENTAL / INSTÁVEL** | **NATIVO** | `POST /message/sendList/{instance}` | **Fallback para Menu Textual Estruturado por Seções** |
| **Enquetes (Polls)** | **NATIVO** | **LIMITADO** | `POST /message/sendPoll/{instance}` | Texto com opções |
| **Janela de 24 Horas** | **SEM RESTRIÇÃO** | **OBRIGATÓRIA** | Regra de negócio Meta | Envio de Template Pré-aprovado |
| **Confirmação de Leitura (Check Azul)** | **NATIVO** | **NATIVO** | `POST /chat/markMessageAsRead/{instance}` | N/A |

---

## 3. Detalhamento e Regras de Fallback para `WHATSAPP-BAILEYS`

### 3.1 O Problema dos Botões Interativos no Baileys
Na versão atual do WhatsApp para Android e iOS, mensagens enviadas via emulação Baileys utilizando o endpoint `/message/sendButtons` frequentemente **não são exibidas** na tela do cliente final (chegam invisíveis ou o app ignora a renderização), embora o servidor retorne HTTP `200 OK`.

### 3.2 Estratégia 1: Fallback para Menu Textual Numerado (Padrão)
Quando uma instância com conector Baileys precisar executar um nó de botões ou listas e o atributo `fallbackToTextList` estiver ativo (padrão `true`), o motor transforma a mensagem no formato:

```text
Como podemos te ajudar hoje?

1️⃣ Comprar Produtos
2️⃣ Falar com Suporte

👉 Responda com o número ou nome da opção desejada.
```

O analisador de entrada (`InboundParser`) reconhece tanto o número (`1`, `2`) quanto termos aproximados (`comprar`, `produtos`, `suporte`), direcionando a conversa para a respectiva porta de saída do nó (`btn_vendas` ou `btn_suporte`).

### 3.3 Estratégia 2: Fallback para Enquetes Nativas (`POST /message/sendPoll`)
No Baileys, o WhatsApp suporta perfeitamente o envio de enquetes interativas com opção única de voto. O motor pode despachar:
```json
{
  "number": "5511999999999",
  "name": "Como podemos te ajudar hoje?",
  "selectableCount": 1,
  "values": [
    "Comprar Produtos",
    "Falar com Suporte"
  ]
}
```
Ao votar, a Evolution API emite o webhook `messages.upsert` com `pollUpdateMessage`, permitindo que o motor capture a escolha com clique em tela sem digitação.

---

## 4. Políticas de Segurança, Anti-Ban e Anti-Spam

Para conexões Baileys, a perda de números por bloqueio de spam é o maior risco operacional. O motor de execução implementa nativamente as seguintes proteções:

1. **Jitter de Atraso Humano:** Antes de qualquer envio de texto, aplicar delay aleatório entre 1.200ms e 2.800ms.
2. **Presença Ativa:**
   - Para envio de texto: acionar presença `composing` durante o delay.
   - Para envio de áudio: acionar presença `recording` durante o delay equivalente à duração do áudio (máx 5s).
3. **Limite de Taxa por Instância (Rate Limiting):**
   - Máximo de 1 mensagem por segundo por contato.
   - Máximo de 20 disparos por minuto por instância em mensagens não solicitadas.
4. **Proteção contra Spam de Grupos:**
   - Fluxos padrão operam exclusivamente em conversas individuais (`remoteJid` terminado em `@s.whatsapp.net`).
   - Interações em grupos (`@g.us`) são bloqueadas por padrão no motor, exceto se expressamente autorizadas na configuração do fluxo.
