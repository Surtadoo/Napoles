import React, { useRef, useEffect, useState } from 'react';
import { 
  Monitor, 
  Video, 
  Tv, 
  Maximize, 
  Minimize, 
  Volume2, 
  VolumeX, 
  Square, 
  Radio, 
  Download, 
  Camera
} from 'lucide-react';
import { StreamState } from '../types';

interface StreamViewProps {
  streamState: StreamState;
  onStartScreenShare: () => Promise<void>;
  onStartCameraShare: () => Promise<void>;
  onOpenVideoSourceModal: () => void;
  onStopSharing: () => void;
  isCameraActive: boolean;
  cameraStream: MediaStream | null;
  onRecordScreen: () => void;
  isRecording: boolean;
  recordingTime: number;
}

export const StreamView: React.FC<StreamViewProps> = ({
  streamState,
  onStartScreenShare,
  onStartCameraShare,
  onOpenVideoSourceModal,
  onStopSharing,
  isCameraActive,
  cameraStream,
  isRecording,
  recordingTime,
  onRecordScreen,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const facecamRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);

  // Bind main media stream to video element
  useEffect(() => {
    if (videoRef.current) {
      if (streamState.stream) {
        videoRef.current.srcObject = streamState.stream;
        videoRef.current.play().catch((err) => {
          console.warn('Auto-play was prevented:', err);
        });
      } else if (streamState.videoUrl) {
        videoRef.current.srcObject = null;
        videoRef.current.src = streamState.videoUrl;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [streamState.stream, streamState.videoUrl]);

  // Bind facecam stream to picture-in-picture circle/box
  useEffect(() => {
    if (facecamRef.current && cameraStream) {
      facecamRef.current.srcObject = cameraStream;
      facecamRef.current.play().catch(() => {});
    }
  }, [cameraStream, isCameraActive]);

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen().catch(() => {});
    } else {
      await document.exitFullscreen().catch(() => {});
    }
  };

  const handleMouseMove = () => {
    setControlsVisible(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      setControlsVisible(false);
    }, 3500);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <main 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="flex-1 bg-[#0b0d11] relative flex items-center justify-center overflow-hidden min-h-0 select-none"
    >
      {/* If active stream is showing */}
      {streamState.isSharing ? (
        <div className="relative w-full h-full flex items-center justify-center bg-black">
          {/* Main shared screen / camera video */}
          {streamState.type === 'youtube' && streamState.videoUrl ? (
            <iframe
              src={streamState.videoUrl}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="YouTube Stream"
            />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={isMuted}
              className="max-w-full max-h-full object-contain pointer-events-auto"
            />
          )}

          {/* Picture-in-picture facecam (if camera is on during screen sharing) */}
          {isCameraActive && streamState.type !== 'camera' && (
            <div className="absolute bottom-16 right-5 w-48 h-32 rounded-xl overflow-hidden shadow-2xl border-2 border-emerald-500 bg-gray-900 group z-30 transition-all hover:scale-105">
              <video
                ref={facecamRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
              <div className="absolute bottom-1.5 left-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                <Camera className="w-2.5 h-2.5" />
                <span>Câmera</span>
              </div>
            </div>
          )}

          {/* Top stream metadata banner */}
          <div 
            className={`absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none transition-opacity duration-300 z-20 ${
              controlsVisible ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div className="flex items-center gap-2.5 pointer-events-auto">
              <span className="bg-red-600/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1.5 shadow-md shadow-red-950/50">
                <Radio className="w-3 h-3 animate-pulse" />
                AO VIVO
              </span>

              <span className="bg-black/60 backdrop-blur-md text-gray-200 text-xs font-semibold px-3 py-1 rounded-md border border-white/10">
                {streamState.title || 'Tela de Surtado'}
              </span>

              <span className="bg-black/50 backdrop-blur-md text-emerald-400 font-mono text-[11px] px-2 py-1 rounded-md border border-emerald-500/30">
                {streamState.quality}
              </span>
            </div>

            {/* Recording badge */}
            {isRecording && (
              <div className="bg-red-900/80 border border-red-500/80 text-white text-xs px-3 py-1 rounded-full flex items-center gap-2 animate-pulse shadow-lg">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                <span className="font-semibold font-mono">REC {formatSeconds(recordingTime)}</span>
              </div>
            )}
          </div>

          {/* Bottom stream controls bar */}
          <div 
            className={`absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#121620]/90 backdrop-blur-md border border-[#232b3d] px-4 py-2 rounded-2xl flex items-center gap-3 shadow-2xl transition-all duration-300 z-20 pointer-events-auto ${
              controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
            }`}
          >
            {/* Volume mute toggle */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="text-gray-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              title={isMuted ? 'Desmutar áudio' : 'Mutar áudio'}
            >
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>

            {/* Volume range slider */}
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setVolume(val);
                setIsMuted(val === 0);
                if (videoRef.current) videoRef.current.volume = val;
              }}
              className="w-16 sm:w-20 accent-emerald-500 cursor-pointer h-1.5 bg-gray-700 rounded-lg"
            />

            <div className="h-4 w-px bg-white/10"></div>

            {/* Record screen button */}
            <button
              onClick={onRecordScreen}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                isRecording
                  ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                  : 'bg-[#1b2230] hover:bg-[#253045] text-gray-200'
              }`}
              title="Gravar transmissão"
            >
              {isRecording ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Parar Gravação</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                  <span>Gravar Tela</span>
                </>
              )}
            </button>

            {/* Stop sharing button */}
            <button
              onClick={onStopSharing}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-red-950/40"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Interromper</span>
            </button>

            <div className="h-4 w-px bg-white/10"></div>

            {/* Fullscreen toggle */}
            <button
              onClick={toggleFullscreen}
              className="text-gray-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              title="Tela cheia"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      ) : (
        /* Empty State: exactly as shown in screenshot */
        <div className="flex flex-col items-center justify-center p-6 text-center max-w-lg">
          {/* Subtle radar / broadcast icon animation */}
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-full bg-[#182030] flex items-center justify-center border border-[#2b354a] shadow-inner shadow-black">
              <Monitor className="w-9 h-9 text-gray-500" />
            </div>
            <div className="absolute inset-0 rounded-full border border-emerald-500/20 animate-ping pointer-events-none"></div>
          </div>

          <h3 className="text-gray-300 font-medium text-base sm:text-lg mb-6">
            Ninguém está transmitindo ainda.
          </h3>

          {/* Action buttons row */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md justify-center">
            {/* Compartilhar tela - Main Green Button */}
            <button
              onClick={onStartScreenShare}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#10b981] hover:bg-[#059669] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Monitor className="w-4 h-4" />
              <span>Compartilhar tela</span>
            </button>

            {/* Compartilhar câmera - Secondary Green Button */}
            <button
              onClick={onStartCameraShare}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#10b981] hover:bg-[#059669] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Video className="w-4 h-4" />
              <span>Compartilhar câmera</span>
            </button>
          </div>

          {/* Adicionar fonte de vídeo BETA button */}
          <div className="mt-3 w-full max-w-md flex justify-center">
            <button
              onClick={onOpenVideoSourceModal}
              className="w-full sm:w-auto px-5 py-2 rounded-lg bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Tv className="w-4 h-4" />
              <span>Adicionar fonte de vídeo</span>
              <span className="bg-teal-500/40 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                BETA
              </span>
            </button>
          </div>

          <p className="text-[11px] text-gray-500 mt-6 max-w-xs">
            Dica: você pode compartilhar a tela inteira, uma janela de aplicativo ou uma aba do navegador com áudio.
          </p>
        </div>
      )}
    </main>
  );
};
