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
import { ManageRoomModal } from './components/ManageRoomModal';
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

  // Detecta se abriu por link de convite (tem ?room= na URL inicial) — lido UMA vez, na carga
  const [initialInviteCode] = useState<string | null>(() => getRoomCodeFromUrl());

  // roomCode só é DEFINIDO quando a pessoa confirma o nome (evita conectar em sala errada).
  // '' = ainda não entrou.
  const [roomCode, setRoomCode] = useState<string>('');
  // true quando a pessoa entrou numa sala existente (link OU código digitado) → não é dona
  const [joinedExisting, setJoinedExisting] = useState<boolean>(false);
  const [roomName] = useState('Time_do_Sky');
  const [isPrivate] = useState(true);

  useEffect(() => {
    if (roomCode) persistRoomCodeInUrl(roomCode);
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
  // 30fps padrão = sem delay; 60fps é opcional nas configurações
  const [streamQuality, setStreamQuality] = useState('1080p 30fps');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const [streamState, setStreamState] = useState<StreamState>({
    type: 'none',
    stream: null,
    title: 'Ninguém está transmitindo ainda.',
    quality: '1080p 30fps',
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

  const [exitReason, setExitReason] = useState<'kicked' | 'banned' | 'full' | null>(null);

  const handleBanned = useCallback(() => {
    setExitReason('banned');
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

  const handleRoomFull = useCallback(() => {
    setExitReason('full');
    setWasKicked(true);
  }, []);

  const liveRoom = useLiveRoom({
    roomCode,
    userName: currentUserName,
    userAvatar,
    enabled: !!currentUserName && !!roomCode && !wasKicked,
    isMuted,
    isSharing: profileSharing,
    isCameraOn: isCameraActive,
    isOwner: !joinedExisting && !!currentUserName,
    onRemoteChat: handleRemoteChat,
    onPeerJoinNotice: handlePeerJoinNotice,
    onPeerLeaveNotice: handlePeerLeaveNotice,
    onKicked: () => {
      setExitReason('kicked');
      handleKicked();
    },
    onBanned: handleBanned,
    onRoomFull: handleRoomFull,
    onMediaNotice: (text) => {
      addSystemMessage(text);
    },
  });

  const { sharedMedia, myPeerId, roomSettings, can } = liveRoom;
  const [isManageOpen, setIsManageOpen] = useState(false);

  // mostra aviso quando algo foi bloqueado pelas permissões
  const blockedToast = useCallback(
    (what: string) => {
      showToast(`O dono da sala desativou "${what}" para participantes.`);
    },
    [showToast]
  );

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
      if (!can('videoSource')) {
        blockedToast('adicionar uma fonte de vídeo');
        return;
      }
      if (sharedMedia && sharedMedia.controller === 'leader' && sharedMedia.leaderId !== myPeerId) {
        showToast(`Só ${sharedMedia.leaderName} pode controlar o BETA agora.`);
        return;
      }
      setBetaInitialPlatform(initial);
      setIsBetaOpen(true);
    },
    [currentUserName, sharedMedia, myPeerId, showToast, can, blockedToast]
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
    const admins = roomSettings.admins || [];
    const ownerSid = roomSettings.ownerSessionId;
    if (currentUserName) {
      const meAdmin = admins.includes(liveRoom.mySessionId);
      list.push({
        id: 'current-user',
        name: currentUserName,
        avatar: userAvatar,
        isOwner: !joinedExisting,
        isAdmin: meAdmin,
        isMuted,
        isSpeaking: !isMuted,
        isScreenSharing: profileSharing,
        isCameraOn: isCameraActive,
        tag: meAdmin && joinedExisting ? 'você • admin' : 'você',
      });
    }
    remotePeersList.forEach((p) => {
      const isRemoteOwner = !!p.sessionId && !!ownerSid && p.sessionId === ownerSid;
      const isRemoteAdmin = !!p.sessionId && admins.includes(p.sessionId);
      list.push({
        id: p.peerId,
        name: p.name,
        avatar: p.avatar || avatarForName(p.name === 'Conectando…' ? p.peerId : p.name),
        isGuest: true,
        isOwner: isRemoteOwner,
        isAdmin: isRemoteAdmin,
        isMuted: p.muted,
        isSpeaking: !p.muted,
        isScreenSharing: p.sharing,
        isCameraOn: p.cameraOn,
        tag:
          p.name === 'Conectando…'
            ? 'entrando'
            : isRemoteOwner
              ? 'dono'
              : isRemoteAdmin
                ? 'admin'
                : 'na call',
      });
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentUserName,
    userAvatar,
    isMuted,
    profileSharing,
    isCameraActive,
    remotePeersList,
    joinedExisting,
    roomSettings.admins,
    roomSettings.ownerSessionId,
    liveRoom.mySessionId,
  ]);

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
      if (!can('mic')) {
        blockedToast('ligar o microfone');
        return;
      }
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

  const handleUserJoin = (userName: string, chosenCode: string) => {
    // Regra: código digitado > código do link > sala nova.
    // O roomCode só é definido AQUI, então o hook conecta direto na sala certa.
    const typed = (chosenCode || '').trim();
    const enteredExisting = typed !== '';
    const finalCode = typed || initialInviteCode || generateRoomCode();

    setRoomCode(finalCode);
    setJoinedExisting(enteredExisting || !!initialInviteCode);
    setCurrentUserName(userName);
    setIsNameModalOpen(false);

    const cameFromLink = !!initialInviteCode && finalCode === initialInviteCode;
    const switchedRoom = !!initialInviteCode && finalCode !== initialInviteCode;

    setTimeout(() => {
      addSystemMessage(
        switchedRoom
          ? `${userName} entrou na call ${finalCode} pelo código (diferente do link).`
          : cameFromLink
            ? `${userName} entrou na call ${finalCode} pelo link.`
            : enteredExisting
              ? `${userName} entrou na call ${finalCode} pelo código.`
              : `${userName} criou a sala ${finalCode}. Copie o link para chamar amigos.`
      );
      showToast(
        enteredExisting || cameFromLink
          ? `Bem-vindo à call ${finalCode}, ${userName}!`
          : `Bem-vindo, ${userName}! Toque em Convidar para chamar.`
      );
    }, 300);
  };

  const handleStartScreenShare = async () => {
    if (!can('screen')) {
      blockedToast('compartilhar a tela');
      return;
    }
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
      const want60 = /60/.test(streamQuality);
      // 30fps em 4K/1080p reduz MUITO o delay (o encoder não aguenta 60fps em alta
      // resolução e começa a atrasar depois de alguns segundos). Quem quer 60 escolhe.
      const fps = want60 ? { ideal: 60, max: 60 } : { ideal: 30, max: 30 };
      // cursor: 'never' = não captura o mouse (evita "vários cursores" ao ver a própria
      // transmissão dentro da transmissão). Quem assiste vê a tela limpa.
      const cursorOpt = { cursor: 'never' as const, displaySurface: 'monitor' as const };
      const mediaStream: MediaStream = await nav.mediaDevices.getDisplayMedia({
        video: want4k
          ? {
              ...cursorOpt,
              width: { ideal: 3840, max: 3840 },
              height: { ideal: 2160, max: 2160 },
              frameRate: fps,
            }
          : want1080
            ? {
                ...cursorOpt,
                width: { ideal: 1920, max: 1920 },
                height: { ideal: 1080, max: 1080 },
                frameRate: fps,
              }
            : { ...cursorOpt, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          // áudio do sistema sem processamento = menos atraso
          sampleRate: 48000,
        },
        // evita capturar a própria aba (loop infinito de tela dentro de tela)
        selfBrowserSurface: 'exclude',
        surfaceSwitching: 'include',
        systemAudio: 'include',
        preferCurrentTab: false,
      } as any);
      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => handleStopSharing();
        // 'detail' = prioriza nitidez de texto/tela; o encoder mantém resolução
        try {
          if ('contentHint' in videoTrack) (videoTrack as any).contentHint = 'detail';
        } catch {}
        // força a resolução máxima que o monitor permitir (4K de verdade)
        try {
          if (want4k) {
            await videoTrack
              .applyConstraints({
                width: { ideal: 3840 },
                height: { ideal: 2160 },
                frameRate: fps,
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
      // registra a qualidade antes de publicar (o hook usa no tuning dos senders)
      try {
        liveRoom.boostSenders(streamQuality);
      } catch {}
      liveRoom.publishStream(mediaStream, 'screen', 'screen-local');
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
    if (!can('camera')) {
      blockedToast('ligar a câmera');
      return;
    }
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
    if (streamState.stream) {
      // despublica (isso já para as tracks + avisa a sala → some na hora pra todos)
      try {
        const key = streamState.type === 'camera' ? 'camera-local' : 'screen-local';
        liveRoom.unpublishStream(streamState.stream, key);
      } catch {}
      if (streamState.type === 'camera') {
        // a câmera era a transmissão principal → desliga o estado da câmera também
        setCameraStream(null);
        setIsCameraActive(false);
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

  /** Sai da call de verdade: fecha tela/câmera/mic, avisa a sala e volta ao início. */
  const handleLeaveCall = () => {
    try {
      if (isRecording) handleStopRecording();
    } catch {}
    // para minhas mídias locais
    try {
      streamState.stream?.getTracks().forEach((t) => t.stop());
    } catch {}
    try {
      cameraStream?.getTracks().forEach((t) => t.stop());
    } catch {}
    try {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}
    try {
      if (localBetaFileUrl) URL.revokeObjectURL(localBetaFileUrl);
    } catch {}
    // avisa todo mundo que saí (nome some da lista + transmissão fecha nos outros)
    try {
      liveRoom.leaveRoom();
    } catch {}
    // dá tempo do sinal sair antes de recarregar
    setTimeout(() => {
      window.location.href = window.location.pathname;
    }, 350);
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
            handleLeaveCall();
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
            isOwner={!joinedExisting && !!currentUserName}
            onKickParticipant={handleKickParticipant}
            onManageRoom={() => setIsManageOpen(true)}
            adminSessionIds={roomSettings.admins}
            sessionIdOf={(pid) => liveRoom.remotePeers[pid]?.sessionId}
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
            canChat={can('chat')}
            canGif={can('gifs')}
            canImage={can('images')}
            onBlocked={blockedToast}
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
              <span className="text-2xl">{exitReason === 'full' ? '🚪' : exitReason === 'banned' ? '⛔' : '🚫'}</span>
            </div>
            <h2 className="text-white font-bold text-base">
              {exitReason === 'full'
                ? 'Sala cheia'
                : exitReason === 'banned'
                  ? 'Você foi banido desta sala'
                  : 'Você foi desconectado da call'}
            </h2>
            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
              {exitReason === 'full'
                ? 'O dono definiu um limite de participantes e a sala já está lotada. Tente de novo mais tarde.'
                : exitReason === 'banned'
                  ? 'O dono da sala baniu você. Não é possível entrar de novo nesta sala.'
                  : 'O dono da sala removeu você. Peça um novo link para entrar de novo.'}
            </p>
            <button
              onClick={() => {
                window.location.href = window.location.pathname;
              }}
              className="mt-4 w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold touch-manipulation"
            >
              Voltar ao início
            </button>
          </div>
        </div>
      )}

      <ManageRoomModal
        isOpen={isManageOpen}
        onClose={() => setIsManageOpen(false)}
        settings={roomSettings}
        participants={participants}
        sessionIdOf={(pid) => liveRoom.remotePeers[pid]?.sessionId}
        onSetPermission={(key, value) => {
          liveRoom.setPermission(key, value);
          addSystemMessage(
            value
              ? `Dono liberou "${key}" para todos.`
              : `Dono desativou "${key}" — só dono e admins podem agora.`
          );
        }}
        onSetMaxParticipants={(max) => {
          liveRoom.setMaxParticipants(max);
          addSystemMessage(max > 0 ? `Limite da sala: ${max} pessoas.` : 'Limite da sala removido.');
        }}
        onToggleAdmin={(sid) => {
          const wasAdmin = roomSettings.admins.includes(sid);
          liveRoom.toggleAdmin(sid);
          const who = participants.find((p) => liveRoom.remotePeers[p.id]?.sessionId === sid)?.name || 'Alguém';
          addSystemMessage(wasAdmin ? `${who} não é mais administrador.` : `${who} agora é administrador.`);
          showToast(wasAdmin ? `${who} removido dos admins.` : `${who} virou admin!`);
        }}
        onBan={(pid, name) => {
          liveRoom.banPeer(pid, name);
          addSystemMessage(`${name} foi banido da sala.`);
          showToast(`${name} foi banido.`);
        }}
        onUnban={(sid) => {
          const who = roomSettings.banned.find((b) => b.sessionId === sid)?.name || 'Alguém';
          liveRoom.unbanSession(sid);
          addSystemMessage(`${who} foi desbanido.`);
        }}
      />

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
