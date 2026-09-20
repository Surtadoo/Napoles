import { useState, useRef, useEffect } from 'react';
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
import { AccessCodeModal } from './components/AccessCodeModal';
import { Participant, ChatMessage, StreamState } from './types';
import { initAntiInspectionAndProtection } from './utils/security';

export function App() {
  // Anti-inspection and code protection on start
  useEffect(() => {
    initAntiInspectionAndProtection();
  }, []);

  // Room State
  const [roomName] = useState('Time_do_Sky');
  const [roomCode, setRoomCode] = useState('489059');
  const [isPrivate] = useState(true);

  // User Name prompt modal
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [isNameModalOpen, setIsNameModalOpen] = useState(true);

  // Read URL params to allow shared entry with user name and access code
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedName = params.get('user') || params.get('nome');
    const invite = params.get('join');

    if (invite === 'livedc') {
      // Shared invite requires access code
      if (sharedName) {
        setSharedInviteName(sharedName.trim().substring(0, 20));
      }
      setIsAccessCodeOpen(true);
    } else if (sharedName) {
      // Direct user link without invite
      const cleanName = sharedName.trim().substring(0, 20);
      if (cleanName) {
        const userP: Participant = {
          id: 'current-user',
          name: cleanName,
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face',
          isOwner: true,
          isMuted: true,
          isSpeaking: false,
          isScreenSharing: false,
          tag: 'você',
        };
        setCurrentUserName(cleanName);
        setIsNameModalOpen(false);
        setParticipants([userP]);
        addSystemMessage(`${cleanName} entrou na sala privada.`);
        showToast(`Bem-vindo à sala, ${cleanName}!`);
      }
    }
  }, []);

  // Audio / Media Controls State
  const [isMuted, setIsMuted] = useState(true);
  const [isDeafened, setIsDeafened] = useState(false);
  const [streamQuality, setStreamQuality] = useState('1080p 60fps');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Stream State
  const [streamState, setStreamState] = useState<StreamState>({
    type: 'none',
    stream: null,
    title: 'Ninguém está transmitindo ainda.',
    quality: '1080p 60fps',
    isSharing: false,
    isPaused: false,
  });

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Participants State - starts empty until the user enters their name!
  const [participants, setParticipants] = useState<Participant[]>([]);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userPoints, setUserPoints] = useState(150);
  const [streamerMode, setStreamerMode] = useState(false);

  // Modals State
  const [isAccessCodeOpen, setIsAccessCodeOpen] = useState(false);
  const [sharedInviteName, setSharedInviteName] = useState('');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isVideoSourceModalOpen, setIsVideoSourceModalOpen] = useState(false);
  const [isYouTubeModalOpen, setIsYouTubeModalOpen] = useState(false);
  const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);
  const [isProModalOpen, setIsProModalOpen] = useState(false);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // When user enters their name
  const handleUserJoin = (userName: string) => {
    setCurrentUserName(userName);
    setIsNameModalOpen(false);

    // Add user as the primary participant
    const userParticipant: Participant = {
      id: 'current-user',
      name: userName,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face',
      isOwner: true,
      isMuted: true,
      isSpeaking: false,
      isScreenSharing: false,
      tag: 'você',
    };

    setParticipants([userParticipant]);
    addSystemMessage(`${userName} entrou na sala privada.`);
    showToast(`Bem-vindo à sala, ${userName}!`);
  };

  // Sync participant status
  useEffect(() => {
    setParticipants((prev) =>
      prev.map((p) => {
        if (p.id === 'current-user') {
          return {
            ...p,
            isMuted,
            isScreenSharing: streamState.isSharing,
            isCameraOn: isCameraActive,
          };
        }
        return p;
      })
    );
  }, [isMuted, streamState.isSharing, isCameraActive]);

  // Handle Screen Sharing
  const handleStartScreenShare = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        showToast('Iniciando demonstração de transmissão em alta definição!');
        startSampleStream('Gameplay RTX 1080p 60fps', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
        return;
      }

      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          frameRate: { ideal: 60, max: 60 },
        },
        audio: true,
      });

      // Handle user stopping screen share from browser chrome bar
      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          handleStopSharing();
        };
      }

      const activeName = currentUserName || 'Você';
      setStreamState({
        type: 'screen',
        stream: mediaStream,
        title: `Tela de ${activeName}`,
        quality: streamQuality,
        isSharing: true,
        isPaused: false,
      });

      addSystemMessage(`${activeName} começou a compartilhar a tela.`);
      showToast('Compartilhamento de tela ativo!');
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name !== 'NotAllowedError') {
        showToast('Ativando transmissão alternativa em alta definição!');
        startSampleStream('Gameplay RTX 1080p 60fps', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
      } else {
        showToast('Compartilhamento cancelado.');
      }
    }
  };

  // Handle Camera Sharing
  const handleStartCameraShare = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('Câmera não suportada neste dispositivo.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: !isMuted,
      });

      setCameraStream(stream);
      setIsCameraActive(true);

      const activeName = currentUserName || 'Você';
      if (!streamState.isSharing) {
        setStreamState({
          type: 'camera',
          stream: stream,
          title: `Câmera de ${activeName}`,
          quality: '720p 30fps',
          isSharing: true,
          isPaused: false,
        });
      }

      addSystemMessage(`${activeName} ligou a câmera.`);
      showToast('Câmera ativada com sucesso!');
    } catch {
      showToast('Permissão de câmera negada ou não disponível.');
    }
  };

  const handleToggleCamera = () => {
    if (isCameraActive) {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
      setCameraStream(null);
      setIsCameraActive(false);
      if (streamState.type === 'camera') {
        handleStopSharing();
      }
      addSystemMessage(`${currentUserName || 'Você'} desligou a câmera.`);
    } else {
      handleStartCameraShare();
    }
  };

  const startSampleStream = (title: string, videoUrl: string) => {
    setStreamState({
      type: 'sample',
      stream: null,
      videoUrl,
      title,
      quality: streamQuality,
      isSharing: true,
      isPaused: false,
    });
    addSystemMessage(`Transmitindo: ${title}`);
  };

  const handleStopSharing = () => {
    if (streamState.stream) {
      streamState.stream.getTracks().forEach((t) => t.stop());
    }
    if (isRecording) {
      handleStopRecording();
    }
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

  // Recording functionality
  const handleStartRecording = () => {
    if (isRecording) {
      handleStopRecording();
      return;
    }

    const currentStream = streamState.stream || cameraStream;

    if (!currentStream) {
      showToast('Inicie um compartilhamento de tela ou câmera antes de gravar.');
      return;
    }

    try {
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(currentStream, { mimeType: 'video/webm;codecs=vp9' });

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `livedc-gravacao-${roomName}-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        showToast('Gravação concluída e baixada com sucesso!');
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      showToast('Gravação iniciada com sucesso!');
    } catch {
      showToast('Não foi possível gravar esta fonte de vídeo.');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const addSystemMessage = (text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        sender: 'Sistema',
        avatar: '',
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isSystem: true,
      },
    ]);
  };

  // Chat message send
  const handleSendMessage = (text: string, gifUrl?: string) => {
    const activeName = currentUserName || 'Você';
    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: activeName,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face',
      text,
      mediaUrl: gifUrl,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      color: 'text-emerald-400',
    };

    setMessages((prev) => [...prev, newMsg]);
    setUserPoints((prev) => prev + 5);
  };

  const handleRefreshCode = () => {
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    setRoomCode(newCode);
    showToast('Código de acesso atualizado!');
  };

  const handleAccessGranted = (userName: string) => {
    setIsAccessCodeOpen(false);
    setCurrentUserName(userName);
    const userP: Participant = {
      id: 'shared-user',
      name: userName,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face',
      isMuted: true,
      isSpeaking: false,
      isScreenSharing: false,
      tag: 'via link',
      isGuest: true,
    };
    setParticipants((prev) => {
      const withoutGuest = prev.filter(p => p.id !== 'guest-shared');
      return [...withoutGuest, userP];
    });
    addSystemMessage(`${userName} entrou na sala via link compartilhado.`);
    showToast(`Bem-vindo à sala, ${userName}!`);
  };

  const handleAddParticipant = () => {
    const names = ['Pedro_Gamer', 'Larissa_FPS', 'CyberVitor', 'Ana_Play', 'Lucas_Live'];
    const chosenName = names[Math.floor(Math.random() * names.length)];
    const newP: Participant = {
      id: Date.now().toString(),
      name: chosenName,
      avatar: `https://images.unsplash.com/photo-${1535713875000 + Math.floor(Math.random() * 900)}?w=100&h=100&fit=crop&crop=face`,
      isMuted: false,
      isSpeaking: false,
      tag: 'convidado',
    };
    setParticipants((prev) => [...prev, newP]);
    addSystemMessage(`${chosenName} entrou na sala.`);
    showToast(`${chosenName} entrou na chamada.`);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0d0f12] text-gray-200 select-none">
      {/* Access Code modal for shared invite */}
      <AccessCodeModal
        isOpen={isAccessCodeOpen}
        onAccessGranted={handleAccessGranted}
        onClose={() => setIsAccessCodeOpen(false)}
        expectedCode={roomCode}
        userName={sharedInviteName}
      />

      {/* Name Input modal when joining */}
      <NamePromptModal
        isOpen={isNameModalOpen}
        onJoin={handleUserJoin}
      />

      {/* Top Banner Notice */}
      <TopNoticeBanner />

      {/* Main Header Bar */}
      <HeaderBar
        roomName={streamerMode ? 'Sala_Oculta' : roomName}
        roomCode={streamerMode ? '******' : roomCode}
        isPrivate={isPrivate}
        isMuted={isMuted}
        onToggleMic={() => setIsMuted(!isMuted)}
        isDeafened={isDeafened}
        onToggleDeafen={() => setIsDeafened(!isDeafened)}
        isScreenSharing={streamState.isSharing}
        onToggleScreenShare={
          streamState.isSharing ? handleStopSharing : handleStartScreenShare
        }
        isCameraActive={isCameraActive}
        onToggleCamera={handleToggleCamera}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenYouTube={() => setIsYouTubeModalOpen(true)}
        onOpenMusic={() => setIsMusicModalOpen(true)}
        onDisconnect={() => {
          if (confirm('Deseja realmente sair da sala privada?')) {
            handleStopSharing();
            window.location.reload();
          }
        }}
        onShareRoom={() => setIsShareModalOpen(true)}
        onOpenProModal={() => setIsProModalOpen(true)}
        onOpenMenu={() => setIsSettingsModalOpen(true)}
      />

      {/* Center 3-column layout */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {/* Left Sidebar: Participants list (sponsored box removed!) */}
        <LeftSidebar
          participants={participants}
          onAddParticipant={handleAddParticipant}
          userPoints={userPoints}
        />

        {/* Center: Stream Viewport */}
        <StreamView
          streamState={streamState}
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

        {/* Right Sidebar: Chat & Profile with custom name (notice removed!) */}
        <RightSidebar
          messages={messages}
          onSendMessage={handleSendMessage}
          userPoints={userPoints}
          streamerMode={streamerMode}
          onToggleStreamerMode={() => {
            setStreamerMode(!streamerMode);
            showToast(
              streamerMode
                ? 'Modo Streamer DESATIVADO'
                : 'Modo Streamer ATIVADO! Informações confidenciais ocultadas.'
            );
          }}
          currentUserName={currentUserName || 'Você'}
        />
      </div>

      {/* Floating Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1e2738] text-white text-xs px-4 py-3 rounded-xl shadow-2xl border border-emerald-500/50 flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modals */}
      <ShareRoomModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        roomName={roomName}
        roomCode={roomCode}
        userName={currentUserName || 'Você'}
        onRefreshCode={handleRefreshCode}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        streamQuality={streamQuality}
        onChangeQuality={(q) => setStreamQuality(q)}
        isMuted={isMuted}
        onToggleMute={() => setIsMuted(!isMuted)}
      />

      <VideoSourceModal
        isOpen={isVideoSourceModalOpen}
        onClose={() => setIsVideoSourceModalOpen(false)}
        onSelectVideoSource={(title, url, type) => {
          setStreamState({
            type,
            stream: null,
            videoUrl: url,
            title,
            quality: streamQuality,
            isSharing: true,
            isPaused: false,
          });
          addSystemMessage(`Transmitindo fonte externa: ${title}`);
        }}
      />

      <YouTubeModal
        isOpen={isYouTubeModalOpen}
        onClose={() => setIsYouTubeModalOpen(false)}
        onStartWatchParty={(videoUrl, title) => {
          setStreamState({
            type: 'youtube',
            stream: null,
            videoUrl,
            title,
            quality: '1080p HD',
            isSharing: true,
            isPaused: false,
          });
          addSystemMessage(`Assistindo juntos: ${title}`);
        }}
      />

      <MusicPlayerModal
        isOpen={isMusicModalOpen}
        onClose={() => setIsMusicModalOpen(false)}
      />

      <ProModal
        isOpen={isProModalOpen}
        onClose={() => setIsProModalOpen(false)}
      />
    </div>
  );
}

export default App;
