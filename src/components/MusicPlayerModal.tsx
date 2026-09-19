import React, { useState } from 'react';
import { X, Music, Play, Pause, Volume2, SkipForward } from 'lucide-react';

interface MusicPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STATIONS = [
  { id: 'lofi', name: 'Chill Lofi Beats', genre: 'Relax & Chill', url: 'https://streams.ilovemusic.de/iloveradio17.mp3' },
  { id: 'synth', name: 'Synthwave & Cyberpunk Gaming', genre: 'Retro Electro', url: 'https://streams.ilovemusic.de/iloveradio2.mp3' },
  { id: 'gaming', name: 'Hardcore Gaming EDM', genre: 'Bass / Gaming', url: 'https://streams.ilovemusic.de/iloveradio1.mp3' },
];

export const MusicPlayerModal: React.FC<MusicPlayerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStation, setCurrentStation] = useState(STATIONS[0]);
  const [volume, setVolume] = useState(0.8);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  if (!isOpen) return null;

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleSelectStation = (station: typeof STATIONS[0]) => {
    setCurrentStation(station);
    if (audioRef.current) {
      audioRef.current.src = station.url;
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#141822] border border-[#263147] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <audio
          ref={audioRef}
          src={currentStation.url}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        {/* Header */}
        <div className="p-4 border-b border-[#212a3d] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-teal-400" />
            <h3 className="font-bold text-gray-100 text-sm">Rádio LiveDC (BETA)</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Player UI */}
        <div className="p-5 space-y-4">
          <div className="bg-gradient-to-br from-teal-950/60 to-emerald-950/60 p-4 rounded-xl border border-teal-500/20 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-teal-500/20 flex items-center justify-center mb-3">
              <Music className={`w-8 h-8 text-teal-400 ${isPlaying ? 'animate-bounce' : ''}`} />
            </div>
            <h4 className="font-bold text-gray-100 text-sm">{currentStation.name}</h4>
            <p className="text-xs text-teal-300/80">{currentStation.genre}</p>

            {/* Play/Pause control */}
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                onClick={togglePlay}
                className="w-12 h-12 rounded-full bg-teal-500 hover:bg-teal-400 text-black flex items-center justify-center transition-all shadow-lg shadow-teal-500/30 hover:scale-105"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>
            </div>
          </div>

          {/* Volume control */}
          <div className="flex items-center gap-3 px-2">
            <Volume2 className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setVolume(val);
                if (audioRef.current) audioRef.current.volume = val;
              }}
              className="w-full accent-teal-400 h-1.5 bg-gray-700 rounded-lg cursor-pointer"
            />
          </div>

          {/* Station list */}
          <div className="space-y-1.5 pt-1">
            <p className="text-[11px] text-gray-400 uppercase font-semibold">Estações disponíveis:</p>
            {STATIONS.map((st) => (
              <button
                key={st.id}
                onClick={() => handleSelectStation(st)}
                className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-all ${
                  currentStation.id === st.id
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                    : 'bg-[#10141d] text-gray-300 hover:bg-[#182030] border border-[#222a3d]'
                }`}
              >
                <span>{st.name}</span>
                <SkipForward className="w-3.5 h-3.5 opacity-60" />
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
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
