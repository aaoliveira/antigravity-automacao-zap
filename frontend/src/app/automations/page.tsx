'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Zap,
  Plus,
  Eye,
  Pencil,
  Trash2,
  Pause,
  Play,
  RotateCcw,
  Search,
  Workflow,
  AlertTriangle,
  CheckCircle,
  Clock,
  Layers,
  ArrowRight,
  X,
  FileEdit,
  ShieldAlert,
} from 'lucide-react';
import { FlowApi } from '../../lib/api';
import { AutomationDetails } from '../../types/flow';

export default function AutomationsListPage() {
  const router = useRouter();

  const [automations, setAutomations] = useState<AutomationDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PUBLISHED' | 'PAUSED' | 'DRAFT'>('ALL');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Mensagens de feedback (Toast/Alerta)
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);

  // Modais
  const [newFlowModalOpen, setNewFlowModalOpen] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');
  const [newFlowDesc, setNewFlowDesc] = useState('');
  const [creatingFlow, setCreatingFlow] = useState(false);

  const [blockModal, setBlockModal] = useState<{
    flow: AutomationDetails;
    action: 'edit' | 'delete';
  } | null>(null);

  const [deleteConfirmFlow, setDeleteConfirmFlow] = useState<AutomationDetails | null>(null);

  const showNotification = (type: 'success' | 'error' | 'warning', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4000);
  };

  const loadAutomations = async () => {
    try {
      setLoading(true);
      const data = await FlowApi.listAutomations();
      setAutomations(data);
    } catch (err: any) {
      showNotification('error', `Falha ao carregar fluxos: ${err.message || 'Erro de conexão'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAutomations();
  }, []);

  // Métricas
  const metrics = useMemo(() => {
    const total = automations.length;
    const active = automations.filter((a) => a.status === 'PUBLISHED').length;
    const paused = automations.filter((a) => a.status === 'PAUSED').length;
    const drafts = automations.filter((a) => a.status === 'DRAFT').length;
    return { total, active, paused, drafts };
  }, [automations]);

  // Filtro
  const filteredAutomations = useMemo(() => {
    return automations.filter((a) => {
      const matchQuery =
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.description && a.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'PUBLISHED' && a.status === 'PUBLISHED') ||
        (statusFilter === 'PAUSED' && a.status === 'PAUSED') ||
        (statusFilter === 'DRAFT' && a.status === 'DRAFT');
      return matchQuery && matchStatus;
    });
  }, [automations, searchQuery, statusFilter]);

  // Ação: Inativar / Pausar
  const handlePause = async (flow: AutomationDetails) => {
    try {
      setActionLoadingId(flow.id);
      await FlowApi.pauseAutomation(flow.id);
      showNotification('success', `Fluxo "${flow.name}" foi inativado com sucesso.`);
      setAutomations((prev) =>
        prev.map((item) => (item.id === flow.id ? { ...item, status: 'PAUSED' } : item)),
      );
    } catch (err: any) {
      showNotification('error', `Erro ao inativar fluxo: ${err.response?.data?.message || err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Ação: Ativar
  const handleActivate = async (flow: AutomationDetails) => {
    try {
      setActionLoadingId(flow.id);
      await FlowApi.activateAutomation(flow.id);
      showNotification('success', `Fluxo "${flow.name}" reativado com sucesso.`);
      setAutomations((prev) =>
        prev.map((item) => (item.id === flow.id ? { ...item, status: 'PUBLISHED' } : item)),
      );
    } catch (err: any) {
      showNotification('error', `Erro ao ativar fluxo: ${err.response?.data?.message || err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Ação: Tentar Editar
  const handleTryEdit = (flow: AutomationDetails) => {
    if (flow.status === 'PUBLISHED') {
      // Bloqueia e exibe modal de aviso conforme regra de negócio
      setBlockModal({ flow, action: 'edit' });
    } else {
      router.push(`/automations/${flow.id}`);
    }
  };

  // Inativar e Editar
  const handlePauseAndEdit = async () => {
    if (!blockModal) return;
    const { flow } = blockModal;
    try {
      setActionLoadingId(flow.id);
      await FlowApi.pauseAutomation(flow.id);
      setBlockModal(null);
      router.push(`/automations/${flow.id}`);
    } catch (err: any) {
      showNotification('error', `Erro ao inativar fluxo para edição: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Ação: Tentar Excluir
  const handleTryDelete = (flow: AutomationDetails) => {
    if (flow.status === 'PUBLISHED') {
      // Bloqueia com aviso conforme regra de negócio
      setBlockModal({ flow, action: 'delete' });
    } else {
      setDeleteConfirmFlow(flow);
    }
  };

  // Confirmar Exclusão
  const handleConfirmDelete = async () => {
    if (!deleteConfirmFlow) return;
    try {
      setActionLoadingId(deleteConfirmFlow.id);
      await FlowApi.deleteAutomation(deleteConfirmFlow.id);
      showNotification('success', `Fluxo "${deleteConfirmFlow.name}" excluído com sucesso.`);
      setAutomations((prev) => prev.filter((item) => item.id !== deleteConfirmFlow.id));
      setDeleteConfirmFlow(null);
    } catch (err: any) {
      showNotification('error', `Erro ao excluir fluxo: ${err.response?.data?.message || err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Criar Novo Fluxo
  const handleCreateNewFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFlowName.trim()) return;

    try {
      setCreatingFlow(true);
      const created = await FlowApi.createAutomation(newFlowName.trim(), newFlowDesc.trim() || undefined);
      showNotification('success', `Fluxo "${created.name}" criado com sucesso!`);
      setNewFlowModalOpen(false);
      setNewFlowName('');
      setNewFlowDesc('');
      router.push(`/automations/${created.id}`);
    } catch (err: any) {
      showNotification('error', `Erro ao criar fluxo: ${err.response?.data?.message || err.message}`);
    } finally {
      setCreatingFlow(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Topo / Navbar */}
      <nav className="flex h-16 items-center justify-between border-b border-slate-800/80 px-8 bg-slate-900/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition">
              <Zap className="h-5 w-5" />
            </div>
            <span className="text-base font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              ZapFlow SaaS
            </span>
          </Link>
          <span className="text-slate-600 font-medium">/</span>
          <span className="text-sm font-semibold text-slate-300">Automações de Mensagens</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setNewFlowModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 active:scale-95 transition shadow-lg shadow-emerald-500/20"
          >
            <Plus className="h-4 w-4" />
            <span>Criar Novo Fluxo</span>
          </button>
        </div>
      </nav>

      {/* Notificação Toast */}
      {notification && (
        <div className="fixed top-20 right-8 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-md ${
              notification.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-950/90 text-emerald-200'
                : notification.type === 'error'
                ? 'border-rose-500/40 bg-rose-950/90 text-rose-200'
                : 'border-amber-500/40 bg-amber-950/90 text-amber-200'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            )}
            <span className="text-xs font-medium">{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-2 text-slate-400 hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Conteúdo Principal */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col gap-8">
        {/* Cabeçalho da Seção & Resumo */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Fluxos de Atendimento e Automação
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Gerencie, visualize e monitore os fluxos conversacionais integrados ao WhatsApp.
            </p>
          </div>

          <button
            onClick={loadAutomations}
            disabled={loading}
            className="flex items-center gap-1.5 self-start md:self-auto rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-700 hover:text-white transition"
            title="Atualizar lista"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>

        {/* Cards de Métricas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <span className="text-[11px] font-medium text-slate-400">Total de Fluxos</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-white">{metrics.total}</span>
              <Workflow className="h-4 w-4 text-slate-500" />
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-4">
            <span className="text-[11px] font-medium text-emerald-400">Ativos em Produção</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-emerald-300">{metrics.active}</span>
              <Play className="h-4 w-4 text-emerald-400 fill-current" />
            </div>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-4">
            <span className="text-[11px] font-medium text-amber-400">Inativos / Pausados</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-amber-300">{metrics.paused}</span>
              <Pause className="h-4 w-4 text-amber-400 fill-current" />
            </div>
          </div>

          <div className="rounded-2xl border border-sky-500/20 bg-sky-950/10 p-4">
            <span className="text-[11px] font-medium text-sky-400">Rascunhos em Edição</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-sky-300">{metrics.drafts}</span>
              <FileEdit className="h-4 w-4 text-sky-400" />
            </div>
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar fluxos por nome ou descrição..."
              className="w-full rounded-xl border border-slate-800 bg-slate-900/60 pl-10 pr-4 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none transition"
            />
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/40 p-1">
            {(
              [
                { key: 'ALL', label: 'Todos' },
                { key: 'PUBLISHED', label: 'Ativos' },
                { key: 'PAUSED', label: 'Inativos' },
                { key: 'DRAFT', label: 'Rascunhos' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  statusFilter === tab.key
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabela de Listagem */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden shadow-xl">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <RotateCcw className="h-8 w-8 animate-spin text-emerald-500 mb-3" />
              <span className="text-xs font-medium">Carregando lista de automações...</span>
            </div>
          ) : filteredAutomations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-slate-400 mb-3">
                <Workflow className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200">Nenhum fluxo encontrado</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                {searchQuery || statusFilter !== 'ALL'
                  ? 'Nenhum fluxo corresponde aos filtros aplicados.'
                  : 'Crie seu primeiro fluxo de automação para começar a atender no WhatsApp.'}
              </p>
              {!searchQuery && statusFilter === 'ALL' && (
                <button
                  onClick={() => setNewFlowModalOpen(true)}
                  className="mt-4 flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition"
                >
                  <Plus className="h-4 w-4" />
                  <span>Criar Primeiro Fluxo</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-slate-950/60 text-slate-400">
                    <th className="py-3.5 px-6 font-semibold">Nome da Automação</th>
                    <th className="py-3.5 px-4 font-semibold">Status</th>
                    <th className="py-3.5 px-4 font-semibold">Versões</th>
                    <th className="py-3.5 px-4 font-semibold">Execuções</th>
                    <th className="py-3.5 px-4 font-semibold">Última Atualização</th>
                    <th className="py-3.5 px-6 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredAutomations.map((flow) => {
                    const isRowBusy = actionLoadingId === flow.id;
                    const isPublished = flow.status === 'PUBLISHED';
                    const isPaused = flow.status === 'PAUSED';
                    const isDraft = flow.status === 'DRAFT';

                    return (
                      <tr
                        key={flow.id}
                        className="hover:bg-slate-800/30 transition-colors group"
                      >
                        {/* Nome & Descrição */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                                isPublished
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : isPaused
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                              }`}
                            >
                              <Workflow className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-100 group-hover:text-emerald-400 transition-colors">
                                {flow.name}
                              </span>
                              {flow.description && (
                                <span className="text-[11px] text-slate-400 line-clamp-1 max-w-xs">
                                  {flow.description}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="py-4 px-4">
                          {isPublished && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Ativo
                            </span>
                          )}
                          {isPaused && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                              Inativo / Pausado
                            </span>
                          )}
                          {isDraft && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 border border-sky-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-sky-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                              Rascunho
                            </span>
                          )}
                        </td>

                        {/* Versões */}
                        <td className="py-4 px-4 text-slate-300">
                          <span className="font-medium">
                            {flow.versionCount ? `v${flow.versionCount}` : '—'}
                          </span>
                        </td>

                        {/* Execuções */}
                        <td className="py-4 px-4 text-slate-300">
                          <span className="font-medium">{flow.executionCount ?? 0}</span>
                        </td>

                        {/* Atualização */}
                        <td className="py-4 px-4 text-slate-400">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-500" />
                            <span>
                              {flow.updatedAt
                                ? new Date(flow.updatedAt).toLocaleDateString('pt-BR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '—'}
                            </span>
                          </div>
                        </td>

                        {/* Botões de Ações (Visualizar, Editar, Inativar, Excluir) */}
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* 1. Botão Visualizar */}
                            <Link
                              href={`/automations/${flow.id}?mode=view`}
                              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-slate-300 hover:border-slate-600 hover:text-white transition"
                              title="Visualizar fluxo (Modo Leitura)"
                            >
                              <Eye className="h-3.5 w-3.5 text-cyan-400" />
                              <span>Visualizar</span>
                            </Link>

                            {/* 2. Botão Editar */}
                            <button
                              onClick={() => handleTryEdit(flow)}
                              disabled={isRowBusy}
                              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 transition ${
                                isPublished
                                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                                  : 'border-slate-700 bg-slate-800/80 text-slate-300 hover:border-slate-600 hover:text-white'
                              }`}
                              title={
                                isPublished
                                  ? 'Fluxo ativo: clique para inativar e editar'
                                  : 'Editar fluxo no construtor'
                              }
                            >
                              <Pencil className="h-3.5 w-3.5 text-indigo-400" />
                              <span>Editar</span>
                            </button>

                            {/* 3. Botão Inativar / Ativar */}
                            {isPublished && (
                              <button
                                onClick={() => handlePause(flow)}
                                disabled={isRowBusy}
                                className="flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-amber-300 hover:bg-amber-500/20 transition"
                                title="Inativar/Pausar fluxo"
                              >
                                {isRowBusy ? (
                                  <RotateCcw className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Pause className="h-3.5 w-3.5 fill-current" />
                                )}
                                <span>Inativar</span>
                              </button>
                            )}

                            {isPaused && (
                              <button
                                onClick={() => handleActivate(flow)}
                                disabled={isRowBusy}
                                className="flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-emerald-300 hover:bg-emerald-500/20 transition"
                                title="Reativar fluxo em produção"
                              >
                                {isRowBusy ? (
                                  <RotateCcw className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Play className="h-3.5 w-3.5 fill-current" />
                                )}
                                <span>Ativar</span>
                              </button>
                            )}

                            {/* 4. Botão Excluir */}
                            <button
                              onClick={() => handleTryDelete(flow)}
                              disabled={isRowBusy}
                              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 transition ${
                                isPublished
                                  ? 'border-slate-800 bg-slate-900/40 text-slate-500 hover:text-slate-400 cursor-not-allowed'
                                  : 'border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                              }`}
                              title={
                                isPublished
                                  ? 'Para excluir, o fluxo precisa estar pausado/inativado'
                                  : 'Excluir fluxo'
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                              <span>Excluir</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

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
                  O fluxo <strong className="text-white">"{blockModal.flow.name}"</strong> está
                  atualmente <span className="text-emerald-400 font-semibold">Ativo em produção</span>.
                  Pelas regras de governança e integridade, para editar a estrutura ou mensagens de um
                  fluxo, ele precisa estar <strong>pausado ou inativado</strong>.
                </>
              ) : (
                <>
                  O fluxo <strong className="text-white">"{blockModal.flow.name}"</strong> está
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
                  disabled={actionLoadingId === blockModal.flow.id}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400 transition"
                >
                  {actionLoadingId === blockModal.flow.id && (
                    <RotateCcw className="h-3.5 w-3.5 animate-spin" />
                  )}
                  <span>Inativar e Editar</span>
                </button>
              )}

              {blockModal.action === 'delete' && (
                <button
                  onClick={async () => {
                    const target = blockModal.flow;
                    setBlockModal(null);
                    await handlePause(target);
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
      {deleteConfirmFlow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-white">Confirmar Exclusão</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Tem certeza que deseja excluir o fluxo{' '}
              <strong className="text-white">"{deleteConfirmFlow.name}"</strong>?
              {deleteConfirmFlow.executionCount && deleteConfirmFlow.executionCount > 0 ? (
                <span className="block mt-2 text-amber-300">
                  Aviso: Este fluxo possui histórico de execuções e será arquivado para preservar
                  rastreabilidade.
                </span>
              ) : (
                <span className="block mt-2 text-rose-400">
                  Esta ação é irreversível e excluirá todos os nós e configurações.
                </span>
              )}
            </p>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setDeleteConfirmFlow(null)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={actionLoadingId === deleteConfirmFlow.id}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 transition"
              >
                {actionLoadingId === deleteConfirmFlow.id && (
                  <RotateCcw className="h-3.5 w-3.5 animate-spin" />
                )}
                <span>Confirmar Exclusão</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Criar Novo Fluxo */}
      {newFlowModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Plus className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-white">Criar Novo Fluxo</h3>
              </div>
              <button
                onClick={() => setNewFlowModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewFlow} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Nome do Fluxo *
                </label>
                <input
                  type="text"
                  required
                  value={newFlowName}
                  onChange={(e) => setNewFlowName(e.target.value)}
                  placeholder="Ex: Suporte Técnico e SAC"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Descrição (Opcional)
                </label>
                <textarea
                  rows={3}
                  value={newFlowDesc}
                  onChange={(e) => setNewFlowDesc(e.target.value)}
                  placeholder="Ex: Fluxo para triagem de dúvidas frequentes e direcionamento para atendente humano."
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none resize-none"
                />
              </div>

              <div className="mt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setNewFlowModalOpen(false)}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingFlow || !newFlowName.trim()}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition"
                >
                  {creatingFlow && <RotateCcw className="h-3.5 w-3.5 animate-spin" />}
                  <span>Criar e Abrir Editor</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
