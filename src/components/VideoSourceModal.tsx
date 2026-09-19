import React, { useState } from 'react';
import { X, Tv, Play, Gamepad2, Film, Check } from 'lucide-react';

interface VideoSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVideoSource: (title: string, videoUrl: string, type: 'youtube' | 'sample') => void;
}

const SAMPLE_DEMO_STREAMS = [
  {
    id: 'minecraft',
    title: 'Minecraft - Survival Gameplay RTX',
    category: 'Jogo',
    badge: '60 FPS',
    thumbnail: 'https://images.unsplash.com/photo-1627856013091-fed6e4e30025?w=500&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  },
  {
    id: 'cyberpunk',
    title: 'Cyberpunk 2077 - Night City Drive',
    category: 'Gameplay',
    badge: '1080p',
    thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=500&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  },
  {
    id: 'synthwave',
    title: 'Lo-Fi Chill Gaming Radio Stream',
    category: 'Música & Vídeo',
    badge: 'Ao Vivo',
    thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
  },
];

export const VideoSourceModal: React.FC<VideoSourceModalProps> = ({
  isOpen,
  onClose,
  onSelectVideoSource,
}) => {
  const [customUrl, setCustomUrl] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApplyCustom = () => {
    if (!customUrl.trim()) return;
    let url = customUrl.trim();
    let type: 'youtube' | 'sample' = 'sample';

    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      type = 'youtube';
      // convert to embed if needed
      const videoIdMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
      if (videoIdMatch && videoIdMatch[1]) {
        url = `https://www.youtube-nocookie.com/embed/${videoIdMatch[1]}?autoplay=1&mute=0`;
      }
    }

    onSelectVideoSource('Transmissão de Vídeo Personalizada', url, type);
    onClose();
  };

  const handleSelectDemo = (item: typeof SAMPLE_DEMO_STREAMS[0]) => {
    setSelectedId(item.id);
    onSelectVideoSource(item.title, item.videoUrl, 'sample');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#141822] border border-[#263147] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#212a3d] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tv className="w-5 h-5 text-teal-400" />
            <h3 className="font-bold text-gray-100 text-sm">Adicionar Fonte de Vídeo (BETA)</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Custom Link input */}
          <div>
            <label className="text-xs text-gray-300 font-medium block mb-1.5 flex items-center gap-1.5">
              <Film className="w-4 h-4 text-teal-400" />
              Cole um link do YouTube ou vídeo MP4:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Ex: https://www.youtube.com/watch?v=... ou .mp4"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                className="flex-1 bg-[#0d1017] border border-[#273248] rounded-xl px-3 py-2 text-xs text-gray-200 outline-none focus:border-teal-500"
              />
              <button
                onClick={handleApplyCustom}
                disabled={!customUrl.trim()}
                className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-1 transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Transmitir</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 my-2">
            <div className="h-px flex-1 bg-white/10"></div>
            <span className="text-[11px] text-gray-500 uppercase font-semibold">ou escolha um teste</span>
            <div className="h-px flex-1 bg-white/10"></div>
          </div>

          {/* Sample game streams */}
          <div className="space-y-2">
            <label className="text-xs text-gray-400 font-medium block flex items-center gap-1.5">
              <Gamepad2 className="w-4 h-4 text-teal-400" />
              Transmissões de demonstração em alta definição:
            </label>

            {SAMPLE_DEMO_STREAMS.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelectDemo(item)}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-[#10141d] hover:bg-[#182030] border border-[#242e42] hover:border-teal-500 transition-all text-left group"
              >
                <div className="w-20 h-12 rounded-lg overflow-hidden relative shrink-0 bg-black">
                  <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                  <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-[9px] px-1 rounded text-white font-mono">
                    {item.badge}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-gray-200 group-hover:text-teal-300 truncate">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-gray-500">{item.category}</p>
                </div>

                <div className="shrink-0 p-1.5 rounded-lg bg-teal-500/10 text-teal-400 group-hover:bg-teal-500 group-hover:text-white transition-colors">
                  {selectedId === item.id ? <Check className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#0f121a] border-t border-[#1f2636] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#1f2636] hover:bg-[#2a3449] text-gray-300 text-xs font-medium transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
