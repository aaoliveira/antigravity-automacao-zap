'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CustomFlowNode, CustomFlowEdge } from '../../../types/flow';
import {
  X,
  Send,
  RotateCcw,
  Smartphone,
  Bot,
  User,
  CheckCheck,
  Check,
  List,
  Variable,
  Activity,
  Play,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text?: string;
  mediaUrl?: string;
  mediaType?: string;
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
  const [isWaitingInput, setIsWaitingInput] = useState(false);
  const [waitingTargetVar, setWaitingTargetVar] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Inicia simulação quando abre o modal
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
    setIsWaitingInput(false);
    setWaitingTargetVar(null);

    // Encontra o nó de gatilho
    const trigger = nodes.find(
      (n) =>
        n.type === 'trigger.keyword' ||
        n.type === 'trigger.message_received' ||
        n.type === 'trigger' ||
        n.data?.label?.startsWith('trigger'),
    );

    if (trigger) {
      startFromNode(trigger.id);
    } else if (nodes.length > 0) {
      startFromNode(nodes[0].id);
    }
  };

  const startFromNode = async (startId: string) => {
    setCurrentNodeId(startId);
    onHighlightNode?.(startId);

    // Navega para o próximo nó conectado ao gatilho
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
    if (!node) return;

    setCurrentNodeId(nodeId);
    onHighlightNode?.(nodeId);

    const type =
      node.data?.label ||
      (node.type !== 'custom' ? node.type : '') ||
      '';
    const config = node.data?.config || {};

    // 1. Nós de Mensagem
    if (type === 'message.text') {
      setIsTyping(true);
      await delay(Math.min((config.delay || 1) * 600, 1500));
      setIsTyping(false);

      const interpolated = interpolateText(config.text || '', variables);
      pushBotMessage({ text: interpolated });

      // Prossegue para o próximo nó
      const nextEdge = edges.find((e) => e.source === nodeId);
      if (nextEdge) {
        await executeNode(nextEdge.target);
      }
      return;
    }

    if (['message.image', 'message.video', 'message.audio', 'message.document'].includes(type)) {
      setIsTyping(true);
      await delay(800);
      setIsTyping(false);

      pushBotMessage({
        mediaUrl: config.url,
        mediaType: type.replace('message.', ''),
        text: config.caption,
      });

      const nextEdge = edges.find((e) => e.source === nodeId);
      if (nextEdge) {
        await executeNode(nextEdge.target);
      }
      return;
    }

    if (type === 'message.buttons') {
      setIsTyping(true);
      await delay(800);
      setIsTyping(false);

      pushBotMessage({
        text: config.description || config.text,
        buttons: config.buttons || [],
      });

      // Aguarda clique em um botão
      setIsWaitingInput(true);
      return;
    }

    // 2. Nós de Interação (Perguntas)
    if (type === 'interaction.question' || type === 'interaction.capture') {
      setIsTyping(true);
      await delay(800);
      setIsTyping(false);

      const questionText = interpolateText(config.questionText || config.question || '', variables);
      pushBotMessage({ text: questionText });

      setIsWaitingInput(true);
      setWaitingTargetVar(config.targetVariable || config.saveVariable || 'resposta');
      return;
    }

    // 3. Nós de Lógica (Condições)
    if (type === 'logic.condition') {
      const isTrue = evaluateCondition(config, variables);
      const targetHandle = isTrue ? 'true' : 'false';

      // Encontra a aresta com o handle correspondente
      let nextEdge = edges.find((e) => e.source === nodeId && e.sourceHandle === targetHandle);
      if (!nextEdge) {
        nextEdge = edges.find((e) => e.source === nodeId);
      }

      if (nextEdge) {
        await executeNode(nextEdge.target);
      }
      return;
    }

    // 4. Delay / Atraso
    if (type === 'logic.delay') {
      setIsTyping(true);
      await delay(Math.min((config.delaySeconds || 2) * 600, 2000));
      setIsTyping(false);

      const nextEdge = edges.find((e) => e.source === nodeId);
      if (nextEdge) {
        await executeNode(nextEdge.target);
      }
      return;
    }

    // 5. Ações (Adicionar Tag, Atualizar Contato, etc.)
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
      }
      return;
    }

    // 6. Encerramento
    if (type === 'action.end') {
      pushBotMessage({ text: '🏁 _Atendimento finalizado pelo sistema._' });
      setIsWaitingInput(false);
      return;
    }

    // Fallback genérico para nós sem parada
    const defaultNext = edges.find((e) => e.source === nodeId);
    if (defaultNext) {
      await executeNode(defaultNext.target);
    }
  };

  /**
   * Envia mensagem do usuário digitada no simulador
   */
  const handleSendMessage = async () => {
    if (!inputValue.trim() || !isWaitingInput) return;

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

    setIsWaitingInput(false);

    // Retoma execução no próximo nó conectado
    if (currentNodeId) {
      const nextEdge = edges.find((e) => e.source === currentNodeId);
      if (nextEdge) {
        await executeNode(nextEdge.target);
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

    setIsWaitingInput(false);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative flex h-[85vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-800 bg-[#0c1317] shadow-2xl">
        {/* Lado Esquerdo: Simulador do WhatsApp Web */}
        <div className="flex flex-1 flex-col border-r border-slate-800">
          {/* Cabeçalho do WhatsApp Web */}
          <div className="flex items-center justify-between border-b border-slate-800 bg-[#202c33] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white font-bold">
                <Bot className="h-5 w-5" />
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#202c33] bg-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">WhatsApp Simulator</h3>
                <span className="text-[11px] text-emerald-400">
                  {isTyping ? 'digitando...' : 'online (Modo de Teste)'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={resetSimulation}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700"
                title="Reiniciar conversa"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reiniciar</span>
              </button>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Área de Conversa (WhatsApp Doodles) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0b141a]">
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
                      <img src={msg.mediaUrl} alt="Mídia" className="max-h-48 w-full object-cover" />
                    </div>
                  )}

                  {/* Texto da Mensagem com quebra de linha */}
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

                  {/* Timestamp e Checks */}
                  <div className="flex items-center justify-end gap-1 pt-1 text-[9px] text-slate-400">
                    <span>{msg.timestamp}</span>
                    {msg.sender === 'user' && (
                      <CheckCheck className="h-3 w-3 text-cyan-400" />
                    )}
                  </div>
                </div>
              </div>
            ))}

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
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                disabled={!isWaitingInput}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={
                  isWaitingInput
                    ? 'Digite sua resposta e pressione Enter...'
                    : 'Aguardando o fluxo de mensagens...'
                }
                className="flex-1 rounded-xl border border-slate-700 bg-[#2a3942] px-4 py-2.5 text-xs text-slate-100 placeholder-slate-400 outline-none focus:border-emerald-500/60 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!isWaitingInput || !inputValue.trim()}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow hover:bg-emerald-500 disabled:opacity-40 transition"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Lado Direito: Painel de Variáveis e Caminho Executado */}
        <div className="hidden w-80 flex-col bg-slate-900/90 p-4 md:flex">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Variable className="h-4 w-4 text-emerald-400" />
            <h4 className="text-xs font-semibold text-slate-100">Variáveis da Sessão</h4>
          </div>

          <div className="flex-1 overflow-y-auto py-3 space-y-2">
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
            <span className="font-semibold text-slate-300 block pb-1">Modo Seguro:</span>
            As mensagens são executadas apenas neste simulador virtual, sem consumir limites nem disparar envios reais pelo WhatsApp.
          </div>
        </div>
      </div>
    </div>
  );
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
