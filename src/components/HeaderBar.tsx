import React from 'react';
import {
  Home,
  Mic,
  MicOff,
  Headphones,
  Settings,
  Monitor,
  Video,
  Play,
  Music,
  PhoneOff,
  Share2,
  CheckCircle2,
  MoreVertical,
} from 'lucide-react';

interface HeaderBarProps {
  roomName: string;
  roomCode: string;
  isPrivate: boolean;
  isMuted: boolean;
  onToggleMic: () => void;
  isDeafened: boolean;
  onToggleDeafen: () => void;
  isScreenSharing: boolean;
  onToggleScreenShare: () => void;
  isCameraActive: boolean;
  onToggleCamera: () => void;
  onOpenSettings: () => void;
  onOpenYouTube: () => void;
  onOpenMusic: () => void;
  onDisconnect: () => void;
  onShareRoom: () => void;
  onOpenProModal: () => void;
  onOpenMenu: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  roomName,
  roomCode,
  isPrivate,
  isMuted,
  onToggleMic,
  isDeafened,
  onToggleDeafen,
  isScreenSharing,
  onToggleScreenShare,
  isCameraActive,
  onToggleCamera,
  onOpenSettings,
  onOpenYouTube,
  onOpenMusic,
  onDisconnect,
  onShareRoom,
  onOpenProModal,
  onOpenMenu,
}) => {
  return (
    <header className="bg-[#14181f] border-b border-[#212734] px-2 sm:px-4 py-1.5 flex flex-col gap-1.5 shrink-0 select-none">
      {/* linha 1: sala + compartilhar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          <button
            title="Início"
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#1f2635] rounded-md shrink-0"
          >
            <Home className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <span className="font-semibold text-white text-[13px] sm:text-[15px] truncate max-w-[90px] sm:max-w-[140px]">
            {roomName}
          </span>
          <span className="bg-[#1f2533] text-gray-300 text-[11px] sm:text-xs font-mono font-medium px-1.5 sm:px-2 py-0.5 rounded border border-[#2b3548] shrink-0">
            {roomCode}
          </span>
          {isPrivate && (
            <span className="bg-[#dc2626] text-white text-[10px] sm:text-[11px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-full shrink-0 hidden xs:inline sm:inline">
              Sala privada
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onShareRoom}
            className="h-8 px-2.5 rounded-md bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 touch-manipulation"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Compartilhar sala</span>
            <span className="sm:hidden">Convidar</span>
          </button>
          <button
            onClick={onOpenProModal}
            className="h-8 px-2 rounded-md bg-[#1e40af]/30 text-blue-400 text-xs font-semibold hidden sm:flex items-center gap-1 border border-blue-500/40"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Pro</span>
          </button>
          <button
            onClick={onOpenMenu}
            className="h-8 w-8 rounded-md text-gray-400 hover:text-white hover:bg-[#1f2635] flex items-center justify-center sm:hidden touch-manipulation"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* linha 2: controles de mídia (scroll horizontal no celular) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          onClick={onToggleMic}
          title={isMuted ? 'Ativar microfone' : 'Silenciar'}
          className={`h-9 min-w-[44px] px-3 rounded-md flex items-center justify-center gap-1.5 text-xs font-bold touch-manipulation shrink-0 ${
            isMuted ? 'bg-[#ef4444] text-white' : 'bg-[#10b981] text-white'
          }`}
        >
          {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          <span className="hidden md:inline">{isMuted ? 'Mudo' : 'Mic'}</span>
        </button>

        <button
          onClick={onToggleDeafen}
          title="Fone"
          className={`h-9 min-w-[44px] px-3 rounded-md flex items-center justify-center touch-manipulation shrink-0 ${
            isDeafened ? 'bg-[#ef4444] text-white' : 'bg-[#10b981] text-white'
          }`}
        >
          <Headphones className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenSettings}
          title="Configurações"
          className="h-9 min-w-[44px] px-3 rounded-md bg-[#10b981] text-white flex items-center justify-center shrink-0 touch-manipulation"
        >
          <Settings className="w-4 h-4" />
        </button>

        <button
          onClick={onToggleScreenShare}
          title={isScreenSharing ? 'Parar tela' : 'Compartilhar tela'}
          className={`h-9 min-w-[44px] px-3 rounded-md flex items-center justify-center gap-1.5 text-xs font-bold shrink-0 touch-manipulation ${
            isScreenSharing ? 'bg-[#3b82f6] text-white ring-2 ring-blue-400' : 'bg-[#10b981] text-white'
          }`}
        >
          <Monitor className="w-4 h-4" />
          <span className="hidden md:inline">Tela</span>
        </button>

        <button
          onClick={onToggleCamera}
          title="Câmera"
          className={`h-9 min-w-[44px] px-3 rounded-md flex items-center justify-center gap-1.5 text-xs font-bold shrink-0 touch-manipulation ${
            isCameraActive ? 'bg-[#3b82f6] text-white ring-2 ring-blue-400' : 'bg-[#10b981] text-white'
          }`}
        >
          <Video className="w-4 h-4" />
          <span className="hidden md:inline">Cam</span>
        </button>

        <button
          onClick={onOpenYouTube}
          className="h-9 px-2.5 rounded-md bg-[#0d9488] text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 touch-manipulation"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span className="hidden sm:inline">BETA</span>
        </button>

        <button
          onClick={onOpenMusic}
          className="h-9 px-2.5 rounded-md bg-[#0d9488] text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 touch-manipulation"
        >
          <Music className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">BETA</span>
        </button>

        <button
          onClick={onDisconnect}
          title="Sair"
          className="h-9 min-w-[44px] px-3 rounded-md bg-[#ef4444] text-white flex items-center justify-center ml-auto shrink-0 touch-manipulation"
        >
          <PhoneOff className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
