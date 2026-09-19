import React from 'react';
import { X, CheckCircle2, Zap, Sparkles } from 'lucide-react';

interface ProModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProModal: React.FC<ProModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#141822] border border-[#2b374e] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-700 to-indigo-600 p-6 text-white text-center">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="w-12 h-12 mx-auto rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-2 shadow-inner">
            <Zap className="w-6 h-6 text-yellow-300 fill-current" />
          </div>
          <h3 className="text-xl font-bold">LiveDC Pro</h3>
          <p className="text-xs text-blue-100 mt-1">Transmissões sem limites e máxima performance</p>
        </div>

        {/* Benefits */}
        <div className="p-6 space-y-3">
          {[
            'Qualidade de transmissão Full HD 1080p a 60 FPS',
            'Gravação de tela e câmera ilimitada com download direto',
            'Badge de verificação Pro dourada no seu perfil LiveDC',
            'Salas com até 50 pessoas sem latência',
            'Transmissão ultrarrápida com servidores dedicados',
          ].map((item, idx) => (
            <div key={idx} className="flex items-center gap-2.5 text-xs text-gray-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{item}</span>
            </div>
          ))}

          <div className="mt-6 pt-4 border-t border-[#232d3f] flex items-center justify-between">
            <div>
              <span className="text-2xl font-black text-white">R$ 9,90</span>
              <span className="text-xs text-gray-400"> / mês</span>
            </div>
            <button
              onClick={() => {
                alert('Parabéns! Sua assinatura LiveDC Pro de demonstração foi ativada com sucesso!');
                onClose();
              }}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20 hover:scale-105 transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              <span>Assinar Pro</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
