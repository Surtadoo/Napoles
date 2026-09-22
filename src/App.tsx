import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Video, Users, MessageCircle } from 'lucide-react';
import { HeaderBar } from './components/HeaderBar';
import { LeftSidebar } from './components/LeftSidebar';
import { StreamView } from './components/StreamView';
import { RightSidebar } from './components/RightSidebar';
import { ShareRoomModal } from './components/ShareRoomModal';
import { SettingsModal } from './components/SettingsModal';
import { BetaMediaModal, BetaMediaInput } from './components/BetaMediaModal';
import { MobileScreenShareModal } from './components/MobileScreenShareModal';
import { MusicPlayerModal } from './components/MusicPlayerModal';
import { ProModal } from './components/ProModal';
import { NamePromptModal } from './components/NamePromptModal';
import { Participant, ChatMessage, StreamState, SharedMediaPayload } from './types';
import { MediaPlatform, platformLabel } from './utils/media';
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
  const [isBetaOpen, setIsBetaOpen] = useState(false);
  const [betaInitialPlatform, setBetaInitialPlatform] = useState<MediaPlatform>('youtube');
  const [isMobileShareOpen, setIsMobileShareOpen] = useState(false);
  const [localBetaFileUrl, setLocalBetaFileUrl] = useState<string | null>(null);
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

  const [wasKicked, setWasKicked] = useState(false);

  const handleKicked = useCallback(() => {
    setWasKicked(true);
    try {
      streamState.stream?.getTracks().forEach((t) => t.stop());
    } catch {}
    try {
      cameraStream?.getTracks().forEach((t) => t.stop());
    } catch {}
    try {
      micStreamRef.current?.getAudioTracks().forEach((t) => t.stop());
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamState.stream, cameraStream]);

  const profileSharing =
    streamState.isSharing && (streamState.type === 'screen' || streamState.type === 'camera');

  const liveRoom = useLiveRoom({
    roomCode,
    userName: currentUserName,
    userAvatar,
    enabled: !!currentUserName && !wasKicked,
    isMuted,
    isSharing: profileSharing,
    isCameraOn: isCameraActive,
    onRemoteChat: handleRemoteChat,
    onPeerJoinNotice: handlePeerJoinNotice,
    onPeerLeaveNotice: handlePeerLeaveNotice,
    onKicked: handleKicked,
    onMediaNotice: (text) => {
      addSystemMessage(text);
    },
    onQualityChanged: ({ label }) => {
      // a rede não aguentou: o app reduz sozinho pra manter a transmissão fluida
      showToast(`Conexão instável — ajustei para ${label} para acabar com o atraso.`);
      setStreamQuality((prev) => (/2160|4k/i.test(prev) ? '1080p 60fps' : prev));
    },
  });

  const { sharedMedia, myPeerId } = liveRoom;

  const isMobileDevice = useMemo(
    () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || ''),
    []
  );

  // quem pode mexer no BETA agora?
  const canControlBeta = useMemo(() => {
    if (!sharedMedia) return true;
    if (sharedMedia.controller === 'any') return true;
    return sharedMedia.leaderId === myPeerId;
  }, [sharedMedia, myPeerId]);

  const openBeta = useCallback(
    (initial: MediaPlatform = 'youtube') => {
      if (!currentUserName) {
        showToast('Entre na call primeiro.');
        return;
      }
      if (sharedMedia && sharedMedia.controller === 'leader' && sharedMedia.leaderId !== myPeerId) {
        showToast(`Só ${sharedMedia.leaderName} pode controlar o BETA agora.`);
        return;
      }
      setBetaInitialPlatform(initial);
      setIsBetaOpen(true);
    },
    [currentUserName, sharedMedia, myPeerId, showToast]
  );

  const handleAddBeta = useCallback(
    (input: BetaMediaInput) => {
      if (localBetaFileUrl) {
        try {
          URL.revokeObjectURL(localBetaFileUrl);
        } catch {}
        setLocalBetaFileUrl(null);
      }
      if (input.objectUrl) setLocalBetaFileUrl(input.objectUrl);
      const media: SharedMediaPayload = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        platform: input.platform,
        rawUrl: input.rawUrl,
        embedUrl: input.embedUrl,
        title: input.title,
        controller: input.controller,
        leaderId: myPeerId,
        leaderName: currentUserName || 'Você',
        createdAt: Date.now(),
        fileName: input.fileName,
        localOnly: input.localOnly,
      };
      liveRoom.broadcastMedia(media);
      addSystemMessage(
        `${currentUserName} adicionou ${input.title} (${platformLabel(input.platform)}) — todos veem igual à tela.` +
          (input.controller === 'leader'
            ? ' Só ele controla o BETA.'
            : ' Qualquer um pode controlar o BETA.')
      );
      showToast(
        input.controller === 'leader'
          ? 'Vídeo no ar! Só você controla o BETA.'
          : 'Vídeo no ar! Todos podem controlar o BETA.'
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [localBetaFileUrl, myPeerId, currentUserName, addSystemMessage, showToast]
  );

  const handleCloseSharedVideo = useCallback(() => {
    if (sharedMedia && sharedMedia.controller === 'leader' && sharedMedia.leaderId !== myPeerId) {
      showToast(`Só ${sharedMedia.leaderName} pode encerrar este vídeo.`);
      return;
    }
    if (localBetaFileUrl) {
      try {
        URL.revokeObjectURL(localBetaFileUrl);
      } catch {}
      setLocalBetaFileUrl(null);
    }
    liveRoom.clearMedia(currentUserName || 'Você');
    addSystemMessage('Vídeo BETA encerrado.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedMedia, myPeerId, localBetaFileUrl, currentUserName, addSystemMessage, showToast]);

  // expulsa pessoa da call (dono da sala)
  const handleKickParticipant = useCallback(
    (peerId: string, name: string) => {
      liveRoom.kickPeer(peerId, name);
      addSystemMessage(`${name} foi desconectado da call.`);
      showToast(`${name} foi removido da call.`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addSystemMessage, showToast, liveRoom.kickPeer]
  );

  const { remotePeersList, remoteStreams, connectionStatus } = liveRoom;

  // se trocar a qualidade no meio da transmissão, reaplica na trilha + bitrate
  useEffect(() => {
    if (!streamState.isSharing || !streamState.stream) return;
    const track = streamState.stream.getVideoTracks()[0];
    if (!track) return;
    const want4k = /4k|2160/i.test(streamQuality);
    (async () => {
      try {
        if (want4k) {
          await track
            .applyConstraints({
              width: { ideal: 3840 },
              height: { ideal: 2160 },
              frameRate: { ideal: 60 },
            } as any)
            .catch(() => {});
        } else if (/1080/i.test(streamQuality)) {
          await track
            .applyConstraints({
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              frameRate: { ideal: 60 },
            } as any)
            .catch(() => {});
        }
      } catch {}
      try {
        liveRoom.boostSenders(streamQuality);
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamQuality]);

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
    try {
      liveRoom.clearMedia(currentUserName || 'Você');
    } catch {}
    if (localBetaFileUrl) {
      try {
        URL.revokeObjectURL(localBetaFileUrl);
      } catch {}
      setLocalBetaFileUrl(null);
    }
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

  const handleUserJoin = (userName: string, enteredCode?: string) => {
    const wanted = (enteredCode || '').trim();
    let targetRoom = roomCode;
    let trocouDeSala = false;

    if (wanted && wanted !== roomCode) {
      // entra na call dona do código digitado (mesmo vindo de outro link)
      targetRoom = wanted;
      trocouDeSala = true;
      setRoomCode(wanted);
      setMessages([]);
      try {
        streamState.stream?.getTracks().forEach((t) => t.stop());
      } catch {}
      liveRoom.clearMedia(userName);
      setStreamState({
        type: 'none',
        stream: null,
        videoUrl: undefined,
        title: 'Ninguém está transmitindo ainda.',
        quality: streamQuality,
        isSharing: false,
        isPaused: false,
      });
    }

    setCurrentUserName(userName);
    setIsNameModalOpen(false);

    setTimeout(() => {
      if (trocouDeSala) {
        addSystemMessage(`${userName} entrou na call ${targetRoom} usando o código.`);
        showToast(`Você entrou na call ${targetRoom}!`);
      } else {
        addSystemMessage(
          initialInviteCode
            ? `${userName} entrou na call ${targetRoom} pelo link.`
            : `${userName} criou a sala ${targetRoom}. Copie o link para chamar amigos.`
        );
        showToast(
          initialInviteCode
            ? `Bem-vindo à call, ${userName}!`
            : `Bem-vindo, ${userName}! Toque em Convidar para chamar.`
        );
      }
    }, 300);
  };

  const handleStartScreenShare = async () => {
    // no celular abre o menu com as opções que funcionam (tela/câmera traseira/arquivo)
    if (isMobileDevice && !streamState.isSharing) {
      setIsMobileShareOpen(true);
      return;
    }
    await attemptNativeScreenShare();
  };

  const attemptNativeScreenShare = async () => {
    setIsMobileShareOpen(false);
    try {
      const nav: any = navigator;
      const getDisplay =
        nav?.mediaDevices?.getDisplayMedia?.bind(nav.mediaDevices) ||
        (nav as any)?.getDisplayMedia?.bind(nav);
      if (!getDisplay) {
        // sem API de tela: oferece câmera traseira no celular
        if (isMobileDevice) {
          setIsMobileShareOpen(true);
          return;
        }
        showToast('Este navegador não permite compartilhar a tela. Use a Câmera.');
        return;
      }
      const want4k = /4k|2160/i.test(streamQuality);
      const want1080 = /1080/i.test(streamQuality);
      const mediaStream: MediaStream = await nav.mediaDevices.getDisplayMedia({
        video: want4k
          ? {
              width: { ideal: 3840, max: 3840 },
              height: { ideal: 2160, max: 2160 },
              frameRate: { ideal: 60, max: 60 },
            }
          : want1080
            ? {
                width: { ideal: 1920, max: 1920 },
                height: { ideal: 1080, max: 1080 },
                frameRate: { ideal: 60, max: 60 },
              }
            : { frameRate: { ideal: 30, max: 30 } },
        audio: true,
      });
      const videoTrack = mediaStream.getVideoTracks()[0];
      // força a resolução máxima que o monitor permitir (4K de verdade)
      if (videoTrack) {
        videoTrack.onended = () => handleStopSharing();
        try {
          if (want4k) {
            await videoTrack
              .applyConstraints({
                width: { ideal: 3840 },
                height: { ideal: 2160 },
                frameRate: { ideal: 60 },
              } as any)
              .catch(() => {});
          }
        } catch {}
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
      liveRoom.publishStream(mediaStream, 'screen', 'screen-local');
      // bitrate alto p/ manter a qualidade escolhida (senão o WebRTC derruba p/ 1080p)
      setTimeout(() => {
        try {
          liveRoom.boostSenders(streamQuality);
        } catch {}
        try {
          liveRoom.boostSenders(streamQuality);
        } catch {}
      }, 1200);
      setTimeout(() => {
        try {
          liveRoom.boostSenders(streamQuality);
        } catch {}
      }, 3500);
      const track = mediaStream.getVideoTracks()[0];
      const set = track?.getSettings?.();
      const realRes = set?.width && set?.height ? ` (${set.width}×${set.height})` : '';
      addSystemMessage(`${activeName} compartilha a tela${realRes} — todos veem ao vivo.`);
      if (want4k && set?.width && set.width < 3000) {
        showToast(
          `Atenção: seu monitor é ${set.width}×${set.height}, então o navegador não consegue capturar 4K real. Subi o bitrate ao máximo para a melhor imagem possível${realRes}.`
        );
      } else {
        showToast(
          want4k
            ? `Tela em 4K ao vivo${realRes}! Todos na sala veem.`
            : 'Tela ao vivo! Todos na sala veem.'
        );
      }
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

  /** Câmera traseira do celular valendo como "tela" — todos veem grande. */
  const handleRearCameraShare = async () => {
    setIsMobileShareOpen(false);
    if (streamState.isSharing) {
      showToast('Pare a transmissão atual antes de trocar.');
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        showToast('Câmera não suportada neste aparelho.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      });
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) videoTrack.onended = () => handleStopSharing();
      const activeName = currentUserName || 'Você';
      setStreamState({
        type: 'screen',
        stream,
        title: `Câmera traseira de ${activeName}`,
        quality: streamQuality,
        isSharing: true,
        isPaused: false,
      });
      liveRoom.publishStream(stream, 'screen', 'screen-local');
      addSystemMessage(`${activeName} compartilha a câmera traseira — todos veem ao vivo.`);
      showToast('Câmera traseira ao vivo! Todos veem.');
    } catch {
      showToast('Permita a câmera para transmitir a traseira.');
    }
  };

  const handleMobileOpenFile = () => {
    setIsMobileShareOpen(false);
    openBeta('file');
  };

  const handleStopSharing = () => {
    // fecha a transmissão na hora: some da sua tela e da tela de todos
    const ativo = streamState.stream;
    if (ativo) {
      // unpublish já encerra as trilhas e avisa a sala (kind: stop)
      try {
        liveRoom.unpublishStream(ativo, 'screen-local');
      } catch {}
      if (streamState.type === 'camera' && cameraStream) {
        try {
          liveRoom.unpublishStream(cameraStream, 'camera-local');
        } catch {}
      }
      try {
        ativo.getTracks().forEach((t) => {
          t.onended = null;
          t.stop();
        });
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
        onOpenYouTube={() => openBeta('youtube')}
        onOpenMusic={() => setIsMusicModalOpen(true)}
        onDisconnect={() => {
          if (confirm('Sair da call?')) {
            // para a transmissão e avisa a sala: nome + tela saem na hora
            handleStopSharing();
            try {
              liveRoom.announceLeave();
            } catch {}
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
            isOwner={!initialInviteCode && !!currentUserName}
            onKickParticipant={handleKickParticipant}
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
            onOpenVideoSourceModal={() => openBeta('youtube')}
            onStopSharing={handleStopSharing}
            isCameraActive={isCameraActive}
            cameraStream={cameraStream}
            onRecordScreen={handleStartRecording}
            isRecording={isRecording}
            recordingTime={recordingTime}
            sharedVideo={sharedMedia}
            sharedFileUrl={localBetaFileUrl}
            canControlSharedVideo={canControlBeta}
            onCloseSharedVideo={handleCloseSharedVideo}
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

      {toastMessage && !wasKicked && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-6 z-[90] bg-[#1e2738] text-white text-xs px-4 py-3 rounded-xl shadow-2xl border border-emerald-500/50 flex items-center gap-2.5 max-w-[92vw]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0"></span>
          <span className="break-words">{toastMessage}</span>
        </div>
      )}

      {wasKicked && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141822] border border-red-500/40 rounded-2xl w-full max-w-sm p-6 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-red-500/15 border border-red-500/40 flex items-center justify-center mb-3">
              <span className="text-2xl">🚫</span>
            </div>
            <h2 className="text-white font-bold text-base">Você foi desconectado da call</h2>
            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
              O dono da sala removeu você. Peça um novo link para entrar de novo.
            </p>
            <button
              onClick={() => {
                try {
                  liveRoom.announceLeave();
                } catch {}
                window.location.href = window.location.pathname;
              }}
              className="mt-4 w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold touch-manipulation"
            >
              Voltar ao início
            </button>
          </div>
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

      <BetaMediaModal
        isOpen={isBetaOpen}
        onClose={() => setIsBetaOpen(false)}
        onAdd={handleAddBeta}
        initialPlatform={betaInitialPlatform}
      />

      <MobileScreenShareModal
        isOpen={isMobileShareOpen}
        onClose={() => setIsMobileShareOpen(false)}
        onNativeScreen={() => attemptNativeScreenShare()}
        onRearCamera={() => handleRearCameraShare()}
        onOpenFile={() => handleMobileOpenFile()}
      />

      <MusicPlayerModal isOpen={isMusicModalOpen} onClose={() => setIsMusicModalOpen(false)} />
      <ProModal isOpen={isProModalOpen} onClose={() => setIsProModalOpen(false)} />
    </div>
  );
}

export default App;
