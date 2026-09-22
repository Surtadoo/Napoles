import React, { useState } from 'react';
import {
  Link2,
  Check,
  Users,
  Mic,
  MicOff,
  Volume2,
  X,
  Shield,
  Signal,
  Wifi,
  Loader2,
  UserX,
  Settings,
  Crown,
} from 'lucide-react';
import { Participant } from '../types';

interface LeftSidebarProps {
  participants: Participant[];
  onInvite: () => void;
  userPoints: number;
  connectionStatus: 'idle' | 'connecting' | 'connected';
  shareUrl: string;
  className?: string;
  isOwner: boolean;
  onKickParticipant: (peerId: string, name: string) => void;
  onManageRoom?: () => void;
  adminSessionIds?: string[];
  sessionIdOf?: (participantId: string) => string | undefined;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  participants,
  onInvite,
  connectionStatus,
  shareUrl,
  className = '',
  isOwner,
  onKickParticipant,
  onManageRoom,
  adminSessionIds = [],
  sessionIdOf,
}) => {
  const [showTransformPrompt, setShowTransformPrompt] = useState(true);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = shareUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2200);
  };

  return (
    <aside
      className={`w-full md:w-72 bg-[#12151b] md:border-r border-[#1f2533] flex-col justify-between shrink-0 h-full overflow-y-auto select-none flex ${className}`}
    >
      <div className="p-3">
        <div className="flex items-center justify-between pb-3 border-b border-[#1c2230]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-200 text-sm">Participantes</span>
            <button
              onClick={onInvite}
              title="Copiar link para convidar pessoa real"
              className="p-1.5 rounded text-gray-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors touch-manipulation"
            >
              <Link2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <span className="bg-[#1f2638] text-gray-300 text-xs font-semibold px-2 py-0.5 rounded-full border border-[#2b354e]">
            {participants.length} online
          </span>
        </div>

        <div className="mt-2.5 px-2 py-1.5 rounded-lg bg-[#10141d] border border-[#222b3e] flex items-center gap-2">
          {connectionStatus === 'connected' ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                <Wifi className="w-3 h-3" /> Sala conectada
              </span>
            </>
          ) : connectionStatus === 'connecting' ? (
            <>
              <Loader2 className="w-3 h-3 text-yellow-400 animate-spin" />
              <span className="text-[11px] text-yellow-300 font-medium">Conectando sala...</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-gray-500" />
              <span className="text-[11px] text-gray-400">Aguardando entrar...</span>
            </>
          )}
        </div>

        <div className="mt-2.5 space-y-1.5">
          {participants.length === 0 && (
            <p className="text-[11px] text-gray-500 text-center py-4">Ninguém na sala ainda.</p>
          )}
          {participants.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-2 rounded-lg bg-[#161a22] border border-transparent transition-all"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative shrink-0">
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-[#293245]"
                  />
                  <span
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-[#161a22] ${
                      user.isSpeaking ? 'bg-green-500 animate-pulse' : 'bg-[#10b981]'
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-emerald-300 truncate">
                      {user.name}
                    </span>
                    {user.isOwner && (
                      <Crown className="w-3.5 h-3.5 text-yellow-400 shrink-0" aria-label="Dono da sala" />
                    )}
                    {!user.isOwner &&
                      sessionIdOf &&
                      (() => {
                        const sid = sessionIdOf(user.id);
                        return sid && adminSessionIds.includes(sid) ? (
                          <Shield className="w-3 h-3 text-yellow-300 shrink-0" aria-label="Administrador" />
                        ) : null;
                      })()}
                    {user.tag && (
                      <span className="text-[10px] text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30">
                        {user.tag}
                      </span>
                    )}
                  </div>
                  {user.isScreenSharing ? (
                    <span className="text-[10px] text-blue-400">Transmitindo tela</span>
                  ) : user.isCameraOn ? (
                    <span className="text-[10px] text-teal-400">Câmera ligada</span>
                  ) : null}
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-1.5">
                {user.isMuted ? (
                  <MicOff className="w-3.5 h-3.5 text-red-400" />
                ) : user.isSpeaking ? (
                  <Mic className="w-3.5 h-3.5 text-green-400 animate-bounce" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-gray-400" />
                )}
                {isOwner && user.id !== 'current-user' && (
                  <button
                    onClick={() => {
                      if (confirm(`Desconectar ${user.name} da call?`)) {
                        onKickParticipant(user.id, user.name);
                      }
                    }}
                    title={`Desconectar ${user.name} da call`}
                    className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors touch-manipulation"
                  >
                    <UserX className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Gerenciar sala — só quem tem a coroa (dono) */}
        {isOwner && onManageRoom && (
          <button
            onClick={onManageRoom}
            className="mt-3 w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-yellow-500/15 to-amber-500/10 hover:from-yellow-500/25 hover:to-amber-500/20 border border-yellow-500/40 text-yellow-200 text-xs font-bold flex items-center justify-center gap-2 transition-all touch-manipulation"
          >
            <Crown className="w-4 h-4 text-yellow-400" />
            <Settings className="w-3.5 h-3.5" />
            Gerenciar sala
          </button>
        )}

        {/* convite — copia link real, sem bots */}
        <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
          <p className="text-[11px] text-emerald-300 font-semibold">
            + Chamar pessoa real para a call:
          </p>
          <button
            onClick={handleCopyInvite}
            className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-xs font-bold transition-all touch-manipulation flex items-center justify-center gap-1.5"
          >
            {linkCopied ? (
              <>
                <Check className="w-3.5 h-3.5" /> Link copiado! Mande no Zap
              </>
            ) : (
              <>
                <Link2 className="w-3.5 h-3.5" /> Copiar link da call
              </>
            )}
          </button>
          <button
            onClick={onInvite}
            className="w-full py-1.5 rounded-lg bg-transparent border border-emerald-500/30 text-emerald-300 text-[11px] font-medium touch-manipulation"
          >
            Abrir opções de convite
          </button>
        </div>

        {showTransformPrompt && (
          <div className="mt-3 relative">
            <div className="w-full py-2 px-3 rounded-lg bg-[#182030] border border-[#26344d] text-gray-200 text-xs font-medium flex items-center justify-center gap-2">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>Transformar sala em grupo</span>
              <button
                onClick={() => setShowTransformPrompt(false)}
                className="text-gray-400 hover:text-gray-200 p-1 ml-auto touch-manipulation"
                aria-label="Fechar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-[#1c2230] space-y-2.5">
        <div className="flex items-center justify-between text-[11px] text-gray-400 px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-semibold text-emerald-400">{participants.length} nesta sala</span>
          </div>
          <span className="text-gray-400 font-mono text-[10px]">P2P WebRTC</span>
        </div>
        <div className="bg-[#151a24] rounded-xl border border-[#232c3f] p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <Shield className="w-4 h-4 shrink-0" />
            <span>Sala Criptografada LiveDC</span>
          </div>
          <p className="text-[11px] text-gray-300 leading-relaxed">
            Voz, vídeo e chat via P2P direto entre celulares e PCs.
          </p>
          <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1 border-t border-[#1f2838]">
            <span className="flex items-center gap-1">
              <Signal className="w-3 h-3 text-emerald-400" />
              Conexão Direta
            </span>
            <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
              PROTEGIDO
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
