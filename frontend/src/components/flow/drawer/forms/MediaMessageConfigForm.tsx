'use client';

import React from 'react';
import { Image, Video, Mic, FileText, Smile, Link, Upload, Eye } from 'lucide-react';

interface MediaMessageConfigFormProps {
  type: string;
  config: Record<string, any>;
  onChange: (updatedConfig: Record<string, any>) => void;
}

export function MediaMessageConfigForm({ type, config, onChange }: MediaMessageConfigFormProps) {
  const url = config.url || '';
  const caption = config.caption || '';
  const fileName = config.fileName || '';
  const isPtt = config.isPtt ?? true;

  const isAudio = type === 'message.audio';
  const isDoc = type === 'message.document';
  const isSticker = type === 'message.sticker';
  const hasCaption = ['message.image', 'message.video', 'message.document'].includes(type);

  return (
    <div className="space-y-4 text-xs">
      {/* URL do Arquivo de Mídia */}
      <div>
        <label className="block pb-1 font-semibold text-slate-200">
          URL da Mídia (HTTPS pública ou CDN) *
        </label>
        <div className="relative">
          <Link className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="url"
            value={url}
            onChange={(e) => onChange({ ...config, url: e.target.value })}
            placeholder="https://exemplo.com/arquivo.jpg"
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 pl-9 pr-3 text-slate-200 outline-none focus:border-emerald-500/50"
          />
        </div>
      </div>

      {/* Nome do Arquivo se for documento */}
      {isDoc && (
        <div>
          <label className="block pb-1 font-semibold text-slate-200">Nome do Arquivo *</label>
          <input
            type="text"
            value={fileName}
            onChange={(e) => onChange({ ...config, fileName: e.target.value })}
            placeholder="Proposta-Comercial.pdf"
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-slate-200 outline-none focus:border-emerald-500/50"
          />
        </div>
      )}

      {/* Áudio Gravado na Hora (PTT) */}
      {isAudio && (
        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div>
            <span className="font-semibold text-slate-200 block">Enviar como Áudio Gravado (PTT)</span>
            <span className="text-[11px] text-slate-400">
              Exibe o microfone verde simulando que você gravou um áudio na hora
            </span>
          </div>
          <input
            type="checkbox"
            checked={isPtt}
            onChange={(e) => onChange({ ...config, isPtt: e.target.checked })}
            className="h-4 w-4 rounded accent-emerald-500 cursor-pointer"
          />
        </div>
      )}

      {/* Legenda quando suportada */}
      {hasCaption && (
        <div>
          <label className="block pb-1 font-semibold text-slate-200">Legenda (Caption)</label>
          <textarea
            rows={2}
            value={caption}
            onChange={(e) => onChange({ ...config, caption: e.target.value })}
            placeholder="Legenda descritiva enviada junto à mídia..."
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-slate-200 outline-none focus:border-emerald-500/50"
          />
        </div>
      )}

      {/* Pré-visualização da Mídia */}
      {url && (
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
          <span className="flex items-center gap-1 font-semibold text-slate-300">
            <Eye className="h-3.5 w-3.5 text-emerald-400" /> Prévia do Arquivo
          </span>
          {type === 'message.image' && (
            <div className="overflow-hidden rounded-lg border border-slate-800 max-h-48 flex justify-center bg-black/40">
              <img src={url} alt="Preview" className="max-h-48 object-contain" />
            </div>
          )}
          {type === 'message.video' && (
            <video controls src={url} className="w-full rounded-lg max-h-48 bg-black" />
          )}
          {type === 'message.audio' && (
            <audio controls src={url} className="w-full pt-1" />
          )}
          {type === 'message.document' && (
            <div className="flex items-center gap-2 p-2 rounded bg-slate-900 border border-slate-800">
              <FileText className="h-6 w-6 text-emerald-400" />
              <span className="font-mono text-slate-200 truncate">{fileName || 'documento.pdf'}</span>
            </div>
          )}
          {type === 'message.sticker' && (
            <div className="flex justify-center p-2">
              <img src={url} alt="Sticker" className="h-28 w-28 object-contain" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
