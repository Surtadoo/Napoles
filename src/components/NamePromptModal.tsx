import React, { useState } from 'react';
import { User, Sparkles, ArrowRight } from 'lucide-react';

interface NamePromptModalProps {
  isOpen: boolean;
  onJoin: (userName: string) => void;
}

export const NamePromptModal: React.FC<NamePromptModalProps> = ({ isOpen, onJoin }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Por favor, digite seu nome ou apelido para entrar na sala.');
      return;
    }
    if (cleanName.length > 20) {
      setError('O nome deve ter no máximo 20 caracteres.');
      return;
    }
    onJoin(cleanName);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-[#141822] border border-[#2b374e] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-6 text-gray-100">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-600/30 mb-3">
            <User className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-wide flex items-center justify-center gap-2">
            <span>Bem-vindo ao LiveDC</span>
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </h2>
          <p className="text-xs text-gray-400 mt-1.5">
            Entre na sala privada para transmitir sua tela, áudio e conversar em tempo real.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1.5">
              Como você quer ser chamado(a)?
            </label>
            <div className="relative">
              <input
                type="text"
                autoFocus
                placeholder="Ex: Gabriel, GamerPro, Maria..."
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                className="w-full bg-[#0d1017] border border-[#2c364d] focus:border-emerald-500 text-sm rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none transition-all shadow-inner"
              />
            </div>
            {error && (
              <p className="text-[11px] text-red-400 mt-1.5 font-medium">{error}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-[#10b981] hover:bg-[#059669] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
          >
            <span>Entrar na Sala LiveDC</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-[10px] text-center text-gray-500 mt-4">
          🔒 Conexão criptografada de ponta a ponta. Seu código e transmissão estão protegidos.
        </p>
      </div>
    </div>
  );
};
