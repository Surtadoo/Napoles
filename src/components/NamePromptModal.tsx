import React, { useState, useEffect } from 'react';
import { User, Sparkles, ArrowRight, Lock, Link2, KeyRound } from 'lucide-react';

interface NamePromptModalProps {
  isOpen: boolean;
  /** userName + código da sala escolhido (pode ser diferente do link) */
  onJoin: (userName: string, roomCode: string) => void;
  invitedRoomCode: string | null;
}

export const NamePromptModal: React.FC<NamePromptModalProps> = ({
  isOpen,
  onJoin,
  invitedRoomCode,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [useOtherCode, setUseOtherCode] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setCode(invitedRoomCode || '');
      setUseOtherCode(false);
      setError('');
    }
  }, [isOpen, invitedRoomCode]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Digite seu nome ou apelido para entrar na call.');
      return;
    }
    if (cleanName.length > 20) {
      setError('O nome deve ter no máximo 20 caracteres.');
      return;
    }

    const cleanCode = code.trim();

    // Veio por link OU quer entrar em outra sala pelo código
    if (invitedRoomCode || useOtherCode) {
      if (!cleanCode) {
        setError('Digite o código da sala (6 dígitos).');
        return;
      }
      if (!/^\d{4,10}$/.test(cleanCode)) {
        setError('Código inválido. Use só números (ex: 489059).');
        return;
      }
      // qualquer código válido entra na sala daquele código —
      // igual ao do link entra na sala do link; diferente entra na outra sala
      onJoin(cleanName, cleanCode);
      return;
    }

    // criando sala nova (sem link, sem código)
    onJoin(cleanName, '');
  };

  const showCodeField = !!invitedRoomCode || useOtherCode;
  const isDifferentFromLink =
    !!invitedRoomCode && code.trim() !== '' && code.trim() !== invitedRoomCode;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="bg-[#141822] border border-[#2b374e] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-5 sm:p-6 text-gray-100 max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-5">
          <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-600/30 mb-3">
            <User className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center justify-center gap-2">
            <span>{invitedRoomCode ? 'Você foi convidado!' : 'Bem-vindo ao LiveDC'}</span>
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </h2>
          <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
            {invitedRoomCode ? (
              <>
                Entre na call para conversar por voz, vídeo e chat em tempo real.
                <span className="block mt-1.5 text-emerald-300 font-mono text-[13px]">
                  Sala do link: {invitedRoomCode}
                </span>
              </>
            ) : (
              'Crie sua sala privada ou entre em uma sala existente pelo código.'
            )}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1.5">
              Seu nome na call
            </label>
            <input
              type="text"
              autoFocus
              autoComplete="off"
              enterKeyHint="next"
              placeholder="Ex: Gabriel, GamerPro, Maria..."
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              className="w-full bg-[#0d1017] border border-[#2c364d] focus:border-emerald-500 text-sm rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none transition-all"
            />
          </div>

          {showCodeField && (
            <div>
              <label className="text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-yellow-400" />
                Código da sala
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                enterKeyHint="go"
                placeholder="Digite o código de 6 dígitos"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, '').slice(0, 10));
                  setError('');
                }}
                className={`w-full bg-[#0d1017] border text-sm rounded-xl px-4 py-3 font-mono tracking-widest text-center text-base outline-none transition-all ${
                  isDifferentFromLink
                    ? 'border-sky-400 text-sky-200'
                    : 'border-yellow-500/40 focus:border-yellow-400 text-yellow-200'
                }`}
              />
              {isDifferentFromLink ? (
                <p className="text-[11px] text-sky-300 mt-1.5 flex items-center gap-1">
                  <KeyRound className="w-3 h-3" />
                  Você vai entrar na sala <b className="font-mono">{code.trim()}</b> (diferente do
                  link).
                </p>
              ) : (
                <p className="text-[11px] text-gray-500 mt-1.5 flex items-center gap-1">
                  <Link2 className="w-3 h-3" />
                  {invitedRoomCode
                    ? 'Já veio preenchido do link. Pode trocar por outro código pra entrar em outra sala.'
                    : 'Peça o código para quem criou a sala.'}
                </p>
              )}
            </div>
          )}

          {!invitedRoomCode && (
            <button
              type="button"
              onClick={() => {
                setUseOtherCode((v) => !v);
                setError('');
                if (useOtherCode) setCode('');
              }}
              className="w-full text-[11px] text-emerald-300 hover:text-emerald-200 underline underline-offset-2 text-left"
            >
              {useOtherCode ? '← Voltar e criar uma sala nova' : 'Tenho um código de sala → entrar com código'}
            </button>
          )}

          {error && (
            <p className="text-[11px] sm:text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 font-medium">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-[#10b981] hover:bg-[#059669] active:bg-[#047857] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg touch-manipulation"
          >
            <span>
              {showCodeField
                ? isDifferentFromLink
                  ? `Entrar na sala ${code.trim()}`
                  : 'Entrar na call agora'
                : 'Criar sala LiveDC'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-[10px] text-center text-gray-500 mt-4">
          🔒 Conexão P2P criptografada. Funciona no celular e no PC.
        </p>
      </div>
    </div>
  );
};
