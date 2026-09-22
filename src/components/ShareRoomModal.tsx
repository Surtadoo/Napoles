import React, { useState } from 'react';
import { X, Copy, Check, Lock, ShieldCheck, Share2, Link2, RefreshCw } from 'lucide-react';
import { hashPassword } from '../utils/room';

interface ShareRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomName: string;
  roomCode: string;
  shareUrl: string;
  onRegenerateCode: () => void;
  roomPassword?: string;
  isPrivate?: boolean;
}

export const ShareRoomModal: React.FC<ShareRoomModalProps> = ({
  isOpen,
  onClose,
  roomCode,
  shareUrl,
  onRegenerateCode,
  roomPassword = '',
  isPrivate = true,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const pwHash = roomPassword ? hashPassword(roomPassword) : '';

  if (!isOpen) return null;

  const handleCopy = async () => {
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
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = roomCode;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-[#141822] border border-[#263147] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto">
        <div className="p-4 border-b border-[#212a3d] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-gray-100 text-sm">Compartilhar Sala LiveDC</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex items-start gap-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-lg leading-relaxed">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {isPrivate && roomPassword ? (
                <>
                  Mande o <b>link + senha</b>. A pessoa abre o link, digita o nome e a senha, e
                  entra na <b>mesma call</b> que você.
                </>
              ) : (
                <>
                  Mande o <b>link</b>. A pessoa abre, digita o nome e entra na <b>mesma call</b>{' '}
                  que você (sala pública, sem senha).
                </>
              )}
            </span>
          </div>

          {isPrivate && roomPassword && (
            <div className="bg-yellow-500/10 p-3 rounded-xl border border-yellow-500/30 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Lock className="w-4 h-4 text-yellow-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-yellow-100 font-semibold">Senha da sala</p>
                  <p className="text-[11px] text-yellow-200/70">Quem entrar pelo link precisa digitar</p>
                </div>
              </div>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(roomPassword);
                  } catch {}
                }}
                className="font-mono text-sm font-bold text-yellow-200 bg-black/40 px-3 py-1.5 rounded-md border border-yellow-500/30 touch-manipulation flex items-center gap-1.5 shrink-0"
                title="Copiar senha"
              >
                {roomPassword}
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {isPrivate && roomPassword && pwHash && (
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(pwHash);
                } catch {}
              }}
              className="w-full text-left bg-[#0d1017] border border-[#27344c] rounded-xl px-3 py-2 flex items-center justify-between gap-2 touch-manipulation"
              title="Copiar pwHash (pra fixar a sala no livedc-rooms.json)"
            >
              <span className="min-w-0">
                <span className="block text-[10px] uppercase tracking-wide text-gray-500 font-bold">
                  pwHash (pra fixar no arquivo livedc-rooms.json)
                </span>
                <span className="block font-mono text-[11px] text-gray-300 truncate">{pwHash}</span>
              </span>
              <Copy className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            </button>
          )}

          <div>
            <label className="text-xs text-gray-300 font-semibold mb-1.5 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-emerald-400" />
              Link direto da call (toque para copiar)
            </label>
            <button
              onClick={handleCopy}
              className="w-full flex items-center gap-2 bg-[#0d1017] border border-emerald-500/40 rounded-xl p-2.5 text-left active:bg-[#131a26] touch-manipulation"
            >
              <span className="text-xs text-emerald-300 font-mono flex-1 truncate select-text">
                {shareUrl}
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado!' : 'Copiar'}</span>
              </span>
            </button>
          </div>

          <div className="bg-[#19202e] p-3 rounded-xl border border-[#27344c] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-yellow-400" />
                <div>
                  <p className="text-xs text-gray-200 font-semibold">Código da sala</p>
                  <p className="text-[11px] text-gray-500">Identifica a sala (já vai no link)</p>
                </div>
              </div>
              <button
                onClick={handleCopyCode}
                className="font-mono text-base font-bold text-yellow-300 bg-black/40 px-3 py-1.5 rounded-md border border-yellow-500/30 active:bg-black/60 touch-manipulation flex items-center gap-1.5"
                title="Copiar código"
              >
                {roomCode}
                {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {!confirmRegen ? (
              <button
                onClick={() => setConfirmRegen(true)}
                className="w-full py-2 rounded-lg bg-[#232c40] hover:bg-[#2b3650] text-gray-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all touch-manipulation"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Trocar código de compartilhamento
              </button>
            ) : (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2.5 space-y-2">
                <p className="text-[11px] text-yellow-200 leading-relaxed">
                  Gerar um código novo troca o link da sala. Quem tem o link antigo não entra mais.
                  Continuar?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onRegenerateCode();
                      setConfirmRegen(false);
                    }}
                    className="flex-1 py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-bold touch-manipulation"
                  >
                    Sim, trocar
                  </button>
                  <button
                    onClick={() => setConfirmRegen(false)}
                    className="flex-1 py-1.5 rounded-lg bg-[#2a3449] text-gray-200 text-xs font-medium touch-manipulation"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                `Entra na minha call no LiveDC! Link: ${shareUrl}${isPrivate && roomPassword ? ` | Senha: ${roomPassword}` : ''}`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="py-2.5 px-3 rounded-xl bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/40 text-xs font-semibold flex items-center justify-center touch-manipulation"
            >
              WhatsApp
            </a>
            <a
              href={`https://telegram.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(
                `Entra na minha call!${isPrivate && roomPassword ? ` Senha: ${roomPassword}` : ''}`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="py-2.5 px-3 rounded-xl bg-[#0088cc]/20 text-[#4db8ff] border border-[#0088cc]/40 text-xs font-semibold flex items-center justify-center touch-manipulation"
            >
              Telegram
            </a>
          </div>
        </div>

        <div className="p-3 bg-[#0f121a] border-t border-[#1f2636] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-[#1f2636] text-gray-200 text-xs font-medium touch-manipulation"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
