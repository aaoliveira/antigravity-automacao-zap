'use client';

import React, { useState, useRef } from 'react';
import {
  Image,
  Video,
  Mic,
  FileText,
  Smile,
  Link,
  UploadCloud,
  Eye,
  CheckCircle,
  RotateCcw,
  Trash2,
  AlertCircle,
  Sparkles,
  Paperclip,
} from 'lucide-react';
import { FlowApi } from '../../../../lib/api';

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
  const fileSize = config.fileSize;

  const [activeTab, setActiveTab] = useState<'upload' | 'url'>(url && !url.includes('/uploads/') ? 'url' : 'upload');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAudio = type === 'message.audio';
  const isDoc = type === 'message.document';
  const isSticker = type === 'message.sticker';
  const hasCaption = ['message.image', 'message.video', 'message.document'].includes(type);

  // Mapeia extensões aceitas por tipo
  const acceptMap: Record<string, string> = {
    'message.image': 'image/png,image/jpeg,image/webp,image/gif',
    'message.video': 'video/mp4,video/3gpp',
    'message.audio': 'audio/mp3,audio/mpeg,audio/ogg,audio/wav,audio/m4a,audio/aac',
    'message.document': '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,application/pdf',
    'message.sticker': 'image/webp,image/png',
  };

  const acceptMime = acceptMap[type] || '*/*';

  const typeLabels: Record<string, string> = {
    'message.image': 'Imagem (JPG, PNG, WEBP)',
    'message.video': 'Vídeo (MP4, 3GP)',
    'message.audio': 'Áudio (MP3, OGG, WAV)',
    'message.document': 'Documento / PDF (PDF, DOCX, XLSX)',
    'message.sticker': 'Figurinha (WEBP, PNG)',
  };

  const handleFileSelected = async (file: File) => {
    try {
      setUploading(true);
      setUploadProgress(0);
      setUploadError(null);

      const result = await FlowApi.uploadMedia(file, (percent) => {
        setUploadProgress(percent);
      });

      onChange({
        ...config,
        url: result.url,
        relativeUrl: result.relativeUrl,
        fileName: isDoc ? (config.fileName || result.fileName) : result.fileName,
        mimetype: result.mimetype,
        fileSize: result.size,
      });
    } catch (err: any) {
      setUploadError(err.response?.data?.message || err.message || 'Falha ao realizar upload.');
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelected(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelected(file);
    }
  };

  const handleRemoveMedia = () => {
    onChange({
      ...config,
      url: '',
      relativeUrl: '',
      fileName: '',
      fileSize: undefined,
      mimetype: undefined,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Abas: Upload (Recomendado Evolution API) vs URL Externa */}
      <div>
        <label className="block pb-1.5 font-semibold text-slate-200">
          Mídia Anexa {typeLabels[type] ? `— ${typeLabels[type]}` : ''}
        </label>

        <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-800 bg-slate-950/70 p-1 mb-3">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
              activeTab === 'upload'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UploadCloud className="h-3.5 w-3.5" />
            <span>Upload de Arquivo</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
              activeTab === 'url'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Link className="h-3.5 w-3.5" />
            <span>URL Externa</span>
          </button>
        </div>

        {/* MODO UPLOAD DE ARQUIVO */}
        {activeTab === 'upload' && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptMime}
              onChange={handleInputChange}
              className="hidden"
            />

            {!url ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !uploading && fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition ${
                  isDragging
                    ? 'border-emerald-400 bg-emerald-500/10'
                    : 'border-slate-700 bg-slate-950/50 hover:border-emerald-500/60 hover:bg-slate-900/40'
                }`}
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <RotateCcw className="h-6 w-6 animate-spin text-emerald-400" />
                    <span className="text-xs font-semibold text-slate-200">
                      Enviando arquivo... {uploadProgress > 0 ? `${uploadProgress}%` : ''}
                    </span>
                    <div className="w-36 h-1.5 rounded-full bg-slate-800 overflow-hidden mt-1">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-200"
                        style={{ width: `${uploadProgress || 20}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 mb-2.5">
                      <UploadCloud className="h-5 w-5" />
                    </div>
                    <span className="font-semibold text-slate-200 text-xs">
                      Clique para selecionar ou arraste o arquivo aqui
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1">
                      Limite suportado pelo WhatsApp: até 50 MB
                    </span>
                  </>
                )}
              </div>
            ) : (
              /* Arquivo Anexado com Sucesso */
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                      {isDoc ? (
                        <FileText className="h-4 w-4" />
                      ) : isAudio ? (
                        <Mic className="h-4 w-4" />
                      ) : type === 'message.video' ? (
                        <Video className="h-4 w-4" />
                      ) : (
                        <Image className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-100 block truncate">
                        {fileName || 'Arquivo Anexado'}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        {fileSize && <span>{formatFileSize(fileSize)}</span>}
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                          <CheckCircle className="h-3 w-3" /> Anexado na Evolution API
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-700 transition"
                      title="Substituir arquivo"
                    >
                      Substituir
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveMedia}
                      className="rounded-lg p-1 text-rose-400 hover:bg-rose-500/20 transition"
                      title="Remover anexo"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {uploadError && (
              <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-rose-950/60 border border-rose-500/30 p-2 text-[11px] text-rose-300">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>
        )}

        {/* MODO URL EXTERNA */}
        {activeTab === 'url' && (
          <div>
            <div className="relative">
              <Link className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="url"
                value={url}
                onChange={(e) => onChange({ ...config, url: e.target.value })}
                placeholder="https://meusite.com.br/arquivo.pdf"
                className="w-full rounded-xl border border-slate-800 bg-slate-950/60 py-2 pl-9 pr-3 text-slate-200 outline-none focus:border-emerald-500/50"
              />
            </div>
            <span className="text-[11px] text-slate-400 block pt-1">
              Insira uma URL pública e acessível sem autenticação restrita.
            </span>
          </div>
        )}
      </div>

      {/* Nome do Arquivo (Específico para Documentos / PDFs) */}
      {isDoc && (
        <div>
          <label className="block pb-1 font-semibold text-slate-200">
            Nome de Exibição do Documento *
          </label>
          <input
            type="text"
            value={fileName}
            onChange={(e) => onChange({ ...config, fileName: e.target.value })}
            placeholder="Ex: Proposta-Comercial-2026.pdf"
            className="w-full rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 text-slate-200 outline-none focus:border-emerald-500/50"
          />
          <span className="text-[10px] text-slate-400 block pt-0.5">
            Nome do arquivo que aparecerá no WhatsApp do cliente ao receber o documento.
          </span>
        </div>
      )}

      {/* Opção PTT para Mensagens de Áudio */}
      {isAudio && (
        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div>
            <span className="font-semibold text-slate-200 block">Enviar como Áudio Gravado (PTT)</span>
            <span className="text-[11px] text-slate-400">
              Exibe o ícone de microfone verde simulando gravação em tempo real
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

      {/* Legenda (Caption) para Mídias */}
      {hasCaption && (
        <div>
          <label className="block pb-1 font-semibold text-slate-200">
            Legenda da Mídia (Caption)
          </label>
          <textarea
            rows={2}
            value={caption}
            onChange={(e) => onChange({ ...config, caption: e.target.value })}
            placeholder="Digite uma legenda opcional... Suporta variáveis como {{contact.name}}"
            className="w-full rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 text-slate-200 outline-none focus:border-emerald-500/50 resize-none"
          />
        </div>
      )}

      {/* Pré-visualização da Mídia */}
      {url && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3 space-y-2">
          <span className="flex items-center gap-1.5 font-semibold text-slate-300">
            <Eye className="h-3.5 w-3.5 text-emerald-400" /> Prévia da Mídia Anexada
          </span>

          {type === 'message.image' && (
            <div className="overflow-hidden rounded-xl border border-slate-800 max-h-48 flex justify-center bg-black/40 p-1">
              <img src={url} alt="Prévia" className="max-h-44 object-contain rounded-lg" />
            </div>
          )}

          {type === 'message.video' && (
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-black">
              <video controls src={url} className="w-full max-h-48" />
            </div>
          )}

          {type === 'message.audio' && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-2">
              <audio controls src={url} className="w-full" />
            </div>
          )}

          {type === 'message.document' && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-semibold text-slate-200 block truncate">
                  {fileName || 'documento.pdf'}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {fileSize ? formatFileSize(fileSize) : 'Documento anexado'}
                </span>
              </div>
            </div>
          )}

          {type === 'message.sticker' && (
            <div className="flex justify-center p-2">
              <img src={url} alt="Sticker" className="h-28 w-28 object-contain" />
            </div>
          )}
        </div>
      )}

      {/* Dica de Boas Práticas da Evolution API */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-[11px] text-slate-400 space-y-1">
        <div className="flex items-center gap-1.5 font-semibold text-slate-300">
          <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
          <span>Recomendação Oficial Evolution API</span>
        </div>
        <p className="leading-relaxed">
          O upload direto armazena seu arquivo de forma otimizada no servidor, permitindo que a Evolution API
          despache a mídia diretamente para o WhatsApp sem lentidão ou estouro de tamanho de mensagens.
        </p>
      </div>
    </div>
  );
}
