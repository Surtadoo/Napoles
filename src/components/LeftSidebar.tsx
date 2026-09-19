import React, { useState, useEffect } from 'react';
import { 
  UserPlus, 
  Users, 
  Mic, 
  MicOff, 
  Volume2, 
  ExternalLink, 
  Coins, 
  Check, 
  Copy,
  Sparkles,
  X
} from 'lucide-react';
import { Participant } from '../types';

interface LeftSidebarProps {
  participants: Participant[];
  onAddParticipant: () => void;
  onClaimPoints: (amount: number) => void;
  userPoints: number;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  participants,
  onAddParticipant,
  onClaimPoints,
}) => {
  const [countdown, setCountdown] = useState(64); // 1:04
  const [canClaim, setCanClaim] = useState(false);
  const [copiedIp, setCopiedIp] = useState(false);
  const [showTransformPrompt, setShowTransformPrompt] = useState(true);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setCanClaim(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [countdown]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleClaimReward = () => {
    onClaimPoints(150);
    setCountdown(90); // reset countdown
    setCanClaim(false);
  };

  const handleCopyIp = () => {
    navigator.clipboard.writeText('jogar.minezinho.com:19132');
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2000);
  };

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
                    <span className="text-xs font-medium text-gray-200 truncate">
                      {user.name}
                    </span>
                    {user.isOwner && (
                      <span className="text-yellow-400 text-xs" title="Criador da sala">⭐</span>
                    )}
                  </div>
                  {user.isScreenSharing && (
                    <span className="text-[10px] text-blue-400 flex items-center gap-1">
                      Transmitindo tela
                    </span>
                  )}
                </div>
              </div>

              {/* Status icon */}
              <div className="shrink-0 text-gray-400">
                {user.isMuted ? (
                  <MicOff className="w-3.5 h-3.5 text-red-400" />
                ) : user.isSpeaking ? (
                  <Mic className="w-3.5 h-3.5 text-green-400 animate-bounce" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-gray-400" />
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

      {/* Bottom section: Stats & Minezinho Sponsor Card */}
      <div className="p-3 border-t border-[#1c2230] space-y-2.5">
        {/* Active online count */}
        <div className="flex items-center justify-between text-[11px] text-gray-400 px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-semibold text-emerald-400">9331 on</span>
            <span className="text-gray-500 text-[10px]">▲</span>
          </div>
          <button 
            onClick={() => alert('Gostaria de anunciar seu servidor ou produto no GoLive? Entre em contato pelo suporte!')}
            className="text-gray-400 hover:text-blue-400 underline transition-colors"
          >
            Anuncie aqui também!
          </button>
        </div>

        {/* Sponsored Card */}
        <div className="bg-[#151a24] rounded-xl border border-[#232c3f] overflow-hidden shadow-lg flex flex-col group">
          {/* Tag */}
          <div className="px-2.5 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
            <span>PATROCINADO</span>
            <Sparkles className="w-3 h-3 text-yellow-400" />
          </div>

          {/* Banner Image */}
          <div className="relative h-28 w-full bg-gradient-to-t from-[#151a24] to-[#1e2738] overflow-hidden">
            <img
              src="/images/minezinho.jpg"
              alt="Minezinho Minecraft Server"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                // Fallback graphic if image cannot load
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#151a24] via-transparent to-transparent"></div>
          </div>

          {/* Content */}
          <div className="p-2.5 pt-1 space-y-1.5">
            <h4 className="font-extrabold text-[12px] text-emerald-400 leading-tight uppercase tracking-tight">
              MINEZINHO SEU NOVO SERVIDOR DE MINECRAFT
            </h4>
            <p className="text-[11px] text-gray-300 leading-tight">
              Servidor Survival (Java + Bedrock)
            </p>
            <div className="text-[10px] text-gray-400 font-mono space-y-0.5">
              <div className="flex items-center justify-between">
                <span>IP: jogar.minezinho.com</span>
                <button 
                  onClick={handleCopyIp}
                  title="Copiar IP"
                  className="text-emerald-400 hover:text-emerald-300 p-0.5"
                >
                  {copiedIp ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
              <p>Porta Bedrock: 19132</p>
              <p>Site: minezinho.com</p>
            </div>

            {/* Action button */}
            <button
              onClick={() => window.open('https://discord.gg', '_blank')}
              className="w-full mt-1.5 py-1.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <span>Participe da nossa Comunidade</span>
              <ExternalLink className="w-3 h-3" />
            </button>

            {/* Reward claim bar */}
            <button
              onClick={handleClaimReward}
              disabled={!canClaim && countdown > 0}
              className={`w-full mt-2 py-1 px-2 rounded-lg flex items-center justify-between text-xs font-medium transition-all ${
                canClaim || countdown === 0
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500/30 cursor-pointer animate-pulse'
                  : 'bg-[#1b2230] text-gray-400 border border-[#273247] cursor-not-allowed'
              }`}
            >
              <span className="flex items-center gap-1">
                <span>Resgatar</span>
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-bold text-amber-400">150</span>
              </span>
              <span className="font-mono text-[11px] bg-[#10141d] px-1.5 py-0.5 rounded text-gray-300">
                {countdown > 0 ? formatTimer(countdown) : 'Pronto!'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
