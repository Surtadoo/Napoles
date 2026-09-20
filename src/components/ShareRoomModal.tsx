import React, { useState } from 'react';
import { X, Copy, Check, Lock, ShieldCheck, Share2 } from 'lucide-react';

interface ShareRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomName: string;
  roomCode: string;
  userName?: string;
  onRefreshCode?: () => void;
}

export const ShareRoomModal: React.FC<ShareRoomModalProps> = ({
  isOpen,
  onClose,
  roomName,
  roomCode,
  userName = 'Amigo',
  onRefreshCode,
}) => {
  const [copied, setCopied] = useState(false);
  const inviteUrl = `https://livedc.me/?user=${encodeURIComponent(userName)}&join=livedc`;
  const roomUrl = `https://livedc.me/watch/priv-${roomName}-${roomCode}`;

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(roomUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#141822] border border-[#263147] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#212a3d] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-gray-100 text-sm">Compartilhar Sala LiveDC</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-lg">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Link privado e criptografado ponto a ponto via LiveDC.</span>
          </div>

          <div>
            <label className="text-xs text-gray-400 font-medium block mb-1.5">
              Link direto da sala LiveDC
            </label>
            <div className="flex items-center gap-2 bg-[#0d1017] border border-[#263045] rounded-xl p-2">
              <input
                type="text"
                readOnly
                value={roomUrl}
                className="bg-transparent text-xs text-gray-300 font-mono flex-1 outline-none truncate"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>
          </div>

          {/* Link para convidar com nome automático */}
          <div>
            <label className="text-xs text-gray-400 font-medium block mb-1.5">
              Link para convidar com nome
            </label>
            <div className="flex items-center gap-2 bg-[#0d1017] border border-[#263045] rounded-xl p-2">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="bg-transparent text-xs text-emerald-300 font-mono flex-1 outline-none truncate"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(inviteUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copiar convite</span>
              </button>
            </div>
          </div>

          {/* Room PIN / Access code */}
          <div className="flex items-center justify-between bg-[#19202e] p-3 rounded-xl border border-[#27344c]">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-300 font-medium">Código de acesso</p>
                <p className="text-xs text-gray-500">Privacidade da sala</p>
              </div>
            </div>
            <span className="font-mono text-sm font-bold text-yellow-400 bg-black/40 px-2.5 py-1 rounded-md border border-white/5">
              {roomCode}
            </span>
          </div>

          {/* Botão trocar código */}
          {onRefreshCode && (
            <button
              onClick={() => {
                onRefreshCode?.();
              }}
              className="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-900/30 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <span>Trocar código de compartilhamento</span>
            </button>
          )}

          {/* Social share buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              onClick={() => {
                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`Entra na minha sala privada no LiveDC para assistir minha tela: ${roomUrl}`)}`, '_blank');
              }}
              className="py-2 px-3 rounded-xl bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] border border-[#25D366]/40 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
            >
              <span>WhatsApp</span>
            </button>
            <button
              onClick={() => {
                window.open(`https://telegram.me/share/url?url=${encodeURIComponent(roomUrl)}&text=${encodeURIComponent('Assistir no LiveDC')}`, '_blank');
              }}
              className="py-2 px-3 rounded-xl bg-[#0088cc]/20 hover:bg-[#0088cc]/30 text-[#0088cc] border border-[#0088cc]/40 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
            >
              <span>Telegram</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#0f121a] border-t border-[#1f2636] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#1f2636] hover:bg-[#2a3449] text-gray-300 text-xs font-medium transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
