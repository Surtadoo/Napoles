import React, { useState } from 'react';
import { 
  UserPlus, 
  Users, 
  Mic, 
  MicOff, 
  Volume2, 
  X,
  Shield,
  Signal,
  Monitor
} from 'lucide-react';
import { Participant } from '../types';

interface LeftSidebarProps {
  participants: Participant[];
  onAddParticipant: () => void;
  userPoints: number;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  participants,
  onAddParticipant,
}) => {
  const [showTransformPrompt, setShowTransformPrompt] = useState(true);

  return (
    <aside className="w-72 bg-[#12151b] border-r border-[#1f2533] flex flex-col justify-between shrink-0 h-full overflow-y-auto select-none">
      {/* Top section: Participants list */}
      <div className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1c2230]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-200 text-sm">Participantes</span>
            <button 
              onClick={onAddParticipant}
              title="Adicionar participante"
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#1d2333] transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
            </button>
          </div>
          <span className="bg-[#1f2638] text-gray-300 text-xs font-semibold px-2 py-0.5 rounded-full border border-[#2b354e]">
            {participants.length}
          </span>
        </div>

        {/* Participants list */}
        <div className="mt-2.5 space-y-1.5">
          {participants.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-2 rounded-lg bg-[#161a22] hover:bg-[#1a202c] border border-transparent hover:border-[#263045] transition-all group"
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
                    <span className="text-xs font-semibold text-emerald-400 truncate">
                      {user.name}
                    </span>
                    {user.isOwner && (
                      <span className="text-yellow-400 text-xs" title="Criador da sala">⭐</span>
                    )}
                    {user.tag && (
                      <span className="text-[10px] text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30">
                        {user.tag}
                      </span>
                    )}
                  </div>
                  {user.isScreenSharing && (
                    <span className="text-[10px] text-blue-400 flex items-center gap-1">
                      Transmitindo tela
                    </span>
                  )}
                </div>
              </div>

              {/* Status icon + actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="text-gray-400">
                  {user.isMuted ? (
                    <MicOff className="w-3.5 h-3.5 text-red-400" />
                  ) : user.isSpeaking ? (
                    <Mic className="w-3.5 h-3.5 text-green-400 animate-bounce" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-gray-400" />
                  )}
                </div>
                {/* View shared screen button */}
                {user.isScreenSharing && user.id !== 'current-user' && (
                  <button
                    onClick={() => alert(`Abrindo tela compartilhada por ${user.name} em tela cheia!`)}
                    title={`Ver tela de ${user.name}`}
                    className="p-1 text-blue-400 hover:text-white hover:bg-blue-500/20 rounded transition-all"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                  </button>
                )}
                {/* Disconnect button */}
                {user.id !== 'current-user' && (
                  <button
                    onClick={() => {
                      if (confirm(`Desconectar ${user.name} da sala?`)) {
                        alert(`${user.name} foi desconectado.`);
                      }
                    }}
                    title={`Desconectar ${user.name}`}
                    className="p-1 text-red-400 hover:text-white hover:bg-red-500/20 rounded transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Transformar sala em grupo button */}
        {showTransformPrompt && (
          <div className="mt-3 relative">
            <button
              onClick={() => alert('Esta sala privada agora pode receber até 25 participantes!')}
              className="w-full py-2 px-3 rounded-lg bg-[#182030] hover:bg-[#1f293d] border border-[#26344d] text-gray-200 text-xs font-medium flex items-center justify-center gap-2 transition-all group shadow-sm"
            >
              <Users className="w-3.5 h-3.5 text-blue-400 group-hover:scale-110 transition-transform" />
              <span>Transformar sala em grupo</span>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTransformPrompt(false);
                }}
                className="text-gray-400 hover:text-gray-200 p-0.5 ml-auto"
              >
                <X className="w-3 h-3" />
              </button>
            </button>
          </div>
        )}
      </div>

      {/* Bottom section: Server Status & Security info (anúncio patrocinado removido) */}
      <div className="p-3 border-t border-[#1c2230] space-y-2.5">
        <div className="flex items-center justify-between text-[11px] text-gray-400 px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-semibold text-emerald-400">9331 online</span>
          </div>
          <span className="text-gray-400 font-mono text-[10px]">Ping: 12ms</span>
        </div>

        {/* Security / Encrypted Room info box */}
        <div className="bg-[#151a24] rounded-xl border border-[#232c3f] p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Sala Criptografada LiveDC</span>
          </div>
          <p className="text-[11px] text-gray-300 leading-relaxed">
            Transmissão de tela P2P com criptografia AES-256 e WebRTC seguro.
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
