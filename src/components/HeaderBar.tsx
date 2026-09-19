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
  Bell, 
  MoreVertical 
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
  onOpenMenu
}) => {
  return (
    <header className="h-14 bg-[#14181f] border-b border-[#212734] px-4 flex items-center justify-between gap-2 shrink-0 select-none">
      {/* Left section: Home + Room Info */}
      <div className="flex items-center gap-2.5 min-w-max">
        <button 
          title="Início" 
          className="p-1.5 text-gray-400 hover:text-white hover:bg-[#1f2635] rounded-md transition-colors"
        >
          <Home className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <span className="font-semibold text-white text-[15px] tracking-wide max-w-[140px] truncate">
            {roomName}
          </span>
          <span className="bg-[#1f2533] text-gray-300 text-xs font-mono font-medium px-2 py-0.5 rounded border border-[#2b3548]">
            {roomCode}
          </span>
          {isPrivate && (
            <span className="bg-[#dc2626] text-white text-[11px] font-semibold px-2 py-0.5 rounded-full shadow-sm shadow-red-950">
              Sala privada
            </span>
          )}
        </div>
      </div>

      {/* Center media controls */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Mic Toggle */}
        <button
          onClick={onToggleMic}
          title={isMuted ? "Ativar microfone" : "Silenciar microfone"}
          className={`h-9 w-9 sm:w-auto sm:px-3 rounded-md flex items-center justify-center gap-1.5 font-medium text-xs transition-all ${
            isMuted
              ? 'bg-[#ef4444] text-white hover:bg-[#dc2626] shadow-sm shadow-red-900/40'
              : 'bg-[#10b981] text-white hover:bg-[#059669]'
          }`}
        >
          {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Headphones Toggle */}
        <button
          onClick={onToggleDeafen}
          title={isDeafened ? "Desativar ensurdecer" : "Ensurdecer áudio"}
          className={`h-9 w-9 sm:w-auto sm:px-3 rounded-md flex items-center justify-center gap-1.5 font-medium text-xs transition-all ${
            isDeafened
              ? 'bg-[#ef4444] text-white hover:bg-[#dc2626]'
              : 'bg-[#10b981] text-white hover:bg-[#059669]'
          }`}
        >
          <Headphones className="w-4 h-4" />
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          title="Configurações de Áudio e Vídeo"
          className="h-9 w-9 rounded-md bg-[#10b981] text-white hover:bg-[#059669] flex items-center justify-center transition-all"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Screen share toggle */}
        <button
          onClick={onToggleScreenShare}
          title={isScreenSharing ? "Parar de compartilhar tela" : "Compartilhar tela"}
          className={`h-9 w-9 rounded-md flex items-center justify-center transition-all ${
            isScreenSharing 
              ? 'bg-[#3b82f6] text-white hover:bg-[#2563eb] ring-2 ring-blue-400' 
              : 'bg-[#10b981] text-white hover:bg-[#059669]'
          }`}
        >
          <Monitor className="w-4 h-4" />
        </button>

        {/* Camera toggle */}
        <button
          onClick={onToggleCamera}
          title={isCameraActive ? "Desativar câmera" : "Compartilhar câmera"}
          className={`h-9 w-9 rounded-md flex items-center justify-center transition-all ${
            isCameraActive
              ? 'bg-[#3b82f6] text-white hover:bg-[#2563eb] ring-2 ring-blue-400'
              : 'bg-[#10b981] text-white hover:bg-[#059669]'
          }`}
        >
          <Video className="w-4 h-4" />
        </button>

        {/* YouTube Watch Together BETA */}
        <button
          onClick={onOpenYouTube}
          title="Assistir YouTube juntos (BETA)"
          className="h-9 px-2.5 rounded-md bg-[#0d9488] hover:bg-[#0f766e] text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span className="hidden md:inline">BETA</span>
        </button>

        {/* Music Player BETA */}
        <button
          onClick={onOpenMusic}
          title="Rádio / Música com amigos (BETA)"
          className="h-9 px-2.5 rounded-md bg-[#0d9488] hover:bg-[#0f766e] text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
        >
          <Music className="w-3.5 h-3.5" />
          <span className="hidden md:inline">BETA</span>
        </button>

        {/* End Call / Disconnect */}
        <button
          onClick={onDisconnect}
          title="Desconectar da sala"
          className="h-9 w-9 rounded-md bg-[#ef4444] hover:bg-[#dc2626] text-white flex items-center justify-center transition-all shadow-sm shadow-red-900/30 ml-1"
        >
          <PhoneOff className="w-4 h-4" />
        </button>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        {/* Compartilhar sala button */}
        <button
          onClick={onShareRoom}
          className="h-8 px-2.5 sm:px-3 rounded-md bg-[#1f2533] hover:bg-[#2b3548] text-gray-200 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors border border-[#2d374a]"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Compartilhar sala</span>
        </button>

        {/* Pro Badge */}
        <button
          onClick={onOpenProModal}
          className="h-8 px-2 sm:px-2.5 rounded-md bg-[#1e40af]/30 hover:bg-[#1e40af]/50 text-blue-400 hover:text-blue-300 text-xs font-semibold flex items-center gap-1 transition-colors border border-blue-500/40"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
          <span>Pro</span>
        </button>

        {/* Notification Bell */}
        <button 
          title="Notificações" 
          className="h-8 w-8 rounded-md text-gray-400 hover:text-white hover:bg-[#1f2635] flex items-center justify-center transition-colors relative"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500 ring-1 ring-[#14181f]"></span>
        </button>

        {/* Menu 3 dots */}
        <button
          onClick={onOpenMenu}
          title="Mais opções"
          className="h-8 w-8 rounded-md text-gray-400 hover:text-white hover:bg-[#1f2635] flex items-center justify-center transition-colors"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
