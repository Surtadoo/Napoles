import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Clapperboard,
  Gamepad2,
  Zap,
  FileVideo,
  Lock,
  Users,
  Link2,
  Plus,
  Upload,
  Check,
  FileCheck,
} from 'lucide-react';
import {
  MediaPlatform,
  MediaController,
  parseMediaLink,
  platformPlaceholder,
} from '../utils/media';

export interface BetaMediaInput {
  platform: MediaPlatform;
  rawUrl: string;
  embedUrl: string;
  title: string;
  controller: MediaController;
  fileName?: string;
  localOnly?: boolean;
  objectUrl?: string;
}

interface BetaMediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (media: BetaMediaInput) => void;
  initialPlatform?: MediaPlatform;
}

const PLATFORMS: { id: MediaPlatform; label: string; icon: React.ReactNode; active: string }[] = [
  {
    id: 'youtube',
    label: 'YouTube',
    icon: <Clapperboard className="w-4 h-4" />,
    active: 'bg-red-500/20 border-red-500 text-red-300',
  },
  {
    id: 'twitch',
    label: 'Twitch',
    icon: <Gamepad2 className="w-4 h-4" />,
    active: 'bg-purple-500/20 border-purple-500 text-purple-300',
  },
  {
    id: 'kick',
    label: 'Kick',
    icon: <Zap className="w-4 h-4" />,
    active: 'bg-emerald-500/20 border-emerald-500 text-emerald-300',
  },
  {
    id: 'file',
    label: 'Arquivo',
    icon: <FileVideo className="w-4 h-4" />,
    active: 'bg-sky-500/20 border-sky-500 text-sky-300',
  },
];

export const BetaMediaModal: React.FC<BetaMediaModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  initialPlatform = 'youtube',
}) => {
  const [platform, setPlatform] = useState<MediaPlatform>(initialPlatform);
  const [control, setControl] = useState<MediaController>('leader');
  const [link, setLink] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPlatform(initialPlatform);
      setControl('leader');
      setLink('');
      setFile(null);
      setError('');
    }
  }, [isOpen, initialPlatform]);

  if (!isOpen) return null;

  const handlePickFile = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError('');
  };

  const handleAdd = () => {
    setError('');
    if (platform === 'file' && file) {
      const url = URL.createObjectURL(file);
      onAdd({
        platform: 'file',
        rawUrl: file.name,
        embedUrl: '',
        title: file.name.slice(0, 48),
        controller: control,
        fileName: file.name,
        localOnly: true,
        objectUrl: url,
      });
      onClose();
      return;
    }
    if (!link.trim()) {
      setError(
        platform === 'file'
          ? 'Cole o link do vídeo ou toque em "Escolher arquivo".'
          : 'Cole o link primeiro.'
      );
      return;
    }
    const parsed = parseMediaLink(platform, link.trim());
    if ('error' in parsed) {
      setError(parsed.error);
      return;
    }
    onAdd({
      platform,
      rawUrl: link.trim(),
      embedUrl: parsed.embedUrl,
      title: parsed.title,
      controller: control,
    });
    onClose();
  };

  const canAdd = platform === 'file' ? !!file || !!link.trim() : !!link.trim();

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-[#141822] border border-[#263147] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto">
        <div className="p-4 border-b border-[#212a3d] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="bg-teal-500 text-[10px] font-black px-1.5 py-0.5 rounded uppercase shrink-0">
              Beta
            </span>
            <h3 className="font-bold text-gray-100 text-sm truncate">
              Adicionar vídeo, playlist ou live
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 shrink-0 touch-manipulation"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-300 mb-2">Plataforma</p>
            <div className="grid grid-cols-4 gap-1.5">
              {PLATFORMS.map((p) => {
                const active = platform === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setPlatform(p.id);
                      setError('');
                    }}
                    className={`py-2 px-1 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1 transition-all touch-manipulation ${
                      active
                        ? p.active
                        : 'bg-[#10141d] border-[#242e42] text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {p.icon}
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-300 mb-2">Quem pode controlar</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => setControl('leader')}
                className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all touch-manipulation ${
                  control === 'leader'
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-200'
                    : 'bg-[#10141d] border-[#242e42] text-gray-400'
                }`}
              >
                <Lock className="w-4 h-4 shrink-0" />
                <span>
                  <span className="block text-xs font-bold">Só eu posso controlar</span>
                  <span className="block text-[10px] opacity-70">Ninguém mexe no BETA</span>
                </span>
                {control === 'leader' && <Check className="w-4 h-4 ml-auto shrink-0" />}
              </button>
              <button
                onClick={() => setControl('any')}
                className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all touch-manipulation ${
                  control === 'any'
                    ? 'bg-sky-500/15 border-sky-500 text-sky-200'
                    : 'bg-[#10141d] border-[#242e42] text-gray-400'
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>
                  <span className="block text-xs font-bold">Qualquer um pode controlar</span>
                  <span className="block text-[10px] opacity-70">Só o botão BETA</span>
                </span>
                {control === 'any' && <Check className="w-4 h-4 ml-auto shrink-0" />}
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-teal-400" />
              Link
            </p>
            <input
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder={platformPlaceholder(platform)}
              value={link}
              onChange={(e) => {
                setLink(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
              className="w-full bg-[#0d1017] border border-[#273248] focus:border-teal-500 rounded-xl px-3 py-2.5 text-xs text-gray-200 placeholder-gray-500 outline-none"
            />
            {platform === 'file' && (
              <div className="mt-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*,.mp4,.webm,.mkv,.mov"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {!file ? (
                  <button
                    onClick={handlePickFile}
                    className="w-full py-2.5 rounded-xl border border-dashed border-[#2f3a52] bg-[#10141d] text-gray-300 text-xs font-semibold flex items-center justify-center gap-2 hover:border-teal-500 touch-manipulation"
                  >
                    <Upload className="w-4 h-4 text-teal-400" />
                    Escolher arquivo do aparelho
                  </button>
                ) : (
                  <button
                    onClick={handlePickFile}
                    className="w-full p-2.5 rounded-xl border border-emerald-500/50 bg-emerald-500/10 text-emerald-200 text-xs flex items-center gap-2 text-left touch-manipulation"
                  >
                    <FileCheck className="w-4 h-4 shrink-0" />
                    <span className="truncate flex-1">{file.name}</span>
                    <span className="text-[10px] opacity-70 shrink-0">trocar</span>
                  </button>
                )}
                <p className="text-[10px] text-gray-500 mt-1.5">
                  Arquivo do aparelho toca para toda a sala tentar ver; se for local, os outros
                  veem um aviso.
                </p>
              </div>
            )}
          </div>

          {error && (
            <p className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 font-medium">
              {error}
            </p>
          )}

          <button
            onClick={handleAdd}
            disabled={!canAdd}
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:bg-gray-700 disabled:text-gray-400 text-white text-sm font-bold flex items-center justify-center gap-2 touch-manipulation"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
          <p className="text-[10px] text-gray-500 text-center -mt-2">
            O vídeo abre para TODA a sala, igual ao compartilhamento de tela.
          </p>
        </div>
      </div>
    </div>
  );
};
