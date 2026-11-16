'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeChange,
  EdgeChange,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import {
  ShieldAlert,
  Trash2,
  Pause,
  RotateCcw,
  CheckCircle,
  X,
} from 'lucide-react';

import {
  CustomFlowNode,
  CustomFlowEdge,
  WorkflowDefinition,
  ValidationErrorDetail,
} from '../../types/flow';
import { CustomFlowNode as CustomNodeComponent } from './nodes/CustomFlowNode';
import { BlockCatalogSidebar } from './BlockCatalogSidebar';
import { FlowHeader } from './FlowHeader';
import { NodeConfigDrawer } from './drawer/NodeConfigDrawer';
import { WhatsAppSimulatorModal } from './simulator/WhatsAppSimulatorModal';
import { ValidationErrorsModal } from './validation/ValidationErrorsModal';
import { FlowApi } from '../../lib/api';
import { getCatalogItemByType, NODE_CATALOG } from '../../lib/default-nodes';
import { generateId } from '../../lib/utils';

const nodeTypes: any = {
  custom: CustomNodeComponent,
  ...NODE_CATALOG.reduce((acc, item) => ({ ...acc, [item.type]: CustomNodeComponent }), {}),
};

// Histórico para Desfazer / Refazer (Undo/Redo)
interface HistoryState {
  nodes: CustomFlowNode[];
  edges: CustomFlowEdge[];
}

interface FlowBuilderProps {
  automationId: string;
  initialDefinition?: WorkflowDefinition;
  initialName?: string;
  initialStatus?: 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'ARCHIVED';
  isViewMode?: boolean;
}

