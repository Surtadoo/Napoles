import React, { useState } from 'react';
import { Shield, ArrowRight, X } from 'lucide-react';

interface AccessCodeModalProps {
  isOpen: boolean;
  onAccessGranted: (userName: string) => void;
  onClose: () => void;
  expectedCode: string;
  userName?: string;
}

export const AccessCodeModal: React.FC<AccessCodeModalProps> = ({
  isOpen,
  onAccessGranted,
  onClose,
  expectedCode,
  userName = '',
}) => {
  const [enteredCode, setEnteredCode] = useState('');
  const [enteredName, setEnteredName] = useState(userName);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = enteredName.trim();
    if (!cleanName) {
      setError('Digite seu nome para entrar.');
      return;
    }
    if (enteredCode !== expectedCode) {
      setError('Código de acesso incorreto. Verifique o código enviado pelo dono da sala.');
      return;
    }
    onAccessGranted(cleanName);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="bg-[#131722] border border-[#2a3548] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-6 text-gray-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base">Acesso à Sala Privada</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded hover:bg-white/5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-xs text-gray-400 bg-[#0d1017] border border-[#222b3d] rounded-lg p-3">
            <p className="font-semibold text-gray-200 mb-1">Sala: Time_do_Sky</p>
            <p>Você recebeu um convite privado. Insira o código correto para entrar.</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1.5">Seu nome</label>
            <input
              type="text"
              autoFocus
              placeholder="Como você quer ser chamado?"
              value={enteredName}
              onChange={(e) => { setEnteredName(e.target.value); setError(''); }}
              className="w-full bg-[#0d1017] border border-[#263045] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-emerald-500 transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1.5">Código de acesso</label>
            <input
              type="text"
              placeholder="Digite o código enviado pelo dono"
              value={enteredCode}
              onChange={(e) => { setEnteredCode(e.target.value); setError(''); }}
              className="w-full bg-[#0d1017] border border-[#263045] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-emerald-500 transition-all tracking-[0.15em] font-mono text-center text-lg"
            />
          </div>

          {error && <p className="text-[11px] text-red-400 font-medium">{error}</p>}

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-all active:scale-[0.99]"
          >
            <span>Entrar na Sala</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
