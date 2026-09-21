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
  Expand,
  X,
  RectangleHorizontal,
  Crosshair,
  Eye,
  EyeOff,
  FileVideo,
  Lock as LockIcon,
} from 'lucide-react';
import { StreamState } from '../types';
import type { SharedMediaPayload } from '../types';
import type { RemoteStreamInfo } from '../hooks/useLiveRoom';
import { withMutedParam } from '../utils/media';

// Barra de controles da tela compartilhada — no lugar do ampliar sozinho
// (sem PiP e sem nova janela): ajustar + focar + ampliar + tela cheia + ocultar
function TileControlBar({
  tileRef,
  fit,
  onToggleFit,
  hidden,
  onToggleHidden,
  onExpand,
  audioMuted,
  onToggleAudio,
}: {
  tileRef: React.RefObject<HTMLDivElement | null>;
  fit: 'contain' | 'cover';
  onToggleFit: () => void;
  hidden: boolean;
  onToggleHidden: () => void;
  onExpand: () => void;
  audioMuted?: boolean;
  onToggleAudio?: () => void;
}) {
  const handleTileFullscreen = async () => {
    try {
      const el = tileRef.current;
      if (!el) return;
      if (!document.fullscreenElement) {
        await el.requestFullscreen().catch(() => {});
      } else {
        await document.exitFullscreen().catch(() => {});
      }
    } catch {}
  };

  const handleFocus = () => {
    // focar = abrir em destaque (teatro)
    onExpand();
  };

  const btn =
    'p-1.5 rounded-md text-gray-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all touch-manipulation';

  return (
    <div
      className="absolute top-2 right-2 z-30 flex items-center gap-1 sm:gap-1.5 bg-[#23262c]/95 backdrop-blur-md border border-white/10 rounded-lg px-1.5 sm:px-2 py-1 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={onToggleFit}
        title={fit === 'contain' ? 'Preencher tela (cortar bordas)' : 'Ajustar tela inteira (sem corte)'}
        className={btn}
      >
        <RectangleHorizontal className="w-[18px] h-[18px]" />
      </button>
      <button onClick={handleFocus} title="Focar nesta tela" className={btn}>
        <Crosshair className="w-[18px] h-[18px]" />
      </button>
      <button onClick={onExpand} title="Ampliar (modo teatro)" className={btn}>
        <Expand className="w-[18px] h-[18px]" />
      </button>
      {onToggleAudio && (
        <button
          onClick={onToggleAudio}
          title={audioMuted ? 'Ativar áudio do vídeo' : 'Ocultar áudio do vídeo'}
          className={btn}
        >
          {audioMuted ? (
            <VolumeX className="w-[18px] h-[18px] text-red-400" />
          ) : (
            <Volume2 className="w-[18px] h-[18px]" />
          )}
        </button>
      )}
      <button onClick={handleTileFullscreen} title="Tela cheia" className={btn}>
        <Maximize className="w-[18px] h-[18px]" />
      </button>
      <button
        onClick={onToggleHidden}
        title={hidden ? 'Mostrar vídeo' : 'Ocultar vídeo (só áudio)'}
        className={btn}
      >
        {hidden ? <Eye className="w-[18px] h-[18px]" /> : <EyeOff className="w-[18px] h-[18px]" />}
      </button>
    </div>
  );
}

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
  sharedVideo: SharedMediaPayload | null;
  sharedFileUrl?: string | null;
  canControlSharedVideo: boolean;
  onCloseSharedVideo: () => void;
}

type FocusedItem =
  | { kind: 'local' }
  | { kind: 'remote'; key: string; ownerName: string; streamKind: string; stream: MediaStream }
  | { kind: 'shared'; title: string; src: string; isEmbed: boolean };

