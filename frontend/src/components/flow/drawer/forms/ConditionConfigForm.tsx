'use client';

import React from 'react';
import { Plus, Trash2, GitBranch, ArrowRight } from 'lucide-react';

interface ConditionConfigFormProps {
  config: Record<string, any>;
  onChange: (updatedConfig: Record<string, any>) => void;
}

export function ConditionConfigForm({ config, onChange }: ConditionConfigFormProps) {
  const rules = config.rules || [
    { variable: 'nome_cliente', operator: 'IS_NOT_EMPTY', value: '' },
  ];
  const logicalOperator = config.logicalOperator || 'AND';

  const operators = [
    { value: 'EQUALS', label: 'Igual a (==)' },
    { value: 'NOT_EQUALS', label: 'Diferente de (!=)' },
    { value: 'CONTAINS', label: 'Contém o texto' },
    { value: 'NOT_CONTAINS', label: 'Não contém' },
    { value: 'GREATER_THAN', label: 'Maior que (>)' },
    { value: 'LESS_THAN', label: 'Menor que (<)' },
    { value: 'IS_EMPTY', label: 'Está vazio / não preenchido' },
    { value: 'IS_NOT_EMPTY', label: 'Está preenchido / possui valor' },
    { value: 'STARTS_WITH', label: 'Começa com' },
    { value: 'ENDS_WITH', label: 'Termina com' },
    { value: 'REGEX_MATCH', label: 'Corresponde a Expressão Regular' },
  ];

  const handleAddRule = () => {
    const newRule = { variable: 'variavel', operator: 'EQUALS', value: '' };
    onChange({ ...config, rules: [...rules, newRule] });
  };

  const handleUpdateRule = (index: number, field: string, val: string) => {
    const updated = [...rules];
    updated[index] = { ...updated[index], [field]: val };
    onChange({ ...config, rules: updated });
  };

  const handleRemoveRule = (index: number) => {
    if (rules.length <= 1) return;
    const updated = rules.filter((_: any, i: number) => i !== index);
    onChange({ ...config, rules: updated });
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Operador Lógico Global */}
      <div>
        <label className="block pb-1 font-semibold text-slate-200">
          Operador de Agrupamento das Regras
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange({ ...config, logicalOperator: 'AND' })}
            className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition ${
              logicalOperator === 'AND'
                ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:bg-slate-900'
            }`}
          >
            E (TODAS as regras devem ser verdadeiras)
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...config, logicalOperator: 'OR' })}
            className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition ${
              logicalOperator === 'OR'
                ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:bg-slate-900'
            }`}
          >
            OU (PELO MENOS UMA regra verdadeira)
          </button>
        </div>
      </div>

      {/* Lista de Regras Condicionais */}
      <div>
        <div className="flex items-center justify-between pb-2">
          <label className="font-semibold text-slate-200">Regras de Comparação</label>
          <button
            type="button"
            onClick={handleAddRule}
            className="flex items-center gap-1 rounded bg-amber-500/20 px-2 py-1 text-[11px] font-semibold text-amber-400 hover:bg-amber-500/30 transition"
          >
            <Plus className="h-3 w-3" /> Adicionar Regra
          </button>
        </div>

        <div className="space-y-2">
          {rules.map((rule: any, idx: number) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                  <GitBranch className="h-3 w-3" /> Condição #{idx + 1}
                </span>
                {rules.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveRule(idx)}
                    className="rounded p-1 text-slate-500 hover:text-rose-400 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div>
                <label className="text-[10px] text-slate-400">Variável a Comparar</label>
                <input
                  type="text"
                  value={rule.variable}
                  onChange={(e) => handleUpdateRule(idx, 'variable', e.target.value)}
                  placeholder="Ex: cliente_nome ou contact.phone"
                  className="w-full rounded border border-slate-800 bg-slate-900 p-1.5 font-mono text-amber-300 outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400">Operador Relacional</label>
                <select
                  value={rule.operator}
                  onChange={(e) => handleUpdateRule(idx, 'operator', e.target.value)}
                  className="w-full rounded border border-slate-800 bg-slate-900 p-1.5 text-slate-200 outline-none focus:border-amber-500/50"
                >
                  {operators.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
              </div>

              {!['IS_EMPTY', 'IS_NOT_EMPTY'].includes(rule.operator) && (
                <div>
                  <label className="text-[10px] text-slate-400">Valor Esperado</label>
                  <input
                    type="text"
                    value={rule.value}
                    onChange={(e) => handleUpdateRule(idx, 'value', e.target.value)}
                    placeholder="Ex: Sim ou 100"
                    className="w-full rounded border border-slate-800 bg-slate-900 p-1.5 text-slate-200 outline-none focus:border-amber-500/50"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Saídas Nomeadas Informativas */}
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
        <span className="font-semibold text-slate-300">Saídas do Bloco:</span>
        <div className="flex items-center justify-between text-[11px] text-emerald-400">
          <span className="flex items-center gap-1">
            <ArrowRight className="h-3 w-3" /> Saída Verdadeiro
          </span>
          <span className="text-slate-400">Executada quando o teste passar</span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-rose-400">
          <span className="flex items-center gap-1">
            <ArrowRight className="h-3 w-3" /> Saída Falso
          </span>
          <span className="text-slate-400">Executada quando o teste falhar</span>
        </div>
      </div>
    </div>
  );
}
