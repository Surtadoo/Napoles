import React, { useState, useEffect } from 'react';
import { User, Sparkles, ArrowRight, Lock, Globe, KeyRound } from 'lucide-react';

interface NamePromptModalProps {
  isOpen: boolean;
  /** userName + senha digitada (só quando a sala do link é privada) */
  onJoin: (userName: string, password: string) => void;
  invitedRoomCode: string | null;
  invitedRoomName?: string;
  invitedRoomType?: 'public' | 'private';
  /** hash da senha esperada (vem no link). Vazio = sem senha */
  expectedPwHash?: string;
  hashPassword: (pw: string) => string;
}

export const NamePromptModal: React.FC<NamePromptModalProps> = ({
  isOpen,
  onJoin,
  invitedRoomCode,
  invitedRoomName,
  invitedRoomType = 'private',
  expectedPwHash = '',
  hashPassword,
}) => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isInvite = !!invitedRoomCode;
  const needsPassword = isInvite && invitedRoomType === 'private' && !!expectedPwHash;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Digite seu nome ou apelido para entrar.');
      return;
    }
    if (cleanName.length > 20) {
      setError('O nome deve ter no máximo 20 caracteres.');
      return;
    }
    if (needsPassword) {
      const pw = password.trim();
      if (!pw) {
        setError('Esta sala é privada. Digite a senha.');
        return;
      }
      if (hashPassword(pw) !== expectedPwHash) {
        setError('Senha incorreta. Peça a senha pra quem criou a sala.');
        return;
      }
      onJoin(cleanName, pw);
      return;
    }
    onJoin(cleanName, '');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="bg-[#141822] border border-[#2b374e] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-5 sm:p-6 text-gray-100 max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-5">
          <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-600/30 mb-3">
            <User className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center justify-center gap-2">
            <span>{isInvite ? 'Você foi convidado!' : 'Bem-vindo ao LiveDC'}</span>
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </h2>
          <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
            {isInvite ? (
              <>
                Entre na call para conversar por voz, vídeo e chat em tempo real.
                <span className="mt-2 flex items-center justify-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                      invitedRoomType === 'public'
                        ? 'bg-sky-500/15 border-sky-500/40 text-sky-200'
                        : 'bg-yellow-500/15 border-yellow-500/40 text-yellow-200'
                    }`}
                  >
                    {invitedRoomType === 'public' ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                    {invitedRoomType === 'public' ? 'Sala pública' : 'Sala privada'}
                  </span>
                  <span className="text-emerald-300 font-mono text-[13px]">
                    {invitedRoomName || `Sala ${invitedRoomCode}`}
                  </span>
                </span>
              </>
            ) : (
              'Digite seu nome para ver seus grupos, salas recentes e criar uma sala.'
            )}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1.5">Seu nome na call</label>
            <input
              type="text"
              autoFocus
              autoComplete="off"
              enterKeyHint={needsPassword ? 'next' : 'go'}
              placeholder="Ex: Gabriel, GamerPro, Maria..."
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              className="w-full bg-[#0d1017] border border-[#2c364d] focus:border-emerald-500 text-sm rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none transition-all"
            />
          </div>

          {needsPassword && (
            <div>
              <label className="text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-yellow-400" />
                Senha da sala
              </label>
              <input
                type="password"
                autoComplete="off"
                enterKeyHint="go"
                placeholder="Digite a senha"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                className="w-full bg-[#0d1017] border border-yellow-500/40 focus:border-yellow-400 text-sm rounded-xl px-4 py-3 text-yellow-100 placeholder-gray-500 outline-none transition-all"
              />
              <p className="text-[11px] text-gray-500 mt-1.5">
                A senha foi definida por quem criou a sala.
              </p>
            </div>
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
            <span>{isInvite ? 'Entrar na call agora' : 'Continuar'}</span>
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
