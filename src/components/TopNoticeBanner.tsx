import React, { useState } from 'react';
import { Sparkles, X } from 'lucide-react';

interface TopNoticeBannerProps {
  onDismiss?: () => void;
}

export const TopNoticeBanner: React.FC<TopNoticeBannerProps> = ({ onDismiss }) => {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="w-full bg-[#1b2b65] text-white text-[13px] font-medium py-1.5 px-4 flex items-center justify-between border-b border-[#2d3f82] select-none transition-all duration-200">
      <div className="flex-1 text-center flex items-center justify-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-yellow-400 shrink-0 animate-pulse" />
        <span>
          Hoje (18/09) é o último dia para criar uma conta e receber a badge <strong className="text-yellow-300 font-semibold underline decoration-yellow-400/50">Beta Tester</strong>! A partir de amanhã será impossível obter essa badge para seu perfil.
        </span>
      </div>
      <button 
        onClick={() => {
          setVisible(false);
          onDismiss?.();
        }}
        className="text-white/70 hover:text-white p-0.5 rounded hover:bg-white/10 transition-colors ml-2"
        title="Fechar aviso"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
