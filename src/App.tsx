import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Video, Users, MessageCircle } from 'lucide-react';
import { TopNoticeBanner } from './components/TopNoticeBanner';
import { HeaderBar } from './components/HeaderBar';
import { LeftSidebar } from './components/LeftSidebar';
import { StreamView } from './components/StreamView';
import { RightSidebar } from './components/RightSidebar';
import { ShareRoomModal } from './components/ShareRoomModal';
import { SettingsModal } from './components/SettingsModal';
import { VideoSourceModal } from './components/VideoSourceModal';
import { YouTubeModal } from './components/YouTubeModal';
import { MusicPlayerModal } from './components/MusicPlayerModal';
import { ProModal } from './components/ProModal';
import { NamePromptModal } from './components/NamePromptModal';
import { Participant, ChatMessage, StreamState } from './types';
import { initAntiInspectionAndProtection } from './utils/security';
import { useLiveRoom } from './hooks/useLiveRoom';
import {
  generateRoomCode,
  getRoomCodeFromUrl,
  buildShareUrl,
  persistRoomCodeInUrl,
  avatarForName,
  copyText,
} from './utils/room';

export function App() {
  useEffect(() => {
    initAntiInspectionAndProtection();
  }, []);

  // Detecta se abriu por link de convite (tem ?room= na URL inicial)
  const [initialInviteCode] = useState<string | null>(() => getRoomCodeFromUrl());

  const [roomCode, setRoomCode] = useState<string>(() => {
    const fromUrl = getRoomCodeFromUrl();
    return fromUrl || generateRoomCode();
  });
  const [roomName] = useState('Time_do_Sky');
  const [isPrivate] = useState(true);

  useEffect(() => {
    persistRoomCodeInUrl(roomCode);
  }, [roomCode]);

  const shareUrl = useMemo(() => buildShareUrl(roomCode), [roomCode]);

  // mobile tabs
  const [mobileTab, setMobileTab] = useState<'video' | 'participants' | 'chat'>('video');

  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [isNameModalOpen, setIsNameModalOpen] = useState(true);
  const userAvatar = useMemo(
    () => (currentUserName ? avatarForName(currentUserName) : avatarForName('voce')),
    [currentUserName]
  );

  const [isMuted, setIsMuted] = useState(true);
  const [isDeafened, setIsDeafened] = useState(false);
  const [streamQuality, setStreamQuality] = useState('1080p 60fps');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const [streamState, setStreamState] = useState<StreamState>({
    type: 'none',
    stream: null,
    title: 'Ninguém está transmitindo ainda.',
    quality: '1080p 60fps',
    isSharing: false,
    isPaused: false,
  });

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userPoints, setUserPoints] = useState(150);
  const [streamerMode, setStreamerMode] = useState(false);

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isVideoSourceModalOpen, setIsVideoSourceModalOpen] = useState(false);
  const [isYouTubeModalOpen, setIsYouTubeModalOpen] = useState(false);
  const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);
  const [isProModalOpen, setIsProModalOpen] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 4200);
  }, []);

  const addSystemMessage = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        sender: 'Sistema',
        avatar: '',
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isSystem: true,
      },
    ]);
  }, []);

  const handleRemoteChat = useCallback((msg: ChatMessage) => {
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
  }, []);

  const handlePeerJoinNotice = useCallback(
    (name: string) => {
      addSystemMessage(`${name} entrou na call.`);
      showToast(`${name} entrou na call!`);
    },
    [addSystemMessage, showToast]
  );

  const handlePeerLeaveNotice = useCallback(
    (name: string) => {
      addSystemMessage(`${name} saiu da call.`);
    },
    [addSystemMessage]
  );

  const profileSharing =
    streamState.isSharing && (streamState.type === 'screen' || streamState.type === 'camera');

  const liveRoom = useLiveRoom({
    roomCode,
    userName: currentUserName,
    userAvatar,
    enabled: !!currentUserName,
    isMuted,
    isSharing: profileSharing,
    isCameraOn: isCameraActive,
    onRemoteChat: handleRemoteChat,
    onPeerJoinNotice: handlePeerJoinNotice,
    onPeerLeaveNotice: handlePeerLeaveNotice,
  });

  const { remotePeersList, remoteStreams, connectionStatus } = liveRoom;

  const participants: Participant[] = useMemo(() => {
    const list: Participant[] = [];
    if (currentUserName) {
      list.push({
        id: 'current-user',
        name: currentUserName,
        avatar: userAvatar,
        isOwner: !initialInviteCode,
        isMuted,
        isSpeaking: !isMuted,
        isScreenSharing: profileSharing,
        isCameraOn: isCameraActive,
        tag: 'você',
      });
    }
    remotePeersList.forEach((p) => {
      list.push({
        id: p.peerId,
        name: p.name,
        avatar: p.avatar || avatarForName(p.name),
        isGuest: true,
        isMuted: p.muted,
        isSpeaking: !p.muted,
        isScreenSharing: p.sharing,
        isCameraOn: p.cameraOn,
        tag: 'na call',
      });
    });
    return list;
  }, [currentUserName, userAvatar, isMuted, profileSharing, isCameraActive, remotePeersList, initialInviteCode]);

  // troca de código: gera novo, atualiza URL, limpa sala e reentra
  const handleRegenerateCode = useCallback(() => {
    // para mídias locais antes de trocar
    try {
      streamState.stream?.getTracks().forEach((t) => t.stop());
    } catch {}
    try {
      cameraStream?.getTracks().forEach((t) => t.stop());
    } catch {}
    setCameraStream(null);
    setIsCameraActive(false);
    setStreamState({
      type: 'none',
      stream: null,
      videoUrl: undefined,
      title: 'Ninguém está transmitindo ainda.',
      quality: streamQuality,
      isSharing: false,
      isPaused: false,
    });
    const novo = generateRoomCode();
    setRoomCode(novo);
    setMessages([]);
    setTimeout(() => {
      addSystemMessage(`Código da sala trocado para ${novo}. Envie o novo link + código.`);
      showToast(`Novo código: ${novo}. Link atualizado!`);
    }, 300);
  }, [streamState.stream, cameraStream, streamQuality, addSystemMessage, showToast]);

  const micStreamRef = useRef<MediaStream | null>(null);

  const ensureMicStream = async (): Promise<MediaStream | null> => {
    if (micStreamRef.current) {
      micStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = true));
      return micStreamRef.current;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      micStreamRef.current = s;
      liveRoom.publishStream(s, 'mic', 'mic-local');
      return s;
    } catch {
      showToast('Permita o microfone no navegador para falar na call.');
      return null;
    }
  };

  const handleToggleMic = async () => {
    if (isMuted) {
      const s = await ensureMicStream();
      if (!s) return;
      s.getAudioTracks().forEach((t) => (t.enabled = true));
      setIsMuted(false);
      showToast('Microfone ativado — todos ouvem você.');
    } else {
      micStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = false));
      setIsMuted(true);
    }
  };

  const handleToggleDeafen = () => {
    const next = !isDeafened;
    setIsDeafened(next);
    remoteStreams.forEach((r) => {
      r.stream.getAudioTracks().forEach((t) => (t.enabled = !next));
    });
    try {
      document.querySelectorAll('audio').forEach((a) => {
        (a as HTMLAudioElement).muted = next;
      });
    } catch {}
    showToast(next ? 'Som da sala silenciado para você.' : 'Som da sala ativado.');
  };

  const handleUserJoin = (userName: string) => {
    setCurrentUserName(userName);
    setIsNameModalOpen(false);
    setTimeout(() => {
      addSystemMessage(
        initialInviteCode
          ? `${userName} entrou na call ${roomCode} pelo link.`
          : `${userName} criou a sala ${roomCode}. Copie o link para chamar amigos.`
      );
      showToast(
        initialInviteCode
          ? `Bem-vindo à call, ${userName}!`
          : `Bem-vindo, ${userName}! Toque em Convidar para chamar.`
      );
    }, 300);
  };

  const handleStartScreenShare = async () => {
    try {
      const nav: any = navigator;
      const getDisplay =
        nav?.mediaDevices?.getDisplayMedia?.bind(nav.mediaDevices) ||
        (nav as any)?.getDisplayMedia?.bind(nav);
      if (!getDisplay) {
        // iPhone/Safari não tem getDisplayMedia — orienta a usar câmera
        showToast('Este celular não permite tela. Use a Câmera para transmitir seu vídeo.');
        return;
      }
      const mediaStream: MediaStream = await nav.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 30 } },
        audio: true,
      });
      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) videoTrack.onended = () => handleStopSharing();
      const activeName = currentUserName || 'Você';
      setStreamState({
        type: 'screen',
        stream: mediaStream,
        title: `Tela de ${activeName}`,
        quality: streamQuality,
        isSharing: true,
        isPaused: false,
      });
      liveRoom.publishStream(mediaStream, 'screen', 'screen-local');
      addSystemMessage(`${activeName} compartilha a tela — todos veem ao vivo.`);
      showToast('Tela ao vivo! Todos na sala veem.');
    } catch (err: unknown) {
      const error = err as Error;
      if (error?.name === 'NotAllowedError') showToast('Compartilhamento cancelado.');
      else showToast('Não foi possível compartilhar a tela aqui. Tente a câmera.');
    }
  };

  const handleStartCameraShare = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        showToast('Câmera não suportada neste aparelho.');
        return;
      }
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: isMobile
          ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setCameraStream(stream);
      setIsCameraActive(true);
      liveRoom.publishStream(stream, 'camera', 'camera-local');
      const activeName = currentUserName || 'Você';
      if (!streamState.isSharing) {
        setStreamState({
          type: 'camera',
          stream,
          title: `Câmera de ${activeName}`,
          quality: '720p',
          isSharing: true,
          isPaused: false,
        });
      }
      addSystemMessage(`${activeName} ligou a câmera.`);
      showToast('Câmera ao vivo para a sala!');
    } catch {
      showToast('Permita a câmera no navegador para transmitir.');
    }
  };

  const handleToggleCamera = () => {
    if (isCameraActive) {
      if (cameraStream) {
        liveRoom.unpublishStream(cameraStream, 'camera-local');
        cameraStream.getTracks().forEach((t) => t.stop());
      }
      setCameraStream(null);
      setIsCameraActive(false);
      if (streamState.type === 'camera') handleStopSharing();
      addSystemMessage(`${currentUserName || 'Você'} desligou a câmera.`);
    } else {
      handleStartCameraShare();
    }
  };

  const handleStopSharing = () => {
    if (streamState.stream) {
      try {
        liveRoom.unpublishStream(streamState.stream, 'screen-local');
      } catch {}
      if (streamState.type === 'camera' && cameraStream) {
        try {
          liveRoom.unpublishStream(cameraStream, 'camera-local');
        } catch {}
      }
      try {
        streamState.stream.getTracks().forEach((t) => t.stop());
      } catch {}
    }
    if (isRecording) handleStopRecording();
    setStreamState({
      type: 'none',
      stream: null,
      videoUrl: undefined,
      title: 'Ninguém está transmitindo ainda.',
      quality: streamQuality,
      isSharing: false,
      isPaused: false,
    });
    addSystemMessage('A transmissão foi encerrada.');
  };

  const handleStartRecording = () => {
    if (isRecording) {
      handleStopRecording();
      return;
    }
    const currentStream = streamState.stream || cameraStream;
    if (!currentStream) {
      showToast('Ligue tela ou câmera antes de gravar.');
      return;
    }
    try {
      recordedChunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(currentStream, { mimeType: mime });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `livedc-${roomCode}-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        showToast('Gravação baixada!');
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime((p) => p + 1), 1000);
      showToast('Gravando...');
    } catch {
      showToast('Não foi possível gravar aqui.');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const handleSendMessage = (text: string, gifUrl?: string) => {
    const activeName = currentUserName || 'Você';
    const newMsg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      sender: activeName,
      avatar: userAvatar,
      text,
      mediaUrl: gifUrl,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      color: 'text-emerald-400',
    };
    setMessages((prev) => [...prev, newMsg]);
    liveRoom.sendChat(newMsg);
    setUserPoints((p) => p + 5);
  };

  const handleInvite = async () => {
    setIsShareModalOpen(true);
    const ok = await copyText(shareUrl);
    showToast(ok ? 'Link copiado! Mande + código no Zap.' : 'Copie o link na janela.');
  };

  return (
    <div className="flex flex-col h-[100dvh] w-screen overflow-hidden bg-[#0d0f12] text-gray-200 select-none">
      <NamePromptModal
        isOpen={isNameModalOpen}
        onJoin={handleUserJoin}
        invitedRoomCode={initialInviteCode}
      />
      <TopNoticeBanner />
      <HeaderBar
        roomName={streamerMode ? 'Sala_Oculta' : roomName}
        roomCode={streamerMode ? '******' : roomCode}
        isPrivate={isPrivate}
        isMuted={isMuted}
        onToggleMic={handleToggleMic}
        isDeafened={isDeafened}
        onToggleDeafen={handleToggleDeafen}
        isScreenSharing={streamState.isSharing}
        onToggleScreenShare={streamState.isSharing ? handleStopSharing : handleStartScreenShare}
        isCameraActive={isCameraActive}
        onToggleCamera={handleToggleCamera}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenYouTube={() => setIsYouTubeModalOpen(true)}
        onOpenMusic={() => setIsMusicModalOpen(true)}
        onDisconnect={() => {
          if (confirm('Sair da call?')) {
            handleStopSharing();
            window.location.href = window.location.pathname;
          }
        }}
        onShareRoom={() => setIsShareModalOpen(true)}
        onOpenProModal={() => setIsProModalOpen(true)}
        onOpenMenu={() => setIsSettingsModalOpen(true)}
      />

      {/* desktop: 3 colunas | mobile: 1 painel por vez */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {/* participantes */}
        <div
          className={`${
            mobileTab === 'participants' ? 'flex' : 'hidden'
          } md:flex md:w-72 shrink-0 h-full w-full absolute md:static z-20 md:z-auto bg-[#12151b]`}
        >
          <LeftSidebar
            participants={participants}
            onInvite={handleInvite}
            userPoints={userPoints}
            connectionStatus={connectionStatus}
            shareUrl={shareUrl}
          />
        </div>

        {/* vídeo */}
        <div
          className={`${
            mobileTab === 'video' ? 'flex' : 'hidden'
          } md:flex flex-1 min-w-0 h-full`}
        >
          <StreamView
            streamState={streamState}
            remoteStreams={remoteStreams}
            onStartScreenShare={handleStartScreenShare}
            onStartCameraShare={handleStartCameraShare}
            onOpenVideoSourceModal={() => setIsVideoSourceModalOpen(true)}
            onStopSharing={handleStopSharing}
            isCameraActive={isCameraActive}
            cameraStream={cameraStream}
            onRecordScreen={handleStartRecording}
            isRecording={isRecording}
            recordingTime={recordingTime}
          />
        </div>

        {/* chat */}
        <div
          className={`${
            mobileTab === 'chat' ? 'flex' : 'hidden'
          } md:flex md:w-80 shrink-0 h-full w-full absolute md:static right-0 z-20 md:z-auto bg-[#12151b]`}
        >
          <RightSidebar
            messages={messages}
            onSendMessage={handleSendMessage}
            userPoints={userPoints}
            streamerMode={streamerMode}
            onToggleStreamerMode={() => {
              setStreamerMode(!streamerMode);
              showToast(streamerMode ? 'Modo Streamer OFF' : 'Modo Streamer ON!');
            }}
            currentUserName={currentUserName || 'Você'}
            className="w-full"
          />
        </div>
      </div>

      {/* barra inferior mobile */}
      <nav className="md:hidden shrink-0 bg-[#14181f] border-t border-[#212734] px-2 py-1.5 flex items-center justify-around">
        <button
          onClick={() => setMobileTab('video')}
          className={`flex-1 py-2 rounded-lg flex flex-col items-center gap-0.5 text-[10px] font-bold touch-manipulation ${
            mobileTab === 'video' ? 'bg-emerald-500/20 text-emerald-300' : 'text-gray-400'
          }`}
        >
          <Video className="w-5 h-5" />
          Vídeo
        </button>
        <button
          onClick={() => setMobileTab('participants')}
          className={`flex-1 py-2 rounded-lg flex flex-col items-center gap-0.5 text-[10px] font-bold touch-manipulation relative ${
            mobileTab === 'participants' ? 'bg-emerald-500/20 text-emerald-300' : 'text-gray-400'
          }`}
        >
          <Users className="w-5 h-5" />
          Pessoas ({participants.length})
        </button>
        <button
          onClick={() => setMobileTab('chat')}
          className={`flex-1 py-2 rounded-lg flex flex-col items-center gap-0.5 text-[10px] font-bold touch-manipulation ${
            mobileTab === 'chat' ? 'bg-emerald-500/20 text-emerald-300' : 'text-gray-400'
          }`}
        >
          <MessageCircle className="w-5 h-5" />
          Chat
        </button>
      </nav>

      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-6 z-[90] bg-[#1e2738] text-white text-xs px-4 py-3 rounded-xl shadow-2xl border border-emerald-500/50 flex items-center gap-2.5 max-w-[92vw]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0"></span>
          <span className="break-words">{toastMessage}</span>
        </div>
      )}

      <ShareRoomModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        roomName={roomName}
        roomCode={roomCode}
        shareUrl={shareUrl}
        onRegenerateCode={handleRegenerateCode}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        streamQuality={streamQuality}
        onChangeQuality={(q) => setStreamQuality(q)}
        isMuted={isMuted}
        onToggleMute={handleToggleMic}
      />

      <VideoSourceModal
        isOpen={isVideoSourceModalOpen}
        onClose={() => setIsVideoSourceModalOpen(false)}
        onSelectVideoSource={(title, url, type) => {
          setStreamState({ type, stream: null, videoUrl: url, title, quality: streamQuality, isSharing: true, isPaused: false });
          addSystemMessage(`Prévia local: ${title}. Use Tela/Câmera para todos verem.`);
        }}
      />

      <YouTubeModal
        isOpen={isYouTubeModalOpen}
        onClose={() => setIsYouTubeModalOpen(false)}
        onStartWatchParty={(videoUrl, title) => {
          setStreamState({ type: 'youtube', stream: null, videoUrl, title, quality: '1080p HD', isSharing: true, isPaused: false });
          addSystemMessage(`Prévia local: ${title}. Compartilhe a tela p/ todos verem.`);
          liveRoom.sendChat({
            id: `${Date.now()}-yt`,
            sender: currentUserName,
            avatar: userAvatar,
            text: `▶ Assistindo: ${title}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            color: 'text-emerald-400',
          });
        }}
      />

      <MusicPlayerModal isOpen={isMusicModalOpen} onClose={() => setIsMusicModalOpen(false)} />
      <ProModal isOpen={isProModalOpen} onClose={() => setIsProModalOpen(false)} />
    </div>
  );
}

export default App;
