'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CustomFlowNode, CustomFlowEdge } from '../../../types/flow';
import {
  X,
  Send,
  RotateCcw,
  Bot,
  User,
  CheckCheck,
  Variable,
  Activity,
  Play,
  KeyRound,
  MessageSquare,
  Sparkles,
  Info,
  ShieldCheck,
  FileText,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user' | 'system';
  text?: string;
  mediaUrl?: string;
  mediaType?: string;
  fileName?: string;
  buttons?: Array<{ id: string; displayText: string }>;
  listSections?: any[];
  timestamp: string;
}

interface WhatsAppSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: CustomFlowNode[];
  edges: CustomFlowEdge[];
  onHighlightNode?: (nodeId: string | null) => void;
}

type SimulationState = 'WAITING_TRIGGER' | 'RUNNING' | 'WAITING_INPUT' | 'FINISHED';

export function WhatsAppSimulatorModal({
  isOpen,
  onClose,
  nodes,
  edges,
  onHighlightNode,
}: WhatsAppSimulatorModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [variables, setVariables] = useState<Record<string, any>>({
    'contact.name': 'Cliente Teste',
    'contact.phone': '5511999998888',
  });
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [simulationState, setSimulationState] = useState<SimulationState>('WAITING_TRIGGER');
  const [waitingTargetVar, setWaitingTargetVar] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Lista todos os nós de gatilho do fluxo
  const triggerNodes = useMemo(() => {
    return nodes.filter(isTriggerNode);
  }, [nodes]);

  // Extrai todas as palavras-chave declaradas nos gatilhos
  const allKeywords = useMemo(() => {
    const kws = new Set<string>();
    for (const node of triggerNodes) {
      for (const kw of getTriggerKeywords(node)) {
        kws.add(kw);
      }
    }
    return Array.from(kws);
  }, [triggerNodes]);

  const hasKeywordTriggers = allKeywords.length > 0;

  // Inicia ou reinicia simulação quando o modal abre
  useEffect(() => {
    if (isOpen) {
      resetSimulation();
    } else {
      onHighlightNode?.(null);
    }
  }, [isOpen]);

  const resetSimulation = () => {
    setMessages([]);
    setVariables({
      'contact.name': 'Cliente Teste',
      'contact.phone': '5511999998888',
    });
    setSimulationState('WAITING_TRIGGER');
    setWaitingTargetVar(null);
    setCurrentNodeId(null);
    onHighlightNode?.(null);
    setInputValue('');
  };

  /**
   * Envia uma mensagem do cliente para tentar acionar o gatilho
   */
  const handleSendTriggerMessage = async (userText: string) => {
    const text = userText.trim();
    if (!text) return;

    setInputValue('');

    // Adiciona o balão de mensagem do cliente no chat
    const userMsg: ChatMessage = {
      id: `usr_trig_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Se o fluxo não tiver gatilhos formais cadastrados, inicia do primeiro nó
    if (triggerNodes.length === 0) {
      if (nodes.length > 0) {
        setSimulationState('RUNNING');
        setVariables((prev) => ({
          ...prev,
          'message.text': text,
          last_message: text,
        }));
        await startFromNode(nodes[0].id);
      }
      return;
    }

    // Busca o nó de gatilho que corresponde à mensagem enviada pelo cliente
    const matchedTrigger = triggerNodes.find((n) => matchesTrigger(n, text));

    if (matchedTrigger) {
      setSimulationState('RUNNING');
      setVariables((prev) => ({
        ...prev,
        'message.text': text,
        last_message: text,
      }));
      setCurrentNodeId(matchedTrigger.id);
      onHighlightNode?.(matchedTrigger.id);

      // Executa o primeiro nó conectado a este gatilho
      const nextEdge = edges.find((e) => e.source === matchedTrigger.id);
      if (nextEdge) {
        await executeNode(nextEdge.target);
      } else {
        pushBotMessage({
          text: '⚠️ _O nó de gatilho não possui nenhuma conexão de saída configurada._',
        });
        setSimulationState('FINISHED');
      }
    } else {
      // Palavra-chave não corresponde aos gatilhos cadastrados
      setIsTyping(true);
      await delay(500);
      setIsTyping(false);

      const kwsList = allKeywords.map((k) => `"${k}"`).join(', ');
      pushBotMessage({
        text: `Nenhum gatilho ativado para "${text}".\n\n💡 Experimente enviar uma das palavras-chave configuradas: ${kwsList || 'qualquer mensagem'}`,
      });
      // Permanece aguardando o gatilho correto
      setSimulationState('WAITING_TRIGGER');
    }
  };

  /**
   * Inicia o fluxo a partir de um nó específico
   */
  const startFromNode = async (startId: string) => {
    setCurrentNodeId(startId);
    onHighlightNode?.(startId);

    const nextEdge = edges.find((e) => e.source === startId);
    if (nextEdge) {
      await executeNode(nextEdge.target);
    }
  };

  /**
   * Executa a lógica de um nó no simulador
   */
  const executeNode = async (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) {
      setSimulationState('FINISHED');
      return;
    }

    setCurrentNodeId(nodeId);
    onHighlightNode?.(nodeId);

    const type =
      (node.data as any)?.nodeType ||
      (node.data as any)?.type ||
      node.data?.label ||
      (node.type !== 'custom' ? node.type : '') ||
      '';
    const config = node.data?.config || (node as any).config || {};

    // 1. Mensagem de Texto
    if (type === 'message.text' || type === 'message_text') {
      setIsTyping(true);
      await delay(Math.min((config.delay || 1) * 600, 1400));
      setIsTyping(false);

      const interpolated = interpolateText(config.text || '', variables);
      pushBotMessage({ text: interpolated });

      const nextEdge = edges.find((e) => e.source === nodeId);
      if (nextEdge) {
        await executeNode(nextEdge.target);
      } else {
        setSimulationState('FINISHED');
      }
      return;
    }

    // 2. Mensagens de Mídia (Imagem, Vídeo, Áudio, Documento)
    if (['message.image', 'message.video', 'message.audio', 'message.document'].includes(type)) {
      setIsTyping(true);
      await delay(800);
      setIsTyping(false);

      pushBotMessage({
        mediaUrl: config.url,
        mediaType: type.replace('message.', ''),
        fileName: config.fileName,
        text: config.caption,
      });

      const nextEdge = edges.find((e) => e.source === nodeId);
      if (nextEdge) {
        await executeNode(nextEdge.target);
      } else {
        setSimulationState('FINISHED');
      }
      return;
    }

    // 3. Botões Interativos
    if (type === 'message.buttons' || type === 'message_buttons') {
      setIsTyping(true);
      await delay(700);
      setIsTyping(false);

      pushBotMessage({
        text: config.description || config.text,
        buttons: config.buttons || [],
      });

      // Aguarda o usuário clicar em um botão ou responder
      setSimulationState('WAITING_INPUT');
      return;
    }

    // 4. Pergunta e Captura de Resposta
    if (
      type === 'interaction.question' ||
      type === 'interaction.capture' ||
      type === 'interaction_question'
    ) {
      setIsTyping(true);
      await delay(700);
      setIsTyping(false);

      const questionText = interpolateText(config.questionText || config.question || '', variables);
      pushBotMessage({ text: questionText });

      setSimulationState('WAITING_INPUT');
      setWaitingTargetVar(config.targetVariable || config.saveVariable || 'resposta');
      return;
    }

    // 5. Condições Relacionais
    if (type === 'logic.condition' || type === 'condition') {
      const isTrue = evaluateCondition(config, variables);
      const targetHandle = isTrue ? 'true' : 'false';

      let nextEdge = edges.find((e) => e.source === nodeId && e.sourceHandle === targetHandle);
      if (!nextEdge) {
        nextEdge = edges.find((e) => e.source === nodeId);
      }

      if (nextEdge) {
        await executeNode(nextEdge.target);
      } else {
        setSimulationState('FINISHED');
      }
      return;
    }

    // 6. Delay / Espera
    if (type === 'logic.delay' || type === 'delay') {
      setIsTyping(true);
      await delay(Math.min((config.delaySeconds || 2) * 600, 1800));
      setIsTyping(false);

      const nextEdge = edges.find((e) => e.source === nodeId);
      if (nextEdge) {
        await executeNode(nextEdge.target);
      } else {
        setSimulationState('FINISHED');
      }
      return;
    }

    // 7. Ações de CRM (Tags, Atualizar Contato)
    if (type === 'action.add_tag') {
      if (config.tag) {
        setVariables((prev) => ({
          ...prev,
          tags: [...(prev.tags || []), config.tag],
        }));
      }
      const nextEdge = edges.find((e) => e.source === nodeId);
      if (nextEdge) {
        await executeNode(nextEdge.target);
      } else {
        setSimulationState('FINISHED');
      }
      return;
    }

    // 8. Transbordo Humano
    if (type === 'action.human_handoff') {
      pushBotMessage({
        text: '👤 _Você está sendo transferido para um atendente humano. Aguarde um instante..._',
      });
      setSimulationState('FINISHED');
      return;
    }

    // 9. Encerramento do Fluxo
    if (type === 'action.end' || type === 'end_flow') {
      pushBotMessage({ text: '🏁 _Atendimento finalizado pelo sistema._' });
      setSimulationState('FINISHED');
      return;
    }

    // Fallback genérico para outros blocos
    const defaultNext = edges.find((e) => e.source === nodeId);
    if (defaultNext) {
      await executeNode(defaultNext.target);
    } else {
      setSimulationState('FINISHED');
    }
  };

  /**
   * Envia mensagem do usuário digitada durante o fluxo (quando aguardando resposta)
   */
  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userText = inputValue.trim();
    setInputValue('');

    // Adiciona balão do usuário
    setMessages((prev) => [
      ...prev,
      {
        id: `usr_${Date.now()}`,
        sender: 'user',
        text: userText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    // Salva na variável se estiver aguardando pergunta
    if (waitingTargetVar) {
      setVariables((prev) => ({
        ...prev,
        [waitingTargetVar]: userText,
      }));
      setWaitingTargetVar(null);
    }

    setSimulationState('RUNNING');

    // Retoma execução no próximo nó conectado
    if (currentNodeId) {
      const nextEdge = edges.find((e) => e.source === currentNodeId);
      if (nextEdge) {
        await executeNode(nextEdge.target);
      } else {
        setSimulationState('FINISHED');
      }
    }
  };

  /**
   * Simula clique em botão de resposta rápida
   */
  const handleButtonClick = async (btn: { id: string; displayText: string }) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `btn_click_${Date.now()}`,
        sender: 'user',
        text: btn.displayText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    setSimulationState('RUNNING');

    // Encontra a aresta que sai deste botão específico (sourceHandle === btn.id)
    if (currentNodeId) {
      let nextEdge = edges.find(
        (e) => e.source === currentNodeId && e.sourceHandle === btn.id,
      );
      if (!nextEdge) {
        nextEdge = edges.find((e) => e.source === currentNodeId);
      }

      if (nextEdge) {
        await executeNode(nextEdge.target);
      } else {
        setSimulationState('FINISHED');
      }
    }
  };

  const pushBotMessage = (partial: Partial<ChatMessage>) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `bot_${Date.now()}_${Math.random()}`,
        sender: 'bot',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ...partial,
      },
    ]);
  };

  const isInputEnabled =
    simulationState === 'WAITING_TRIGGER' || simulationState === 'WAITING_INPUT';

  const inputPlaceholder =
    simulationState === 'WAITING_TRIGGER'
      ? hasKeywordTriggers
        ? `Envie uma palavra do gatilho (ex: ${allKeywords.slice(0, 2).join(', ')})...`
        : 'Envie qualquer mensagem para iniciar o fluxo...'
      : simulationState === 'WAITING_INPUT'
      ? 'Digite sua resposta e pressione Enter...'
      : simulationState === 'FINISHED'
      ? 'Atendimento finalizado. Clique em Reiniciar para testar novamente.'
      : 'Aguardando o fluxo de mensagens...';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative flex h-[85vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-800 bg-[#0c1317] shadow-2xl">
        {/* Lado Esquerdo: Simulador do WhatsApp Web */}
        <div className="flex flex-1 flex-col border-r border-slate-800">
          {/* Cabeçalho do WhatsApp Web */}
          <div className="flex items-center justify-between border-b border-slate-800 bg-[#202c33] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white font-bold shadow">
                <Bot className="h-5 w-5" />
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#202c33] bg-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">WhatsApp Simulator</h3>
                <span className="text-[11px] text-emerald-400">
                  {isTyping
                    ? 'digitando...'
                    : simulationState === 'WAITING_TRIGGER'
                    ? 'online • aguardando mensagem do cliente'
                    : simulationState === 'WAITING_INPUT'
                    ? 'online • aguardando sua resposta'
                    : simulationState === 'FINISHED'
                    ? 'online • conversa finalizada'
                    : 'online (Modo de Teste)'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={resetSimulation}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700 transition"
                title="Reiniciar conversa"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reiniciar</span>
              </button>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
                title="Fechar simulador"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Área de Conversa */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0b141a]">
            {/* Aviso de Criptografia / Ambiente de Simulação */}
            <div className="mx-auto flex max-w-fit items-center gap-1.5 rounded-lg bg-[#182229] px-3 py-1.5 text-[10px] text-amber-200/90 shadow">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
              <span>Ambiente de Simulação Virtual. As mensagens não são enviadas ao WhatsApp real.</span>
            </div>

            {/* Banner Inicial de Interação do Gatilho */}
            {simulationState === 'WAITING_TRIGGER' && messages.length === 0 && (
              <div className="mx-auto my-4 max-w-md rounded-2xl border border-slate-800 bg-[#202c33]/85 p-5 text-center shadow-xl backdrop-blur-sm">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 shadow">
                  <KeyRound className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-bold text-white">Simulação de Interação do Cliente</h4>
                <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                  {hasKeywordTriggers
                    ? 'Envie uma das palavras-chave configuradas no gatilho para disparar o atendimento:'
                    : 'Envie qualquer mensagem ou texto para acionar o gatilho e iniciar o fluxo:'}
                </p>

                {/* Sugestões de Palavras-Chave Clicáveis */}
                {allKeywords.length > 0 && (
                  <div className="mt-3.5 flex flex-wrap items-center justify-center gap-1.5">
                    {allKeywords.map((kw) => (
                      <button
                        key={kw}
                        type="button"
                        onClick={() => handleSendTriggerMessage(kw)}
                        className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 active:scale-95 transition shadow"
                        title={`Clique para enviar "${kw}" como cliente`}
                      >
                        "{kw}"
                      </button>
                    ))}
                  </div>
                )}

                {/* Ação Rápida de Disparo Padrão */}
                <div className="mt-4 border-t border-slate-700/60 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      const firstKw = allKeywords[0] || 'olá';
                      handleSendTriggerMessage(firstKw);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Iniciar automaticamente com "{allKeywords[0] || 'olá'}"</span>
                  </button>
                </div>
              </div>
            )}

            {/* Balões de Mensagens */}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`relative max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs shadow-md ${
                    msg.sender === 'user'
                      ? 'rounded-tr-none bg-[#005c4b] text-slate-100'
                      : 'rounded-tl-none bg-[#202c33] text-slate-100'
                  }`}
                >
                  {/* Prévia de Mídia */}
                  {msg.mediaUrl && (
                    <div className="mb-2 overflow-hidden rounded-lg">
                      {msg.mediaType === 'video' ? (
                        <video controls src={msg.mediaUrl} className="max-h-48 w-full rounded-lg" />
                      ) : msg.mediaType === 'audio' ? (
                        <audio controls src={msg.mediaUrl} className="w-full" />
                      ) : msg.mediaType === 'document' ? (
                        <div className="flex items-center gap-2.5 rounded-lg border border-slate-700/60 bg-slate-900/80 p-2.5">
                          <FileText className="h-6 w-6 text-emerald-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="block truncate text-xs font-medium text-slate-200">
                              {msg.fileName || 'documento.pdf'}
                            </span>
                            <span className="text-[10px] text-slate-400">Documento anexado</span>
                          </div>
                        </div>
                      ) : (
                        <img src={msg.mediaUrl} alt="Mídia" className="max-h-48 w-full object-cover" />
                      )}
                    </div>
                  )}

                  {/* Texto da Mensagem */}
                  {msg.text && (
                    <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>
                  )}

                  {/* Botões Interativos Clicáveis */}
                  {msg.buttons && msg.buttons.length > 0 && (
                    <div className="mt-2.5 flex flex-col gap-1.5 pt-2 border-t border-slate-700/60">
                      {msg.buttons.map((btn) => (
                        <button
                          key={btn.id}
                          onClick={() => handleButtonClick(btn)}
                          className="w-full rounded-xl border border-emerald-500/30 bg-[#111b21] py-2 px-3 text-center text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 active:scale-98 transition shadow"
                        >
                          {btn.displayText}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Timestamp e Status de Entrega */}
                  <div className="flex items-center justify-end gap-1 pt-1 text-[9px] text-slate-400">
                    <span>{msg.timestamp}</span>
                    {msg.sender === 'user' && (
                      <CheckCheck className="h-3 w-3 text-cyan-400" />
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Indicador de Digitação */}
            {isTyping && (
              <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-none bg-[#202c33] px-4 py-2.5 w-24 text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Barra de Digitação */}
          <div className="border-t border-slate-800 bg-[#202c33] p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (simulationState === 'WAITING_TRIGGER') {
                  handleSendTriggerMessage(inputValue);
                } else if (simulationState === 'WAITING_INPUT') {
                  handleSendMessage();
                }
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                disabled={!isInputEnabled}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={inputPlaceholder}
                className="flex-1 rounded-xl border border-slate-700 bg-[#2a3942] px-4 py-2.5 text-xs text-slate-100 placeholder-slate-400 outline-none focus:border-emerald-500/60 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!isInputEnabled || !inputValue.trim()}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow hover:bg-emerald-500 disabled:opacity-40 transition"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Lado Direito: Painel de Informações e Variáveis */}
        <div className="hidden w-80 flex-col bg-slate-900/90 p-4 md:flex">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Activity className="h-4 w-4 text-emerald-400" />
            <h4 className="text-xs font-semibold text-slate-100">Estado da Simulação</h4>
          </div>

          <div className="py-3 border-b border-slate-800/80">
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 block mb-1">
              Gatilhos Configurados
            </span>
            {triggerNodes.length === 0 ? (
              <span className="text-xs text-slate-400">Nenhum gatilho declarado.</span>
            ) : (
              <div className="space-y-1.5">
                {triggerNodes.map((trig) => {
                  const kws = getTriggerKeywords(trig);
                  return (
                    <div
                      key={trig.id}
                      className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200">
                          {trig.data?.label || trig.type}
                        </span>
                        <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-mono text-violet-300">
                          Gatilho
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        {kws.length > 0 ? `Palavras: ${kws.join(', ')}` : 'Qualquer mensagem recebida'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Variáveis da Sessão */}
          <div className="flex items-center gap-2 pt-3 pb-2">
            <Variable className="h-4 w-4 text-cyan-400" />
            <h4 className="text-xs font-semibold text-slate-100">Variáveis da Sessão</h4>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 py-1">
            {Object.entries(variables).map(([key, val]) => (
              <div
                key={key}
                className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 text-xs"
              >
                <span className="font-mono text-[11px] text-cyan-400 block truncate">
                  {`{{${key}}}`}
                </span>
                <span className="font-medium text-slate-200 block pt-0.5 break-all">
                  {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                </span>
              </div>
            ))}
          </div>

          {/* Dica Informativa */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-[11px] text-slate-400">
            <span className="font-semibold text-slate-300 block pb-1">Interação do Usuário:</span>
            O simulador aguarda o cliente enviar as palavras-chave do gatilho para iniciar o atendimento.
          </div>
        </div>
      </div>
    </div>
  );
}

function isTriggerNode(node: CustomFlowNode): boolean {
  const type =
    (node.data as any)?.nodeType ||
    (node.data as any)?.type ||
    node.data?.label ||
    node.type ||
    '';
  return (
    type === 'trigger' ||
    type.startsWith('trigger.') ||
    type.startsWith('trigger_') ||
    node.data?.category === 'trigger'
  );
}

function getTriggerKeywords(node: CustomFlowNode): string[] {
  const config = node.data?.config || (node as any).config || {};
  if (Array.isArray(config.keywords)) {
    return config.keywords.map((k: any) => String(k).trim()).filter(Boolean);
  }
  if (typeof config.keywords === 'string') {
    return config.keywords.split(',').map((k: string) => k.trim()).filter(Boolean);
  }
  if (typeof config.keyword === 'string' && config.keyword.trim()) {
    return [config.keyword.trim()];
  }
  return [];
}

function matchesTrigger(node: CustomFlowNode, userText: string): boolean {
  const type =
    (node.data as any)?.nodeType ||
    (node.data as any)?.type ||
    node.data?.label ||
    node.type ||
    '';
  const config = node.data?.config || (node as any).config || {};

  // Se for gatilho genérico de qualquer mensagem recebida
  if (
    type === 'trigger.message_received' ||
    type === 'trigger_message_received' ||
    config.matchType === 'any'
  ) {
    return true;
  }

  const keywords = getTriggerKeywords(node);
  if (keywords.length === 0) {
    return true;
  }

  const matchType = (config.matchType || 'contains').toLowerCase();
  const normalizedUserText = userText.trim().toLowerCase();

  return keywords.some((kw) => {
    const normalizedKw = kw.toLowerCase();
    if (matchType === 'exact') {
      return normalizedUserText === normalizedKw;
    }
    if (matchType === 'startswith' || matchType === 'starts_with') {
      return normalizedUserText.startsWith(normalizedKw);
    }
    return normalizedUserText.includes(normalizedKw);
  });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function interpolateText(raw: string, vars: Record<string, any>): string {
  return raw.replace(/\{\{([a-zA-Z0-9_.-]+)\}\}/g, (_, key) => {
    return vars[key] !== undefined ? String(vars[key]) : `{{${key}}}`;
  });
}

function evaluateCondition(config: Record<string, any>, vars: Record<string, any>): boolean {
  const rules = config.rules || [];
  if (rules.length === 0) return true;

  const results = rules.map((r: any) => {
    const actual = vars[r.variable];
    const expected = r.value;

    switch (r.operator) {
      case 'EQUALS':
        return String(actual).toLowerCase() === String(expected).toLowerCase();
      case 'NOT_EQUALS':
        return String(actual).toLowerCase() !== String(expected).toLowerCase();
      case 'CONTAINS':
        return String(actual || '').toLowerCase().includes(String(expected || '').toLowerCase());
      case 'IS_NOT_EMPTY':
        return actual !== undefined && actual !== null && String(actual).trim() !== '';
      case 'IS_EMPTY':
        return actual === undefined || actual === null || String(actual).trim() === '';
      default:
        return true;
    }
  });

  if (config.logicalOperator === 'OR') {
    return results.some(Boolean);
  }
  return results.every(Boolean);
}
