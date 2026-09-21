import React, { useState } from 'react';
import { X, Tv, Play, Gamepad2, FileVideo, Check, Monitor } from 'lucide-react';

export type VideoControlMode = 'only-me' | 'anyone';

export interface VideoSourceInfo {
  id: string;
  title: string;
  url: string;
  type: 'youtube' | 'twitch' | 'kick' | 'file';
  controlMode: VideoControlMode;
}

interface VideoSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVideoSource: (info: VideoSourceInfo) => void;
  currentUserIsLeader?: boolean;
}

export const VideoSourceModal: React.FC<VideoSourceModalProps> = ({
  isOpen,
  onClose,
  onSelectVideoSource,
  currentUserIsLeader = true,
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<'youtube' | 'twitch' | 'kick' | 'file'>('youtube');
  const [linkText, setLinkText] = useState('');
  const [controlMode, setControlMode] = useState<VideoControlMode>('only-me');
  const [addedId, setAddedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAdd = () => {
    if (!linkText.trim()) return;
    let url = linkText.trim();
    let finalUrl = url;

    // YouTube embed conversion
    if (selectedPlatform === 'youtube') {
      const videoIdMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
      if (videoIdMatch && videoIdMatch[1]) {
        finalUrl = `https://www.youtube-nocookie.com/embed/${videoIdMatch[1]}?autoplay=1&mute=0`;
      } else {
        finalUrl = url;
      }
    }

    // Twitch embed
    if (selectedPlatform === 'twitch') {
      const twitchMatch = url.match(/twitch\.tv\/(\w+)/);
      if (twitchMatch && twitchMatch[1]) {
        finalUrl = `https://player.twitch.tv/?channel=${twitchMatch[1]}&parent=livedc.me`;
      }
    }

    // Kick embed
    if (selectedPlatform === 'kick') {
      const kickMatch = url.match(/kick\.com\/(\w+)/);
      if (kickMatch && kickMatch[1]) {
        finalUrl = `https://player.kick.com/${kickMatch[1]}?parent=livedc.me`;
      }
    }

    const info: VideoSourceInfo = {
      id: Date.now().toString(),
      title: `Transmissão ${selectedPlatform}`,
      url: finalUrl,
      type: selectedPlatform,
      controlMode: currentUserIsLeader ? controlMode : 'only-me',
    };

    onSelectVideoSource(info);
    setAddedId(info.id);
    setTimeout(() => {
      onClose();
      setAddedId(null);
      setLinkText('');
      setControlMode('only-me');
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="bg-gradient-to-b from-[#161822] to-[#0f1218] border border-[#263147] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#232b3d] flex items-center justify-between bg-[#121620]/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Tv className="w-4 h-4 text-black" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-sm tracking-tight">BETA</h3>
              <p className="text-[10px] text-emerald-400 font-medium">Adicionar vídeo, playlist ou live</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Platform selection */}
          <div>
            <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-3 block">Plataforma</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { key: 'youtube', label: 'YouTube', icon: Tv, color: 'bg-red-600', activeColor: 'bg-red-500' },
                { key: 'twitch', label: 'Twitch', icon: Gamepad2, color: 'bg-purple-600', activeColor: 'bg-purple-500' },
                { key: 'kick', label: 'Kick', icon: Gamepad2, color: 'bg-emerald-600', activeColor: 'bg-emerald-500' },
                { key: 'file', label: 'Arquivo', icon: FileVideo, color: 'bg-blue-600', activeColor: 'bg-blue-500' },
              ].map((platform) => {
                const Icon = platform.icon;
                return (
                  <button
                    key={platform.key}
                    onClick={() => setSelectedPlatform(platform.key as any)}
                    className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border transition-all ${
                      selectedPlatform === platform.key
                        ? `border-emerald-400 bg-emerald-500/10 text-white shadow-lg shadow-emerald-500/20 scale-[1.05]`
                        : `border-[#232b3d] bg-[#0f1218] text-gray-400 hover:border-gray-500 hover:text-white hover:scale-[1.03]`
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${selectedPlatform === platform.key ? 'text-emerald-400' : ''}`} />
                    <span className="text-[10px] font-semibold">{platform.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Control mode */}
          <div className="bg-[#0f1218] border border-[#232b3d] rounded-xl p-3 space-y-2">
            <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider block">Quem pode controlar</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setControlMode('only-me')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold text-center transition-all shadow-md ${
                  controlMode === 'only-me'
                    ? 'bg-emerald-600 text-white shadow-emerald-900/30 ring-2 ring-emerald-400/50'
                    : 'bg-[#161822] text-gray-400 hover:text-white hover:bg-[#1a2230] border border-[#2a3548]'
                }`}
              >
                Só eu posso controlar
              </button>
              <button
                onClick={() => setControlMode('anyone')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold text-center transition-all shadow-md ${
                  controlMode === 'anyone'
                    ? 'bg-amber-500 text-white shadow-amber-900/30 ring-2 ring-amber-400/50'
                    : 'bg-[#161822] text-gray-400 hover:text-white hover:bg-[#1a2230] border border-[#2a3548]'
                }`}
              >
                Qualquer um pode controlar
              </button>
            </div>
          </div>

          {/* Link input */}
          <div>
            <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-2 block">Link</label>
            <div className="flex items-center gap-2 bg-[#0f1218] border border-[#2a3548] rounded-xl px-3 py-2.5 focus-within:border-emerald-500 transition-colors">
              <Play className="w-4 h-4 text-emerald-400 shrink-0" />
              <input
                type="text"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="https://youtube.com/watch?v=... ou playlist"
                className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none min-w-0"
              />
            </div>
          </div>

          {/* Add button */}
          <button
            onClick={handleAdd}
            disabled={!linkText.trim()}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-extrabold flex items-center justify-center gap-2 shadow-xl shadow-emerald-900/30 transition-all active:scale-[0.99]"
          >
            <span>Adicionar</span>
            <Monitor className="w-4 h-4" />
          </button>

          {/* Success feedback */}
          {addedId && (
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 rounded-lg animate-pulse">
              <Check className="w-4 h-4" />
              <span>Fonte adicionada! Compartilhando agora.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
