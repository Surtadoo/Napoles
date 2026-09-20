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
  Camera,
  Users,
} from 'lucide-react';
import { StreamState } from '../types';
import type { RemoteStreamInfo } from '../hooks/useLiveRoom';

interface StreamViewProps {
  streamState: StreamState;
  remoteStreams: RemoteStreamInfo[];
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

function RemoteTile({ info }: { info: RemoteStreamInfo }) {
  const ref = useRef<HTMLVideoElement>(null);
  const hasVideo = info.stream.getVideoTracks().length > 0;

  useEffect(() => {
    if (ref.current && hasVideo) {
      ref.current.srcObject = info.stream;
      ref.current.play().catch(() => {});
    }
  }, [info.stream, hasVideo]);

  if (!hasVideo) return null;

  return (
    <div className="relative rounded-xl overflow-hidden bg-black border border-[#2b354a] shadow-xl min-h-[180px] flex items-center justify-center">
      <video ref={ref} autoPlay playsInline className="w-full h-full object-contain max-h-[42vh]" />
      <div className="absolute top-2 left-2 flex items-center gap-1.5">
        <span className="bg-red-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
          <Radio className="w-2.5 h-2.5 animate-pulse" /> AO VIVO
        </span>
        <span className="bg-black/60 backdrop-blur-md text-gray-200 text-[11px] font-semibold px-2 py-0.5 rounded-md border border-white/10 max-w-[160px] truncate">
          {info.kind === 'screen' ? `Tela de ${info.ownerName}` : `${info.ownerName}`}
        </span>
      </div>
      <div className="absolute bottom-2 right-2 bg-black/60 text-[10px] text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30">
        {info.kind === 'screen' ? 'TELA' : info.kind === 'camera' ? 'CÂMERA' : 'VÍDEO'}
      </div>
    </div>
  );
}

export const StreamView: React.FC<StreamViewProps> = ({
  streamState,
  remoteStreams,
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

  useEffect(() => {
    if (videoRef.current) {
      if (streamState.stream) {
        videoRef.current.srcObject = streamState.stream;
        videoRef.current.play().catch(() => {});
      } else if (streamState.videoUrl) {
        videoRef.current.srcObject = null;
        videoRef.current.src = streamState.videoUrl;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [streamState.stream, streamState.videoUrl]);

  useEffect(() => {
    if (facecamRef.current && cameraStream) {
      facecamRef.current.srcObject = cameraStream;
      facecamRef.current.play().catch(() => {});
    }
  }, [cameraStream, isCameraActive]);

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

  const videoRemotes = remoteStreams.filter((r) => r.stream.getVideoTracks().length > 0);
  const hasAnyStream = streamState.isSharing || videoRemotes.length > 0;
  const showGrid = videoRemotes.length > 0 && (streamState.isSharing || videoRemotes.length > 1);

  return (
    <main
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="flex-1 bg-[#0b0d11] relative flex flex-col overflow-hidden min-h-0 select-none"
    >
      {hasAnyStream ? (
        <div className="flex-1 w-full h-full overflow-y-auto p-4">
          {showGrid && (
            <div className="mb-3 flex items-center gap-2 text-xs text-gray-300">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>
                <b className="text-white">{videoRemotes.length + (streamState.isSharing ? 1 : 0)}</b> transmitindo agora
              </span>
            </div>
          )}

          <div
            className={
              showGrid
                ? 'grid grid-cols-1 xl:grid-cols-2 gap-3 items-start'
                : 'relative w-full h-full flex items-center justify-center bg-black rounded-xl overflow-hidden min-h-[50vh]'
            }
          >
            {streamState.isSharing && (
              <div className={`relative ${showGrid ? 'rounded-xl overflow-hidden bg-black border border-emerald-500/40 min-h-[180px]' : 'w-full h-full flex items-center justify-center'}`}>
                {streamState.type === 'youtube' && streamState.videoUrl ? (
                  <iframe
                    src={streamState.videoUrl}
                    className="w-full h-[50vh] border-0"
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
                    className={showGrid ? 'w-full max-h-[42vh] object-contain' : 'max-w-full max-h-full object-contain'}
                  />
                )}

                {isCameraActive && streamState.type !== 'camera' && !showGrid && (
                  <div className="absolute bottom-16 right-5 w-48 h-32 rounded-xl overflow-hidden shadow-2xl border-2 border-emerald-500 bg-gray-900 z-30">
                    <video
                      ref={facecamRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover transform -scale-x-100"
                    />
                    <div className="absolute bottom-1.5 left-2 bg-black/60 px-1.5 py-0.5 rounded text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                      <Camera className="w-2.5 h-2.5" />
                      <span>Câmera</span>
                    </div>
                  </div>
                )}

                <div className={`absolute top-3 left-3 flex items-center gap-2 ${showGrid ? '' : ''}`}>
                  <span className="bg-red-600/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1.5">
                    <Radio className="w-3 h-3 animate-pulse" /> AO VIVO
                  </span>
                  <span className="bg-black/60 text-gray-200 text-xs font-semibold px-3 py-1 rounded-md border border-white/10 max-w-[220px] truncate">
                    {streamState.title} (você)
                  </span>
                </div>

                {isRecording && !showGrid && (
                  <div className="absolute top-3 right-3 bg-red-900/80 border border-red-500/80 text-white text-xs px-3 py-1 rounded-full flex items-center gap-2 animate-pulse">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                    <span className="font-mono">REC {formatSeconds(recordingTime)}</span>
                  </div>
                )}
              </div>
            )}

            {videoRemotes.map((r) => (
              <RemoteTile key={r.key} info={r} />
            ))}
          </div>

          {/* barra de controles */}
          <div className="sticky bottom-2 mt-3 flex justify-center pointer-events-none">
            <div className={`bg-[#121620]/95 backdrop-blur-md border border-[#232b3d] px-4 py-2 rounded-2xl flex items-center gap-3 shadow-2xl transition-all pointer-events-auto ${controlsVisible ? 'opacity-100' : 'opacity-90'}`}>
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="text-gray-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10"
                title={isMuted ? 'Desmutar áudio' : 'Mutar áudio'}
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              </button>
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
                className="w-16 sm:w-20 accent-emerald-500 h-1.5 bg-gray-700 rounded-lg"
              />
              <div className="h-4 w-px bg-white/10"></div>
              <button
                onClick={onRecordScreen}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${isRecording ? 'bg-red-600 text-white animate-pulse' : 'bg-[#1b2230] text-gray-200'}`}
              >
                {isRecording ? <><Square className="w-3.5 h-3.5 fill-current" /><span>Parar ({formatSeconds(recordingTime)})</span></> : <><Download className="w-3.5 h-3.5 text-blue-400" /><span>Gravar Tela</span></>}
              </button>
              {streamState.isSharing && (
                <button
                  onClick={onStopSharing}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>Interromper</span>
                </button>
              )}
              <div className="h-4 w-px bg-white/10"></div>
              <button onClick={toggleFullscreen} className="text-gray-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10" title="Tela cheia">
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto w-full">
          {videoRemotes.length === 0 && (
            <>
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-full bg-[#182030] flex items-center justify-center border border-[#2b354a]">
                  <Monitor className="w-9 h-9 text-gray-500" />
                </div>
                <div className="absolute inset-0 rounded-full border border-emerald-500/20 animate-ping pointer-events-none"></div>
              </div>
              <h3 className="text-gray-300 font-medium text-base sm:text-lg mb-2">
                Ninguém está transmitindo ainda.
              </h3>
              <p className="text-[12px] text-emerald-400/80 mb-6">
                Compartilhe sua tela — quem entrar pelo link vai ver na hora.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md justify-center">
                <button
                  onClick={onStartScreenShare}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#10b981] hover:bg-[#059669] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg"
                >
                  <Monitor className="w-4 h-4" />
                  <span>Compartilhar tela</span>
                </button>
                <button
                  onClick={onStartCameraShare}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#10b981] hover:bg-[#059669] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg"
                >
                  <Video className="w-4 h-4" />
                  <span>Compartilhar câmera</span>
                </button>
              </div>
              <div className="mt-3 w-full max-w-md flex justify-center">
                <button
                  onClick={onOpenVideoSourceModal}
                  className="w-full sm:w-auto px-5 py-2 rounded-lg bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-semibold flex items-center justify-center gap-2"
                >
                  <Tv className="w-4 h-4" />
                  <span>Adicionar fonte de vídeo</span>
                  <span className="bg-teal-500/40 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">BETA</span>
                </button>
              </div>
              <p className="text-[11px] text-gray-500 mt-6 max-w-xs">
                Dica: copie o link no painel da esquerda e mande para seus amigos entrarem na mesma sala.
              </p>
            </>
          )}
        </div>
      )}
    </main>
  );
};
