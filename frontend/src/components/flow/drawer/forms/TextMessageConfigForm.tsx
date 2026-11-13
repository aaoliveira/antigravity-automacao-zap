'use client';

import React, { useState } from 'react';
import { Bold, Italic, Strikethrough, Code, Sparkles, Variable, Eye } from 'lucide-react';

interface TextMessageConfigFormProps {
  config: Record<string, any>;
  onChange: (updatedConfig: Record<string, any>) => void;
  availableVariables?: string[];
}

export function TextMessageConfigForm({
  config,
  onChange,
  availableVariables = ['contact.name', 'contact.phone', 'cliente_nome', 'resposta_opcao'],
}: TextMessageConfigFormProps) {
  const text = config.text || '';
  const delay = config.delay || 0;
  const [showPreview, setShowPreview] = useState(true);

  const insertFormat = (wrapper: string) => {
    const textarea = document.getElementById('message-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = text.substring(start, end) || 'texto';
    const newText = text.substring(0, start) + `${wrapper}${selectedText}${wrapper}` + text.substring(end);

    onChange({ ...config, text: newText });
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + wrapper.length, start + wrapper.length + selectedText.length);
    }, 50);
  };

  const insertVariable = (varName: string) => {
    const textarea = document.getElementById('message-textarea') as HTMLTextAreaElement;
    const cursor = textarea ? textarea.selectionStart : text.length;
    const placeholder = `{{${varName}}}`;
    const newText = text.substring(0, cursor) + placeholder + text.substring(cursor);
    onChange({ ...config, text: newText });
  };

  // Formata texto com markdown básico do WhatsApp para a prévia
  const renderFormattedPreview = (raw: string) => {
    if (!raw) return <span className="italic text-slate-400">Mensagem vazia...</span>;
    // Substitui variáveis por destaque visual
    let formatted = raw.replace(
      /\{\{([a-zA-Z0-9_.-]+)\}\}/g,
      '<span class="text-emerald-700 font-semibold bg-emerald-100 px-1 rounded">[$1]</span>',
    );
    // Negrito *texto*
    formatted = formatted.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    // Itálico _texto_
    formatted = formatted.replace(/_(.*?)_/g, '<em>$1</em>');
    // Tachado ~texto~
    formatted = formatted.replace(/~(.*?)~/g, '<del>$1</del>');
    // Quebras de linha
    formatted = formatted.replace(/\n/g, '<br/>');

    return <div dangerouslySetInnerHTML={{ __html: formatted }} />;
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Campo de Texto da Mensagem */}
      <div>
        <div className="flex items-center justify-between pb-1.5">
          <label className="font-semibold text-slate-200">Conteúdo da Mensagem</label>
          <span className="text-[11px] text-slate-400">{text.length} caracteres</span>
        </div>

        {/* Barra de Formatação Estilo WhatsApp */}
        <div className="flex items-center gap-1 rounded-t-xl border border-b-0 border-slate-800 bg-slate-950/80 px-2.5 py-1.5">
          <button
            type="button"
            onClick={() => insertFormat('*')}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition"
            title="Negrito (*texto*)"
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormat('_')}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition"
            title="Itálico (_texto_)"
          >
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormat('~')}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition"
            title="Tachado (~texto~)"
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormat('```')}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition"
            title="Monoespaçado (```texto```)"
          >
            <Code className="h-3.5 w-3.5" />
          </button>

          <div className="h-3 w-px bg-slate-800 mx-1" />

          {/* Seletor Rápido de Variáveis */}
          <div className="flex items-center gap-1">
            <Variable className="h-3.5 w-3.5 text-emerald-400" />
            <select
              onChange={(e) => {
                if (e.target.value) {
                  insertVariable(e.target.value);
                  e.target.value = '';
                }
              }}
              defaultValue=""
              className="bg-transparent text-[11px] text-emerald-400 outline-none cursor-pointer"
            >
              <option value="" disabled className="bg-slate-900 text-slate-300">
                Inserir Variável...
              </option>
              {availableVariables.map((v) => (
                <option key={v} value={v} className="bg-slate-900 text-slate-200">
                  {`{{${v}}}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <textarea
          id="message-textarea"
          rows={5}
          value={text}
          onChange={(e) => onChange({ ...config, text: e.target.value })}
          placeholder="Digite a mensagem que o cliente receberá no WhatsApp..."
          className="w-full rounded-b-xl border border-slate-800 bg-slate-950/60 p-3 text-slate-200 placeholder-slate-500 outline-none transition focus:border-emerald-500/50"
        />
      </div>

      {/* Atraso de Digitação (Jitter e Presença) */}
      <div>
        <label className="block pb-1 font-semibold text-slate-200">
          Atraso de Digitação (Segundos)
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={0}
            max={60}
            value={delay}
            onChange={(e) => onChange({ ...config, delay: Number(e.target.value) })}
            className="w-24 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-slate-200 outline-none focus:border-emerald-500/50"
          />
          <span className="text-[11px] text-slate-400">
            Simula status "digitando..." no WhatsApp antes do envio.
          </span>
        </div>
      </div>

      {/* Pré-visualização Estilo Balão do WhatsApp */}
      <div className="pt-2">
        <div className="flex items-center justify-between pb-1.5">
          <span className="flex items-center gap-1 font-semibold text-slate-300">
            <Eye className="h-3.5 w-3.5 text-emerald-400" /> Prévia no WhatsApp
          </span>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="text-[11px] text-slate-400 hover:text-slate-200"
          >
            {showPreview ? 'Ocultar' : 'Exibir'}
          </button>
        </div>

        {showPreview && (
          <div className="rounded-xl border border-slate-800 bg-[#0b141a] p-3 shadow-inner">
            <div className="relative ml-auto max-w-[85%] rounded-lg bg-[#005c4b] p-2.5 text-slate-100 shadow">
              <div className="text-xs leading-relaxed">{renderFormattedPreview(text)}</div>
              <div className="flex justify-end pt-1">
                <span className="text-[9px] text-slate-300">14:32</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
