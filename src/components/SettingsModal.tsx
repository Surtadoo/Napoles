import React, { useState, useEffect } from 'react';
import { 
  X, 
  Mic, 
  Video, 
  Volume2, 
  Sliders, 
  Sparkles, 
  Monitor,
  Check
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  streamQuality: string;
  onChangeQuality: (quality: string) => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  streamQuality,
  onChangeQuality,
  isMuted,
  onToggleMute,
}) => {
  const [activeTab, setActiveTab] = useState<'devices' | 'mixer' | 'quality'>('devices');
  const [micLevel, setMicLevel] = useState(30);
  const [systemVolume, setSystemVolume] = useState(75);
  const [browserVolume, setBrowserVolume] = useState(85);
  const [steamVolume, setSteamVolume] = useState(60);
  const [masterVolume, setMasterVolume] = useState(90);

  // Animated mic meter simulation
  useEffect(() => {
    if (!isOpen || isMuted) {
      setMicLevel(0);
      return;
    }
    const interval = setInterval(() => {
      setMicLevel(Math.floor(20 + Math.random() * 55));
    }, 150);
    return () => clearInterval(interval);
  }, [isOpen, isMuted]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#141822] border border-[#263147] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-[#212a3d] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-gray-100 text-sm">Configurações da Transmissão</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex items-center border-b border-[#212a3d] px-4 bg-[#10141c]">
          <button
            onClick={() => setActiveTab('devices')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'devices'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Dispositivos
          </button>
          <button
            onClick={() => setActiveTab('mixer')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'mixer'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>Mixer de Volume</span>
            <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1 rounded">Windows</span>
          </button>
          <button
            onClick={() => setActiveTab('quality')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'quality'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Qualidade de Vídeo
          </button>
        </div>

        {/* Body content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {activeTab === 'devices' && (
            <div className="space-y-4">
              {/* Microphone */}
              <div>
                <label className="flex items-center justify-between text-xs font-medium text-gray-300 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Mic className="w-4 h-4 text-emerald-400" />
                    Microfone de Entrada
                  </span>
                  <button
                    onClick={onToggleMute}
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded transition-colors ${
                      isMuted ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                    }`}
                  >
                    {isMuted ? 'Silenciado' : 'Ativo'}
                  </button>
                </label>
                <select className="w-full bg-[#0d1017] border border-[#273248] rounded-xl px-3 py-2 text-xs text-gray-200 outline-none focus:border-emerald-500">
                  <option>Microfone Padrão (Realtek High Definition Audio)</option>
                  <option>Microfone USB / Headset</option>
                  <option>NVIDIA Broadcast Virtual Microphone</option>
                </select>

                {/* Mic test level */}
                <div className="mt-2.5 bg-[#0e1219] p-2.5 rounded-xl border border-[#222b3d]">
                  <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                    <span>Nível de detecção de voz</span>
                    <span className="font-mono">{isMuted ? '0%' : `${micLevel}%`}</span>
                  </div>
                  <div className="h-2 w-full bg-[#1b2230] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 via-yellow-400 to-red-500 transition-all duration-150"
                      style={{ width: `${isMuted ? 0 : micLevel}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Camera selection */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-300 mb-1.5">
                  <Video className="w-4 h-4 text-emerald-400" />
                  Câmera / Webcam
                </label>
                <select className="w-full bg-[#0d1017] border border-[#273248] rounded-xl px-3 py-2 text-xs text-gray-200 outline-none focus:border-emerald-500">
                  <option>Webcam Integrada (HD 1080p)</option>
                  <option>OBS Virtual Camera</option>
                  <option>DroidCam Source</option>
                </select>
              </div>

              {/* Speakers selection */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-300 mb-1.5">
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  Saída de Áudio (Alto-falantes / Fone)
                </label>
                <select className="w-full bg-[#0d1017] border border-[#273248] rounded-xl px-3 py-2 text-xs text-gray-200 outline-none focus:border-emerald-500">
                  <option>Alto-falantes (Realtek High Definition Audio)</option>
                  <option>Fone de ouvido Estéreo</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'mixer' && (
            /* Windows Volume Mixer style view like in screenshot! */
            <div className="bg-[#0f131a] rounded-xl border border-[#253047] p-4">
              <div className="text-center text-xs font-semibold text-gray-300 mb-3 pb-2 border-b border-[#212b3e]">
                Mixer de Volume - Alto-falantes (Realtek High Definition Audio)
              </div>

              <div className="grid grid-cols-4 gap-3 text-center">
                {/* Dispositivo: Alto-falantes */}
                <div className="flex flex-col items-center bg-[#151a24] p-2.5 rounded-lg border border-[#232c3f]">
                  <span className="text-[10px] text-gray-400 font-medium h-4">Dispositivo</span>
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center my-2">
                    <Volume2 className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] text-gray-300 truncate w-full">Alto-falantes</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={masterVolume}
                    onChange={(e) => setMasterVolume(Number(e.target.value))}
                    className="h-28 w-1.5 my-3 accent-emerald-500"
                    style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                  />
                  <span className="text-[11px] font-mono text-emerald-400">{masterVolume}%</span>
                </div>

                {/* Sons do Sistema */}
                <div className="flex flex-col items-center bg-[#151a24] p-2.5 rounded-lg border border-[#232c3f]">
                  <span className="text-[10px] text-gray-400 font-medium h-4">Aplicativos</span>
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center my-2">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] text-gray-300 truncate w-full">Sons Sistema</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={systemVolume}
                    onChange={(e) => setSystemVolume(Number(e.target.value))}
                    className="h-28 w-1.5 my-3 accent-emerald-500"
                    style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                  />
                  <span className="text-[11px] font-mono text-gray-300">{systemVolume}%</span>
                </div>

                {/* Microsoft Edge / Browser */}
                <div className="flex flex-col items-center bg-[#151a24] p-2.5 rounded-lg border border-[#232c3f]">
                  <span className="text-[10px] text-gray-400 font-medium h-4">Navegador</span>
                  <div className="w-8 h-8 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center my-2">
                    <Monitor className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] text-gray-300 truncate w-full">GoLive Web</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={browserVolume}
                    onChange={(e) => setBrowserVolume(Number(e.target.value))}
                    className="h-28 w-1.5 my-3 accent-emerald-500"
                    style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                  />
                  <span className="text-[11px] font-mono text-gray-300">{browserVolume}%</span>
                </div>

                {/* Steam */}
                <div className="flex flex-col items-center bg-[#151a24] p-2.5 rounded-lg border border-[#232c3f]">
                  <span className="text-[10px] text-gray-400 font-medium h-4">Jogos</span>
                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center my-2">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] text-gray-300 truncate w-full">Steam / Game</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={steamVolume}
                    onChange={(e) => setSteamVolume(Number(e.target.value))}
                    className="h-28 w-1.5 my-3 accent-emerald-500"
                    style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                  />
                  <span className="text-[11px] font-mono text-gray-300">{steamVolume}%</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'quality' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">
                Selecione a resolução e taxa de quadros (FPS) para sua transmissão de tela:
              </p>

              {[
                { name: '2160p 4K 60fps', desc: 'Ultra HD 3840×2160 — máxima nitidez (exige boa internet)', badge: '4K ULTRA' },
                { name: '1080p 60fps', desc: 'Full HD — ideal para jogos rápidos', badge: 'RECOMENDADO' },
                { name: '720p 60fps', desc: 'Equilíbrio ideal entre fluidez e velocidade de upload' },
                { name: '720p 30fps', desc: 'Economia de banda e conexões lentas' },
              ].map((opt) => (
                <button
                  key={opt.name}
                  onClick={() => onChangeQuality(opt.name)}
                  className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                    streamQuality === opt.name
                      ? 'bg-emerald-500/10 border-emerald-500 text-white'
                      : 'bg-[#121620] border-[#252f44] text-gray-300 hover:border-gray-500'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs">{opt.name}</span>
                      {opt.badge && (
                        <span className="text-[9px] bg-emerald-500/30 text-emerald-300 font-bold px-1.5 py-0.5 rounded">
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">{opt.desc}</p>
                  </div>
                  {streamQuality === opt.name && (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#0f121a] border-t border-[#1f2636] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors shadow"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
