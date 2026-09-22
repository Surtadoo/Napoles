import React from 'react';
import { X, Monitor, SwitchCamera, FileVideo, Info } from 'lucide-react';

interface MobileScreenShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNativeScreen: () => void;
  onRearCamera: () => void;
  onOpenFile: () => void;
}

export const MobileScreenShareModal: React.FC<MobileScreenShareModalProps> = ({
  isOpen,
  onClose,
  onNativeScreen,
  onRearCamera,
  onOpenFile,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-[#141822] border border-[#263147] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-[#212a3d] flex items-center justify-between">
          <h3 className="font-bold text-gray-100 text-sm">Compartilhar no celular</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 touch-manipulation"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-2">
          <button
            onClick={onNativeScreen}
            className="w-full p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/50 text-left flex items-center gap-3 active:bg-emerald-500/25 touch-manipulation"
          >
            <span className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
              <Monitor className="w-5 h-5 text-emerald-300" />
            </span>
            <span>
              <span className="block text-xs font-bold text-emerald-200">Tela do celular</span>
              <span className="block text-[11px] text-gray-400">
                Android (Chrome/Samsung): vai abrir "Compartilhar tela inteira" → toque em{' '}
                <b className="text-gray-200">Iniciar agora</b>. Depois volte pro navegador.
              </span>
            </span>
          </button>

          <button
            onClick={onRearCamera}
            className="w-full p-3 rounded-xl bg-[#10141d] border border-[#242e42] text-left flex items-center gap-3 active:bg-[#182030] touch-manipulation"
          >
            <span className="w-10 h-10 rounded-xl bg-sky-500/15 flex items-center justify-center shrink-0">
              <SwitchCamera className="w-5 h-5 text-sky-300" />
            </span>
            <span>
              <span className="block text-xs font-bold text-gray-200">Câmera traseira</span>
              <span className="block text-[11px] text-gray-400">
                Recomendado no iPhone — todos veem ao vivo.
              </span>
            </span>
          </button>

          <button
            onClick={onOpenFile}
            className="w-full p-3 rounded-xl bg-[#10141d] border border-[#242e42] text-left flex items-center gap-3 active:bg-[#182030] touch-manipulation"
          >
            <span className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center shrink-0">
              <FileVideo className="w-5 h-5 text-purple-300" />
            </span>
            <span>
              <span className="block text-xs font-bold text-gray-200">Vídeo / arquivo (BETA)</span>
              <span className="block text-[11px] text-gray-400">
                YouTube, Twitch, Kick ou arquivo do aparelho.
              </span>
            </span>
          </button>

          <p className="text-[10px] text-gray-500 flex items-start gap-1.5 pt-1">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            O iPhone (Safari) não permite capturar a tela pelo navegador — é limite da Apple.
          </p>
        </div>

        <div className="p-3 bg-[#0f121a] border-t border-[#1f2636] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-[#1f2636] text-gray-200 text-xs font-medium touch-manipulation"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