function FocusedOverlay({
  item,
  localState,
  onClose,
}: {
  item: FocusedItem;
  localState: StreamState;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [isFs, setIsFs] = useState(false);

  const isShared = item.kind === 'shared';
  const stream: MediaStream | null =
    item.kind === 'local' ? localState.stream : item.kind === 'remote' ? item.stream : null;
  const title =
    item.kind === 'local'
      ? `${localState.title} (você)`
      : item.kind === 'shared'
        ? item.title
        : item.streamKind === 'screen'
          ? `Tela de ${item.ownerName}`
          : `${item.ownerName}`;
  const isYoutube = item.kind === 'local' && localState.type === 'youtube' && !!localState.videoUrl;
  const isSharedEmbed = isShared && item.isEmbed;
  const isSharedFile = isShared && !item.isEmbed;

  useEffect(() => {
    if (!isYoutube && !isShared && videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream, isYoutube, isShared]);

  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggleFs = async () => {
    if (!boxRef.current) return;
    if (!document.fullscreenElement) {
      await boxRef.current.requestFullscreen().catch(() => {});
    } else {
      await document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/95 backdrop-blur-sm flex flex-col p-2 sm:p-4">
      <div className="flex items-center justify-between gap-2 pb-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="bg-red-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1.5 shrink-0">
            <Radio className="w-3 h-3 animate-pulse" /> AO VIVO
          </span>
          <span className="text-gray-100 text-xs sm:text-sm font-semibold truncate">{title}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={toggleFs}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white touch-manipulation"
            title="Tela cheia"
          >
            {isFs ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-red-600 hover:bg-red-700 text-white touch-manipulation"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div ref={boxRef} className="flex-1 min-h-0 bg-black rounded-xl overflow-hidden flex items-center justify-center">
        {isSharedEmbed && isShared ? (
          <iframe
            src={item.src}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={title}
          />
        ) : isSharedFile && isShared ? (
          <video
            src={item.src}
            controls
            autoPlay
            playsInline
            className="w-full h-full object-contain bg-black"
          />
        ) : isYoutube && localState.videoUrl ? (
          <iframe
            src={localState.videoUrl}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={title}
          />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            controls={false}
            className="w-full h-full object-contain bg-black"
          />
        )}
      </div>
      <p className="text-center text-[11px] text-gray-500 pt-2 shrink-0">
        Toque no <Maximize className="w-3 h-3 inline" /> para tela cheia • ESC ou ✕ para voltar
      </p>
    </div>
  );
}

function RemoteTile({
  info,
  onExpand,
  solo = false,
}: {
  info: RemoteStreamInfo;
  onExpand: () => void;
  /** true = é a única transmissão → ocupa a área toda (grande) */
  solo?: boolean;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const tileRef = useRef<HTMLDivElement | null>(null);
  const [fit, setFit] = useState<'contain' | 'cover'>('contain');
  const [hidden, setHidden] = useState(false);
  // só mostra tile com vídeo VIVO (evita cinza/bug de track encerrada)
  const hasVideo = info.stream.getVideoTracks().some((t) => t.readyState === 'live');

  useEffect(() => {
    if (ref.current && hasVideo && !hidden) {
      ref.current.srcObject = info.stream;
      ref.current.muted = true;
      ref.current.play().catch(() => {});
    }
  }, [info.stream, hasVideo, hidden]);

  if (!hasVideo) return null;

  const label = info.kind === 'screen' ? `Tela de ${info.ownerName}` : `${info.ownerName}`;

  return (
    <div
      ref={tileRef}
      className={
        solo
          ? 'relative w-full h-full bg-black flex items-center justify-center group'
          : 'relative rounded-xl overflow-hidden bg-black border border-[#2b354a]/80 shadow-md min-h-[140px] flex items-center justify-center group'
      }
    >
      {hidden ? (
        <div
          className={`w-full flex flex-col items-center justify-center gap-1.5 text-gray-400 ${
            solo ? 'h-full min-h-[50vh]' : 'max-h-[24vh] min-h-[120px]'
          }`}
        >
          <EyeOff className="w-6 h-6" />
          <p className="text-[11px] font-medium">Vídeo oculto — só áudio</p>
          <p className="text-[10px] text-gray-500">{label}</p>
        </div>
      ) : (
        <video
          ref={ref}
          autoPlay
          playsInline
          muted
          className={
            solo
              ? `w-full h-full bg-black ${fit === 'contain' ? 'object-contain' : 'object-cover'}`
              : `w-full h-full max-h-[24vh] bg-black ${fit === 'contain' ? 'object-contain' : 'object-cover'}`
          }
        />
      )}
      <div className="absolute top-2 left-2 flex items-center gap-1.5 max-w-[calc(100%-13rem)]">
        <span className="bg-red-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
          <Radio className="w-2.5 h-2.5 animate-pulse" /> AO VIVO
        </span>
        <span className="bg-black/60 backdrop-blur-md text-gray-200 text-[11px] font-semibold px-2 py-0.5 rounded-md border border-white/10 truncate">
          {label}
        </span>
      </div>
      {/* barrinha no lugar do ampliar sozinho (canto superior direito) */}
      <TileControlBar
        tileRef={tileRef}
        fit={fit}
        onToggleFit={() => setFit((f) => (f === 'contain' ? 'cover' : 'contain'))}
        hidden={hidden}
        onToggleHidden={() => setHidden((h) => !h)}
        onExpand={onExpand}
      />
      <div className="absolute bottom-2 right-2 bg-black/60 text-[10px] text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30">
        {info.kind === 'screen' ? 'TELA' : info.kind === 'camera' ? 'CÂMERA' : 'VÍDEO'}
      </div>
    </div>
  );
}

function platformBadgeClass(platform: SharedMediaPayload['platform']): string {
  switch (platform) {
    case 'youtube':
      return 'bg-red-600/90 text-white';
    case 'twitch':
      return 'bg-purple-600/90 text-white';
    case 'kick':
      return 'bg-emerald-600/90 text-white';
    case 'file':
      return 'bg-sky-600/90 text-white';
  }
}

/** Tile do vídeo BETA (YouTube/Twitch/Kick/arquivo) — igual ao compartilhamento de tela. */
function SharedVideoTile({
  media,
  playableUrl,
  isLocalFile,
  canControl,
  onClose,
  onExpand,
}: {
  media: SharedMediaPayload;
  playableUrl: string | null;
  isLocalFile: boolean;
  canControl: boolean;
  onClose: () => void;
  onExpand: (src: string, isEmbed: boolean) => void;
}) {
  const tileRef = useRef<HTMLDivElement | null>(null);
  const fileVideoRef = useRef<HTMLVideoElement | null>(null);
  const [fit, setFit] = useState<'contain' | 'cover'>('contain');
  const [hiddenVideo, setHiddenVideo] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);

  const isFile = media.platform === 'file';
  const isEmbed = !isFile && !!playableUrl;

  useEffect(() => {
    if (fileVideoRef.current) {
      fileVideoRef.current.muted = audioMuted;
    }
  }, [audioMuted, playableUrl]);

  const iframeSrc =
    !isFile && playableUrl ? withMutedParam(playableUrl, media.platform, audioMuted) : playableUrl;

  const handleExpand = () => {
    if (!playableUrl) return;
    onExpand(playableUrl, isEmbed);
  };

  return (
    <div
      ref={tileRef}
      className="relative rounded-xl overflow-hidden bg-black border-2 border-teal-500/60 shadow-2xl shadow-teal-950/30 min-h-[320px] md:col-span-2 xl:col-span-3 flex items-center justify-center group"
    >
      {hiddenVideo ? (
        <div className="w-full max-h-[58vh] min-h-[280px] flex flex-col items-center justify-center gap-2 text-gray-400">
          <EyeOff className="w-10 h-10" />
          <p className="text-sm font-medium">Vídeo oculto — {audioMuted ? 'sem áudio' : 'só áudio'}</p>
          <p className="text-xs text-gray-500 truncate max-w-[80%]">{media.title}</p>
        </div>
      ) : !playableUrl ? (
        <div className="w-full max-h-[58vh] min-h-[280px] flex flex-col items-center justify-center gap-2 text-gray-400 p-4 text-center">
          <FileVideo className="w-10 h-10 text-sky-400" />
          <p className="text-sm font-medium">Arquivo local de {media.leaderName}</p>
          <p className="text-xs text-gray-500">Só ele vê — peça para compartilhar a tela.</p>
        </div>
      ) : isEmbed && iframeSrc ? (
        <iframe
          key={iframeSrc}
          src={iframeSrc}
          className="w-full h-full min-h-[320px] max-h-[58vh] border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={media.title}
        />
      ) : (
        <video
          ref={fileVideoRef}
          src={playableUrl}
          controls
          autoPlay
          playsInline
          muted={audioMuted}
          className={`w-full h-full max-h-[58vh] min-h-[280px] ${fit === 'contain' ? 'object-contain' : 'object-cover'}`}
        />
      )}

      <div className="absolute top-2 left-2 flex items-center gap-1.5 max-w-[calc(100%-13rem)] flex-wrap">
        <span className="bg-red-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
          <Radio className="w-2.5 h-2.5 animate-pulse" /> AO VIVO
        </span>
        <span className="bg-black/60 backdrop-blur-md text-gray-200 text-[11px] font-semibold px-2 py-0.5 rounded-md border border-white/10 truncate max-w-[140px]">
          {media.title}
        </span>
        <span
          className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase shrink-0 ${platformBadgeClass(media.platform)}`}
        >
          {media.platform}
        </span>
      </div>

      <TileControlBar
        tileRef={tileRef}
        fit={fit}
        onToggleFit={() => setFit((f) => (f === 'contain' ? 'cover' : 'contain'))}
        hidden={hiddenVideo}
        onToggleHidden={() => setHiddenVideo((h) => !h)}
        onExpand={handleExpand}
        audioMuted={audioMuted}
        onToggleAudio={() => setAudioMuted((m) => !m)}
      />

      {canControl && (
        <button
          onClick={onClose}
          title="Encerrar vídeo para todos"
          className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-red-600/90 hover:bg-red-600 text-white text-[10px] font-bold flex items-center gap-1 touch-manipulation"
        >
          <Square className="w-2.5 h-2.5 fill-current" />
          Encerrar
        </button>
      )}
      <div className="absolute bottom-2 right-2 bg-black/60 text-[10px] text-gray-300 px-1.5 py-0.5 rounded border border-white/10 flex items-center gap-1">
        {media.controller === 'leader' ? (
          <>
            <LockIcon className="w-2.5 h-2.5 text-yellow-400" />
            <span className="text-yellow-300">Só {media.leaderName}</span>
          </>
        ) : (
          <>
            <Users className="w-2.5 h-2.5 text-sky-400" />
            <span className="text-sky-300">Todos controlam</span>
          </>
        )}
        {isLocalFile && <span className="text-gray-500">• seu arquivo</span>}
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
  sharedVideo,
  sharedFileUrl,
  canControlSharedVideo,
  onCloseSharedVideo,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const facecamRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const localTileRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [volume, setVolume] = useState(1);
  // prévia local começa mutada (evita eco + libera autoplay, sem tela cinza)
  const [isMuted, setIsMuted] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [focused, setFocused] = useState<FocusedItem | null>(null);
  const [localFit, setLocalFit] = useState<'contain' | 'cover'>('contain');
  const [localHidden, setLocalHidden] = useState(false);
  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (videoRef.current && !localHidden) {
      if (streamState.stream) {
        videoRef.current.srcObject = streamState.stream;
        videoRef.current.play().catch(() => {});
      } else if (streamState.videoUrl) {
        videoRef.current.srcObject = null;
        videoRef.current.src = streamState.videoUrl;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [streamState.stream, streamState.videoUrl, localHidden]);

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

  // só conta vídeo com trilha viva (tile morto não entra na grade)
  const videoRemotes = remoteStreams.filter((r) =>
    r.stream.getVideoTracks().some((t) => t.readyState === 'live')
  );
  const hasSharedVideo = !!sharedVideo;
  const hasAnyStream = streamState.isSharing || videoRemotes.length > 0 || hasSharedVideo;
  const tileCount =
    (streamState.isSharing ? 1 : 0) + videoRemotes.length + (hasSharedVideo ? 1 : 0);
  const showGrid = tileCount > 1;
  const is4k = /4k|2160/i.test(streamState.quality || '');

  // URL que este cliente usa para o vídeo BETA (arquivo local só abre para quem enviou)
  const sharedPlayableUrl: string | null = !sharedVideo
    ? null
    : sharedVideo.platform === 'file'
      ? sharedVideo.localOnly
        ? sharedFileUrl || null
        : sharedVideo.embedUrl || null
      : sharedVideo.embedUrl || null;
  const sharedIsLocalFile = !!sharedVideo?.localOnly && !!sharedFileUrl;

  return (
    <main
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="flex-1 bg-[#0b0d11] relative flex flex-col overflow-hidden min-h-0 select-none"
    >
      {focused && (
        <FocusedOverlay item={focused} localState={streamState} onClose={() => setFocused(null)} />
      )}

      {hasAnyStream ? (
        <div className="flex-1 w-full h-full overflow-y-auto p-2 sm:p-4">
          {showGrid && (
            <div className="mb-3 flex items-center gap-2 text-xs text-gray-300">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>
                <b className="text-white">{tileCount}</b> transmitindo agora
                <span className="text-gray-500"> — toque em <Expand className="w-3 h-3 inline" /> para ampliar qualquer tela</span>
              </span>
            </div>
          )}

          <div
            className={
              showGrid
                ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-start'
                : 'relative w-full h-full flex items-center justify-center bg-black rounded-xl overflow-hidden min-h-[50vh]'
            }
          >
            {streamState.isSharing && (
              <div
                ref={localTileRef}
                className={`relative group ${showGrid ? 'rounded-xl overflow-hidden bg-black border-2 border-emerald-500/50 shadow-xl min-h-[300px] md:col-span-2 xl:col-span-2 flex items-center justify-center' : 'w-full h-full flex items-center justify-center'}`}
              >
                {streamState.type === 'youtube' && streamState.videoUrl ? (
                  <iframe
                    src={streamState.videoUrl}
                    className="w-full h-[50vh] border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="YouTube Stream"
                  />
                ) : localHidden ? (
                  <div className="w-full max-h-[52vh] min-h-[260px] flex flex-col items-center justify-center gap-2 text-gray-400">
                    <EyeOff className="w-9 h-9" />
                    <p className="text-sm font-medium">Sua prévia oculta — os outros ainda veem</p>
                  </div>
                ) : (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={isMuted}
                    className={
                      showGrid
                        ? `w-full max-h-[52vh] min-h-[260px] ${localFit === 'contain' ? 'object-contain' : 'object-cover'}`
                        : `max-w-full max-h-full ${localFit === 'contain' ? 'object-contain' : 'object-cover'}`
                    }
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

                <div className="absolute top-2 left-2 flex items-center gap-2 max-w-[calc(100%-13rem)]">
                  <span className="bg-red-600/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1.5 shrink-0">
                    <Radio className="w-3 h-3 animate-pulse" /> AO VIVO
                  </span>
                  <span className="bg-black/60 text-gray-200 text-xs font-semibold px-3 py-1 rounded-md border border-white/10 truncate">
                    {streamState.title} (você)
                  </span>
                  {is4k && (
                    <span className="bg-purple-600/90 text-white text-[10px] font-black px-1.5 py-1 rounded shrink-0">
                      4K
                    </span>
                  )}
                </div>

                {/* barrinha no lugar do ampliar sozinho (canto superior direito) */}
                {streamState.type !== 'youtube' && (
                  <TileControlBar
                    tileRef={localTileRef}
                    fit={localFit}
                    onToggleFit={() => setLocalFit((f) => (f === 'contain' ? 'cover' : 'contain'))}
                    hidden={localHidden}
                    onToggleHidden={() => setLocalHidden((h) => !h)}
                    onExpand={() => setFocused({ kind: 'local' })}
                  />
                )}

                {isRecording && !showGrid && (
                  <div className="absolute top-12 right-2 bg-red-900/80 border border-red-500/80 text-white text-xs px-3 py-1 rounded-full flex items-center gap-2 animate-pulse">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                    <span className="font-mono">REC {formatSeconds(recordingTime)}</span>
                  </div>
                )}
              </div>
            )}

            {sharedVideo && (
              <SharedVideoTile
                key={`shared-${sharedVideo.id}`}
                media={sharedVideo}
                playableUrl={sharedPlayableUrl}
                isLocalFile={sharedIsLocalFile}
                canControl={canControlSharedVideo}
                onClose={onCloseSharedVideo}
                onExpand={(src, isEmbed) =>
                  setFocused({ kind: 'shared', title: sharedVideo.title, src, isEmbed })
                }
              />
            )}

            {videoRemotes.map((r) => (
              <RemoteTile
                key={r.key}
                info={r}
                solo={!showGrid}
                onExpand={() =>
                  setFocused({ kind: 'remote', key: r.key, ownerName: r.ownerName, streamKind: r.kind, stream: r.stream })
                }
              />
            ))}
          </div>

          <div className="sticky bottom-2 mt-3 flex justify-center pointer-events-none">
            <div className={`bg-[#121620]/95 backdrop-blur-md border border-[#232b3d] px-3 sm:px-4 py-2 rounded-2xl flex items-center gap-2 sm:gap-3 shadow-2xl transition-all pointer-events-auto max-w-[96vw] overflow-x-auto ${controlsVisible ? 'opacity-100' : 'opacity-90'}`}>
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="text-gray-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 shrink-0"
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
                className="w-14 sm:w-20 accent-emerald-500 h-1.5 bg-gray-700 rounded-lg shrink-0"
              />
              <div className="h-4 w-px bg-white/10 shrink-0"></div>
              <button
                onClick={onRecordScreen}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0 touch-manipulation ${isRecording ? 'bg-red-600 text-white animate-pulse' : 'bg-[#1b2230] text-gray-200'}`}
              >
                {isRecording ? <><Square className="w-3.5 h-3.5 fill-current" /><span>Parar ({formatSeconds(recordingTime)})</span></> : <><Download className="w-3.5 h-3.5 text-blue-400" /><span>Gravar Tela</span></>}
              </button>
              {streamState.isSharing && (
                <button
                  onClick={onStopSharing}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 touch-manipulation"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>Interromper</span>
                </button>
              )}
              <div className="h-4 w-px bg-white/10 shrink-0"></div>
              <button onClick={toggleFullscreen} className="text-gray-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 shrink-0" title="Tela cheia">
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto w-full overflow-y-auto">
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
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#10b981] hover:bg-[#059669] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg touch-manipulation"
            >
              <Monitor className="w-4 h-4" />
              <span>Compartilhar tela</span>
            </button>
            <button
              onClick={onStartCameraShare}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#10b981] hover:bg-[#059669] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg touch-manipulation"
            >
              <Video className="w-4 h-4" />
              <span>Compartilhar câmera</span>
            </button>
          </div>
          <div className="mt-3 w-full max-w-md flex justify-center">
            <button
              onClick={onOpenVideoSourceModal}
              className="w-full sm:w-auto px-5 py-2 rounded-lg bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-semibold flex items-center justify-center gap-2 touch-manipulation"
            >
              <Tv className="w-4 h-4" />
              <span>Adicionar fonte de vídeo</span>
              <span className="bg-teal-500/40 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">BETA</span>
            </button>
          </div>
          <p className="text-[11px] text-gray-500 mt-6 max-w-xs">
            Dica: copie o link no painel de pessoas e mande para seus amigos entrarem na mesma sala.
          </p>
        </div>
      )}
    </main>
  );
};
