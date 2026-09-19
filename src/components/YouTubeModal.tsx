import React, { useState } from 'react';
import { X, Play, Tv } from 'lucide-react';

interface YouTubeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartWatchParty: (videoUrl: string, title: string) => void;
}

const POPULAR_VIDEOS = [
  {
    title: 'David Kushner - Daylight (Official Music Video)',
    videoId: '2X8Bal395r8',
    channel: 'David Kushner',
  },
  {
    title: 'Minecraft 1.21 Tricky Trials - Official Trailer',
    videoId: 'q-9F5_hZ7fQ',
    channel: 'Minecraft',
  },
  {
    title: 'Lofi Hip Hop Radio - Beats to relax/study to',
    videoId: 'jfKfPfyJRdk',
    channel: 'Lofi Girl',
  },
];

export const YouTubeModal: React.FC<YouTubeModalProps> = ({
  isOpen,
  onClose,
  onStartWatchParty,
}) => {
  const [youtubeUrl, setYoutubeUrl] = useState('');

  if (!isOpen) return null;

  const handleStart = (urlOrId: string, title?: string) => {
    let videoId = urlOrId;
    if (urlOrId.includes('youtube.com') || urlOrId.includes('youtu.be')) {
      const match = urlOrId.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
      if (match && match[1]) {
        videoId = match[1];
      }
    }
    const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=0&enablejsapi=1`;
    onStartWatchParty(embedUrl, title || 'YouTube Watch Together');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#141822] border border-[#263147] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#212a3d] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tv className="w-5 h-5 text-red-500" />
            <h3 className="font-bold text-gray-100 text-sm">Assistir YouTube Juntos (BETA)</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-gray-300 font-medium block mb-1.5">
              Cole o link de qualquer vídeo do YouTube:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                className="flex-1 bg-[#0d1017] border border-[#273248] rounded-xl px-3 py-2 text-xs text-gray-200 outline-none focus:border-red-500"
              />
              <button
                onClick={() => handleStart(youtubeUrl)}
                disabled={!youtubeUrl.trim()}
                className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white text-xs font-semibold flex items-center gap-1 transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play</span>
              </button>
            </div>
          </div>

          <div className="pt-2">
            <label className="text-xs text-gray-400 font-medium block mb-2">
              Sugestões em alta:
            </label>
            <div className="space-y-2">
              {POPULAR_VIDEOS.map((vid) => (
                <button
                  key={vid.videoId}
                  onClick={() => handleStart(vid.videoId, vid.title)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#0e1219] hover:bg-[#182030] border border-[#222b3e] text-left transition-all group"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-semibold text-gray-200 group-hover:text-red-400 truncate">
                      {vid.title}
                    </p>
                    <p className="text-[10px] text-gray-500">{vid.channel}</p>
                  </div>
                  <Play className="w-4 h-4 text-red-500 shrink-0 group-hover:scale-110 transition-transform fill-current" />
                </button>
              ))}
            </div>
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