export function FlowBuilderInner({
  automationId,
  initialDefinition,
  initialName = 'Novo Fluxo de Atendimento',
  initialStatus = 'DRAFT',
  isViewMode = false,
}: FlowBuilderProps) {
  const router = useRouter();
  const { screenToFlowPosition, fitView } = useReactFlow();

  // Estados principais
  const [viewMode, setViewMode] = useState(isViewMode);
  const [flowStatus, setFlowStatus] = useState(initialStatus);
  const [flowName, setFlowName] = useState(initialName);
  const [nodes, setNodes] = useState<CustomFlowNode[]>([]);
  const [edges, setEdges] = useState<CustomFlowEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Modais de Ações do Modo Visualização
  const [blockModal, setBlockModal] = useState<{
    action: 'edit' | 'delete';
  } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Histórico para Undo/Redo
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoAction = useRef(false);

  // Status e Painéis
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [isCatalogOpen, setIsCatalogOpen] = useState(!isViewMode);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationModalOpen, setValidationModalOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrorDetail[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<ValidationErrorDetail[]>([]);

  // Instâncias e Conexões
  const [instances, setInstances] = useState<any[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');

  // Sincroniza viewMode e status caso propriedades externas mudem
  useEffect(() => {
    setViewMode(isViewMode);
    setIsCatalogOpen(!isViewMode);
  }, [isViewMode]);

  useEffect(() => {
    if (initialStatus) setFlowStatus(initialStatus);
  }, [initialStatus]);

  // Timer para Autosave
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Inicializa o fluxo
  useEffect(() => {
    if (initialDefinition && initialDefinition.nodes?.length > 0) {
      setNodes(initialDefinition.nodes);
      setEdges(initialDefinition.edges || []);
      setHistory([{ nodes: initialDefinition.nodes, edges: initialDefinition.edges || [] }]);
      setHistoryIndex(0);
    } else {
      // Cria nó de gatilho padrão inicial
      const defaultTrigger: CustomFlowNode = {
        id: 'trigger-start',
        type: 'custom',
        position: { x: 300, y: 150 },
        data: {
          label: 'trigger.keyword',
          category: 'trigger',
          config: { keywords: ['olá', 'preço', 'ajuda'] },
        },
      };

      const defaultMessage: CustomFlowNode = {
        id: 'msg-welcome',
        type: 'custom',
        position: { x: 300, y: 320 },
        data: {
          label: 'message.text',
          category: 'message',
          config: { text: 'Olá! Seja bem-vindo ao nosso atendimento no WhatsApp.' },
        },
      };

      const defaultEdge: CustomFlowEdge = {
        id: 'edge-trigger-msg',
        source: 'trigger-start',
        target: 'msg-welcome',
      };

      setNodes([defaultTrigger, defaultMessage]);
      setEdges([defaultEdge]);
      setHistory([{ nodes: [defaultTrigger, defaultMessage], edges: [defaultEdge] }]);
      setHistoryIndex(0);
    }

    // Carrega instâncias WhatsApp
    FlowApi.listInstances().then((list) => {
      setInstances(list);
      if (list.length > 0) {
        setSelectedInstanceId(list[0].id);
      }
    });
  }, [initialDefinition]);

  // Push para histórico de Undo/Redo
  const pushToHistory = useCallback((newNodes: CustomFlowNode[], newEdges: CustomFlowEdge[]) => {
    if (isUndoRedoAction.current) {
      isUndoRedoAction.current = false;
      return;
    }
    setHistory((prev) => {
      const sliced = prev.slice(0, historyIndex + 1);
      return [...sliced, { nodes: newNodes, edges: newEdges }];
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  // Manipuladores de Mudanças no React Flow
  const onNodesChange = useCallback(
    (changes: NodeChange<any>[]) => {
      setNodes((nds) => {
        const updated = applyNodeChanges(changes, nds) as CustomFlowNode[];
        return updated;
      });
      triggerAutosave();
    },
    [],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<any>[]) => {
      setEdges((eds) => {
        const updated = applyEdgeChanges(changes, eds) as CustomFlowEdge[];
        return updated;
      });
      triggerAutosave();
    },
    [],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge: CustomFlowEdge = {
        id: `e_${connection.source}_${connection.target}_${Date.now()}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        animated: true,
      };

      setEdges((eds) => {
        const updated = addEdge(newEdge, eds) as CustomFlowEdge[];
        pushToHistory(nodes, updated);
        return updated;
      });
      triggerAutosave();
    },
    [nodes, pushToHistory],
  );

  // Debounced Autosave (2.5s)
  const triggerAutosave = () => {
    if (viewMode) return;
    setSaveStatus('unsaved');
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    autosaveTimerRef.current = setTimeout(() => {
      executeSave();
    }, 2500);
  };

  const buildWorkflowDefinition = useCallback((): WorkflowDefinition => {
    const normalizedNodes = nodes.map((n) => {
      const rawType =
        (n.data as any)?.nodeType ||
        (n.data as any)?.type ||
        getCatalogItemByType((n.data as any)?.label)?.type ||
        (n.type !== 'custom' ? n.type : undefined) ||
        (n.data as any)?.label ||
        n.type;

      const rawConfig = (n.data as any)?.config || (n as any).config || {};
      const catalogItem = getCatalogItemByType(rawType);

      return {
        ...n,
        type: rawType,
        config: rawConfig,
        data: {
          ...n.data,
          nodeType: rawType as any,
          type: rawType as any,
          label: catalogItem?.label || n.data?.label || rawType,
          category: catalogItem?.category || n.data?.category || 'action',
          config: rawConfig,
        },
      };
    });

    return {
      schemaVersion: '1.0.0',
      flowId: automationId,
      name: flowName,
      nodes: normalizedNodes,
      edges,
    };
  }, [automationId, flowName, nodes, edges]);

  const executeSave = async () => {
    if (viewMode) return;
    setSaveStatus('saving');
    try {
      const definition = buildWorkflowDefinition();
      await FlowApi.updateDraft(automationId, definition, flowName);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('unsaved');
    }
  };

  // Undo e Redo
  const handleUndo = useCallback(() => {
    if (viewMode) return;
    if (historyIndex > 0) {
      isUndoRedoAction.current = true;
      const targetState = history[historyIndex - 1];
      setNodes(targetState.nodes);
      setEdges(targetState.edges);
      setHistoryIndex((prev) => prev - 1);
      triggerAutosave();
    }
  }, [history, historyIndex, viewMode]);

  const handleRedo = useCallback(() => {
    if (viewMode) return;
    if (historyIndex < history.length - 1) {
      isUndoRedoAction.current = true;
      const targetState = history[historyIndex + 1];
      setNodes(targetState.nodes);
      setEdges(targetState.edges);
      setHistoryIndex((prev) => prev + 1);
      triggerAutosave();
    }
  }, [history, historyIndex, viewMode]);

  // Atalhos de teclado (Ctrl+Z, Ctrl+Y, Ctrl+S, Del, etc.)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewMode) return;
      // Ignora atalhos se estiver digitando em input ou textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        e.preventDefault();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        handleRedo();
        e.preventDefault();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        executeSave();
        e.preventDefault();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) {
          handleDeleteNode(selectedNodeId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, selectedNodeId, viewMode]);

  // Adicionar Nó via Drag & Drop ou Clique
  const handleAddNode = useCallback(
    (type: string, position?: { x: number; y: number }) => {
      if (viewMode) return;
      const catalogItem = getCatalogItemByType(type);
      if (!catalogItem) return;

      const pos = position || {
        x: 400 + Math.random() * 80,
        y: 250 + Math.random() * 80,
      };

      const newNode: CustomFlowNode = {
        id: generateId(catalogItem.category),
        type: 'custom',
        position: pos,
        data: {
          nodeType: catalogItem.type as any,
          type: catalogItem.type as any,
          label: catalogItem.label,
          category: catalogItem.category,
          config: { ...catalogItem.defaultConfig },
        },
      };

      setNodes((prev) => {
        const next = [...prev, newNode];
        pushToHistory(next, edges);
        return next;
      });

      setSelectedNodeId(newNode.id);
      triggerAutosave();
    },
    [edges, pushToHistory, viewMode],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    if (viewMode) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, [viewMode]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      if (viewMode) return;
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      handleAddNode(type, position);
    },
    [screenToFlowPosition, handleAddNode],
  );

  // Duplicar e Excluir Nó
  const handleDuplicateNode = useCallback(
    (nodeId: string) => {
      const source = nodes.find((n) => n.id === nodeId);
      if (!source) return;

      const dupNode: CustomFlowNode = {
        id: generateId('copy'),
        type: 'custom',
        position: { x: source.position.x + 40, y: source.position.y + 40 },
        data: {
          ...source.data,
          config: JSON.parse(JSON.stringify(source.data.config || {})),
        },
      };

      setNodes((prev) => {
        const next = [...prev, dupNode];
        pushToHistory(next, edges);
        return next;
      });
      setSelectedNodeId(dupNode.id);
      triggerAutosave();
    },
    [nodes, edges, pushToHistory],
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((prev) => {
        const next = prev.filter((n) => n.id !== nodeId);
        return next;
      });
      setEdges((prev) => {
        const next = prev.filter((e) => e.source !== nodeId && e.target !== nodeId);
        return next;
      });
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }
      triggerAutosave();
    },
    [selectedNodeId],
  );

  // Atualizar Configuração de um Nó pelo Drawer
  const handleUpdateNodeConfig = useCallback(
    (nodeId: string, updatedConfig: Record<string, any>) => {
      setNodes((prev) =>
        prev.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                config: updatedConfig,
                errorMessage: undefined, // Limpa erro ao alterar
              },
            };
          }
          return node;
        }),
      );
      triggerAutosave();
    },
    [],
  );

  // Validação Visual
  const handleValidate = async () => {
    setIsValidating(true);
    try {
      const definition = buildWorkflowDefinition();

      const result = await FlowApi.validateFlow(automationId, definition);
      setValidationErrors(result.errors || []);
      setValidationWarnings(result.warnings || []);

      // Mapeia erros nos nós para exibição de indicadores visuais
      const errorMap = new Map<string, string>();
      for (const err of result.errors || []) {
        if (err.nodeId) errorMap.set(err.nodeId, err.message);
      }

      setNodes((prev) =>
        prev.map((n) => ({
          ...n,
          data: {
            ...n.data,
            errorMessage: errorMap.get(n.id),
          },
        })),
      );

      setValidationModalOpen(true);
    } catch (err: any) {
      alert(`Falha ao validar: ${err.message}`);
    } finally {
      setIsValidating(false);
    }
  };

  // Publicação de Versão
  const handlePublish = async () => {
    setSaveStatus('saving');
    const definition = buildWorkflowDefinition();

    try {
      // Garante persistência prévia do rascunho no banco antes da publicação
      await FlowApi.updateDraft(automationId, definition, flowName);
      setSaveStatus('saved');

      const res = await FlowApi.publishFlow(
        automationId,
        `Publicado via Construtor Visual em ${new Date().toLocaleString()}`,
        definition,
      );

      alert(`🎉 Versão publicada com sucesso!\nVersão: ${res.version?.versionNumber || 1}`);
    } catch (err: any) {
      setSaveStatus('unsaved');
      const apiErrors = err.response?.data?.errors;
      if (apiErrors && apiErrors.length > 0) {
        setValidationErrors(apiErrors);
        setValidationModalOpen(true);
      } else {
        alert(`Erro na publicação: ${err.response?.data?.message || err.message}`);
      }
    }
  };

  // Highlight de nó durante a simulação
  const handleHighlightSimulatedNode = (nodeId: string | null) => {
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        data: {
          ...n.data,
          isSimulatedActive: n.id === nodeId,
        },
      })),
    );
  };

  // Ações do Modo Visualização
  const handleEditClick = () => {
    if (flowStatus === 'PUBLISHED') {
      setBlockModal({ action: 'edit' });
    } else {
      setViewMode(false);
      setIsCatalogOpen(true);
      window.history.replaceState(null, '', `/automations/${automationId}`);
    }
  };

  const handlePauseAndEdit = async () => {
    try {
      setIsActionLoading(true);
      await FlowApi.pauseAutomation(automationId);
      setFlowStatus('PAUSED');
      setBlockModal(null);
      setViewMode(false);
      setIsCatalogOpen(true);
      window.history.replaceState(null, '', `/automations/${automationId}`);
    } catch (err: any) {
      alert(`Erro ao inativar fluxo: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleInactivate = async () => {
    try {
      setIsActionLoading(true);
      await FlowApi.pauseAutomation(automationId);
      setFlowStatus('PAUSED');
    } catch (err: any) {
      alert(`Erro ao inativar fluxo: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleActivate = async () => {
    try {
      setIsActionLoading(true);
      await FlowApi.activateAutomation(automationId);
      setFlowStatus('PUBLISHED');
    } catch (err: any) {
      alert(`Erro ao ativar fluxo: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteClick = () => {
    if (flowStatus === 'PUBLISHED') {
      setBlockModal({ action: 'delete' });
    } else {
      setDeleteConfirmOpen(true);
    }
  };

  const handleConfirmDelete = async () => {
    try {
      setIsActionLoading(true);
      await FlowApi.deleteAutomation(automationId);
      setDeleteConfirmOpen(false);
      router.push('/automations');
    } catch (err: any) {
      alert(`Erro ao excluir fluxo: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-slate-950 font-sans">
      {/* Barra Superior */}
      <FlowHeader
        flowName={flowName}
        onUpdateFlowName={setFlowName}
        saveStatus={saveStatus}
        onSave={executeSave}
        onValidate={handleValidate}
        onTest={() => setIsSimulatorOpen(true)}
        onPublish={handlePublish}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={historyIndex > 0 && !viewMode}
        canRedo={historyIndex < history.length - 1 && !viewMode}
        errorCount={validationErrors.length}
        instances={instances}
        selectedInstanceId={selectedInstanceId}
        onSelectInstance={setSelectedInstanceId}
        isViewMode={viewMode}
        flowStatus={flowStatus}
        onBack={() => router.push('/automations')}
        onEdit={handleEditClick}
        onInactivate={handleInactivate}
        onActivate={handleActivate}
        onDelete={handleDeleteClick}
      />

      {/* Área Central: Canvas do React Flow */}
      <div className="relative flex-1" onDrop={onDrop} onDragOver={onDragOver}>
        {/* Painel Esquerdo: Catálogo de Blocos (Apenas no Modo Edição) */}
        {!viewMode && (
          <BlockCatalogSidebar
            isOpen={isCatalogOpen}
            onToggle={() => setIsCatalogOpen(!isCatalogOpen)}
            onAddNode={(type) => handleAddNode(type)}
          />
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={!viewMode ? onNodesChange : undefined}
          onEdgesChange={!viewMode ? onEdgesChange : undefined}
          onConnect={!viewMode ? onConnect : undefined}
          nodesDraggable={!viewMode}
          nodesConnectable={!viewMode}
          elementsSelectable={true}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          onPaneClick={() => setSelectedNodeId(null)}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          defaultEdgeOptions={{
            animated: true,
            style: { strokeWidth: 2, stroke: '#64748b' },
          }}
          className="bg-slate-950"
        >
          <Background color="#1e293b" gap={20} size={1.2} />
          <Controls className="!bg-slate-900 !border-slate-800 !rounded-xl !shadow-2xl fill-slate-300" />
          <MiniMap
            nodeColor={(n: any) => {
              if (n.data?.isSimulatedActive) return '#f59e0b';
              if (n.data?.category === 'trigger') return '#8b5cf6';
              if (n.data?.category === 'message') return '#10b981';
              if (n.data?.category === 'interaction') return '#06b6d4';
              if (n.data?.category === 'logic') return '#f59e0b';
              return '#ec4899';
            }}
            className="!bg-slate-900/90 !border-slate-800 !rounded-xl overflow-hidden"
            maskColor="rgba(15, 23, 42, 0.7)"
          />
        </ReactFlow>

        {/* Painel Direito: Configuração do Nó Selecionado */}
        {selectedNode && (
          <NodeConfigDrawer
            selectedNode={selectedNode}
            onClose={() => setSelectedNodeId(null)}
            onUpdateConfig={!viewMode ? handleUpdateNodeConfig : () => {}}
            onDuplicateNode={!viewMode ? handleDuplicateNode : undefined}
            onDeleteNode={!viewMode ? handleDeleteNode : undefined}
          />
        )}
      </div>

      {/* Simulador WhatsApp Web */}
      <WhatsAppSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        nodes={nodes}
        edges={edges}
        onHighlightNode={handleHighlightSimulatedNode}
      />

      {/* Modal de Erros de Validação */}
      <ValidationErrorsModal
        isOpen={validationModalOpen}
        onClose={() => setValidationModalOpen(false)}
        errors={validationErrors}
        warnings={validationWarnings}
        onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
      />

      {/* MODAL: Regra de Negócio para Fluxo Ativo (Bloqueio ou Inativação Prévia) */}
      {blockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-white">
                {blockModal.action === 'edit'
                  ? 'Inativação Necessária para Edição'
                  : 'Não é Possível Excluir Fluxo Ativo'}
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {blockModal.action === 'edit' ? (
                <>
                  O fluxo <strong className="text-white">"{flowName}"</strong> está
                  atualmente <span className="text-emerald-400 font-semibold">Ativo em produção</span>.
                  Pelas regras de governança e integridade, para editar a estrutura ou mensagens de um
                  fluxo, ele precisa estar <strong>pausado ou inativado</strong>.
                </>
              ) : (
                <>
                  O fluxo <strong className="text-white">"{flowName}"</strong> está
                  atualmente <span className="text-emerald-400 font-semibold">Ativo em produção</span>.
                  Para excluir um fluxo criado, ele precisa estar{' '}
                  <strong>pausado, parado ou inativado previamente</strong>.
                </>
              )}
            </p>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setBlockModal(null)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
              >
                Cancelar
              </button>

              {blockModal.action === 'edit' && (
                <button
                  onClick={handlePauseAndEdit}
                  disabled={isActionLoading}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400 transition"
                >
                  {isActionLoading && <RotateCcw className="h-3.5 w-3.5 animate-spin" />}
                  <span>Inativar e Editar</span>
                </button>
              )}

              {blockModal.action === 'delete' && (
                <button
                  onClick={async () => {
                    setBlockModal(null);
                    await handleInactivate();
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400 transition"
                >
                  <Pause className="h-3.5 w-3.5 fill-current" />
                  <span>Inativar Agora</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirmação de Exclusão */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-white">Confirmar Exclusão</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Tem certeza que deseja excluir o fluxo <strong className="text-white">"{flowName}"</strong>?
              Esta ação é irreversível e excluirá todos os nós e configurações.
            </p>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isActionLoading}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 transition"
              >
                {isActionLoading && <RotateCcw className="h-3.5 w-3.5 animate-spin" />}
                <span>Confirmar Exclusão</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function FlowBuilder(props: FlowBuilderProps) {
  return (
    <ReactFlowProvider>
      <FlowBuilderInner {...props} />
    </ReactFlowProvider>
  );
}
