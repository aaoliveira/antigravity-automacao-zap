'use client';

import React, { useState, useMemo } from 'react';
import { NODE_CATALOG, CatalogItem } from '../../lib/default-nodes';
import { Search, ChevronDown, ChevronRight, GripVertical, Sparkles } from 'lucide-react';

interface BlockCatalogSidebarProps {
  onAddNode: (type: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function BlockCatalogSidebar({ onAddNode, isOpen, onToggle }: BlockCatalogSidebarProps) {
  const [search, setSearch] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const categories = useMemo(() => {
    return [
      { id: 'trigger', label: 'Gatilhos', color: 'text-violet-400' },
      { id: 'message', label: 'Mensagens WhatsApp', color: 'text-emerald-400' },
      { id: 'interaction', label: 'Interações & Perguntas', color: 'text-cyan-400' },
      { id: 'logic', label: 'Lógica & Condições', color: 'text-amber-400' },
      { id: 'action', label: 'Ações & CRM', color: 'text-pink-400' },
    ];
  }, []);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return NODE_CATALOG;
    const term = search.toLowerCase();
    return NODE_CATALOG.filter(
      (item) =>
        item.label.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term),
    );
  }, [search]);

  const toggleCategory = (catId: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  const handleDragStart = (e: React.DragEvent, item: CatalogItem) => {
    e.dataTransfer.setData('application/reactflow', item.type);
    e.dataTransfer.effectAllowed = 'move';
  };

  if (!isOpen) {
    return (
      <div className="absolute left-4 top-20 z-10">
        <button
          onClick={onToggle}
          className="flex h-10 items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 px-3 text-xs font-medium text-slate-200 shadow-xl backdrop-blur hover:bg-slate-800"
        >
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <span>Adicionar Blocos</span>
        </button>
      </div>
    );
  }

  return (
    <aside className="absolute left-4 top-20 z-10 flex h-[calc(100vh-6.5rem)] w-80 flex-col rounded-2xl border border-slate-800/90 bg-slate-900/95 shadow-2xl backdrop-blur-md">
      {/* Cabeçalho do Catálogo */}
      <div className="border-b border-slate-800/80 p-3.5">
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <h2 className="text-sm font-semibold text-slate-100">Catálogo de Blocos</h2>
          </div>
          <button
            onClick={onToggle}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            title="Recolher painel"
          >
            ✕
          </button>
        </div>

        {/* Input de Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar bloco ou ação..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-1.5 pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 outline-none transition focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30"
          />
        </div>
      </div>

      {/* Lista de Categorias e Blocos */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {categories.map((cat) => {
          const items = filteredItems.filter((i) => i.category === cat.id);
          if (items.length === 0) return null;
          const isCollapsed = collapsedCategories[cat.id];

          return (
            <div key={cat.id} className="space-y-1.5">
              <button
                onClick={() => toggleCategory(cat.id)}
                className="flex w-full items-center justify-between px-1 text-xs font-semibold text-slate-400 hover:text-slate-200"
              >
                <span className={cat.color}>{cat.label}</span>
                {isCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>

              {!isCollapsed && (
                <div className="grid grid-cols-1 gap-1.5 pt-1">
                  {items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.type}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item)}
                        onClick={() => onAddNode(item.type)}
                        className="group flex cursor-grab items-center justify-between rounded-xl border border-slate-800/60 bg-slate-950/40 p-2.5 transition-all hover:border-slate-700 hover:bg-slate-800/60 active:cursor-grabbing"
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <div
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-sm"
                            style={{ backgroundColor: `${item.color}20`, color: item.color }}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="truncate">
                            <span className="block truncate text-xs font-medium text-slate-200 group-hover:text-emerald-400 transition-colors">
                              {item.label}
                            </span>
                            <span className="block truncate text-[10px] text-slate-400">
                              {item.description}
                            </span>
                          </div>
                        </div>
                        <GripVertical className="h-4 w-4 text-slate-600 opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
