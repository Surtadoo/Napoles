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
import { LobbyScreen, type CreateRoomInput } from './components/LobbyScreen';
import {
  loadRecentRooms,
  saveRecentRoom,
  removeRecentRoom,
  loadGroups,
  loadPublicRooms,
  loadPrivateRooms,
  savePublicRoom,
  findSavedRoom,
  syncFromBundledFile,
  updateRoomLocation,
  type RecentRoom,
  type LobbyGroup,
} from './utils/lobby';
import { locateMe, prefetchLocation } from './utils/geo';
import { useRoomDirectory } from './hooks/useRoomDirectory';
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
  getRoomMetaFromUrl,
  hashPassword,
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
  // tipo/nome/senha(hash) da sala que veio no link
  const [inviteMeta] = useState(() => getRoomMetaFromUrl());

  // roomCode só é DEFINIDO quando a pessoa entra numa sala (evita conectar em sala errada).
  // '' = ainda não entrou.
  const [roomCode, setRoomCode] = useState<string>('');
  // true quando a pessoa entrou numa sala existente (link OU código digitado) → não é dona
  const [joinedExisting, setJoinedExisting] = useState<boolean>(false);
  const [roomName, setRoomName] = useState('Time_do_Sky');
  const [isPrivate, setIsPrivate] = useState(true);
  const [roomPassword, setRoomPassword] = useState('');

  // Lobby (aparece depois do nome, quando NÃO veio por link)
  const [isLobbyOpen, setIsLobbyOpen] = useState(false);
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>(() => loadRecentRooms());
  const [publicRooms, setPublicRooms] = useState<RecentRoom[]>(() => loadPublicRooms());
  const [privateRooms, setPrivateRooms] = useState<RecentRoom[]>(() => loadPrivateRooms());
  const [groups, setGroups] = useState<LobbyGroup[]>(() => loadGroups());

  /** recarrega todas as listas a partir do arquivo de salas */
  const refreshRoomLists = useCallback(() => {
    setRecentRooms(loadRecentRooms());
    setPublicRooms(loadPublicRooms());
    setPrivateRooms(loadPrivateRooms());
    setGroups(loadGroups());
  }, []);

  // DIRETÓRIO GLOBAL (P2P): todo navegador aberto troca a lista de salas públicas/privadas.
  // É assim que as salas de uma pessoa aparecem pras outras sem precisar de servidor.
  const roomDirectory = useRoomDirectory({
    enabled: true,
    onUpdated: refreshRoomLists,
  });

  // Ao abrir o site: puxa o livedc-rooms.json publicado junto e mescla com o local.
  // Assim, levando o site pra outro lugar, as salas/grupos já vêm salvos.
  useEffect(() => {
    let alive = true;
    syncFromBundledFile()
      .then(() => {
        if (alive) refreshRoomLists();
      })
      .catch(() => {});
    // já descobre a localização por IP em segundo plano (sem pedir permissão),
    // pra que ao criar a sala o ponto no mapa saia na hora no lugar certo
    prefetchLocation();
    return () => {
      alive = false;
    };
  }, [refreshRoomLists]);

  /**
   * Marca a sala no mapa com a localização REAL de quem criou.
   * 1) IP (cidade certa, instantâneo) → salva já.
   * 2) GPS em paralelo (mais preciso, pede permissão) → se vier, refina o ponto.
   */
  const tagRoomWithMyLocation = useCallback(
    (code: string) => {
      locateMe()
        .then((p) => {
          if (!p) return;
          updateRoomLocation(code, p.lat, p.lng, p.place);
          refreshRoomLists();
          roomDirectory.publishNow(); // espalha a posição pros outros
        })
        .catch(() => {});
      locateMe({ preferGps: true })
        .then((p) => {
          if (!p || p.source !== 'gps') return;
          updateRoomLocation(code, p.lat, p.lng, p.place);
          refreshRoomLists();
          roomDirectory.publishNow();
        })
        .catch(() => {});
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshRoomLists, roomDirectory.publishNow]
  );

  const roomMeta = useMemo(
    () => ({
      type: (isPrivate ? 'private' : 'public') as 'public' | 'private',
      name: roomName,
      password: roomPassword,
    }),
    [isPrivate, roomName, roomPassword]
  );

  useEffect(() => {
    if (roomCode) persistRoomCodeInUrl(roomCode, roomMeta);
  }, [roomCode, roomMeta]);

  // link leva: código + tipo + nome + hash da senha (privada) → quem abre já sabe o que pedir
  const shareUrl = useMemo(() => buildShareUrl(roomCode, roomMeta), [roomCode, roomMeta]);

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

  const { sharedMedia, myPeerId, roomSettings, can, amAdmin, canBan, canKick, myCaps, myAdminLevel } =
    liveRoom;
  const isRoomOwner = !joinedExisting && !!currentUserName;

  // se eu perder o admin com o painel aberto, fecha o painel e avisa
  const wasAdminRef = useRef(false);
  useEffect(() => {
    const nowAdmin = isRoomOwner || amAdmin;
    if (wasAdminRef.current && !nowAdmin) {
      setIsManageOpen(false);
      showToast('Você não é mais administrador da sala.');
    } else if (!wasAdminRef.current && nowAdmin && !isRoomOwner) {
      showToast('Você virou administrador! Agora tem o botão "Gerenciar sala".');
    }
    wasAdminRef.current = nowAdmin;
  }, [isRoomOwner, amAdmin, showToast]);
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

  // expulsa pessoa da call (dono sempre; admin só com a permissão "desconectar" ligada)
  const handleKickParticipant = useCallback(
    (peerId: string, name: string) => {
      if (!isRoomOwner && !canKick) {
        showToast('O dono não liberou "desconectar pessoas" para administradores.');
        return;
      }
      liveRoom.kickAsAdmin(peerId, name);
      addSystemMessage(`${name} foi desconectado da call.`);
      showToast(`${name} foi removido da call.`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addSystemMessage, showToast, liveRoom.kickAsAdmin, isRoomOwner, canKick]
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
        tag: meAdmin && joinedExisting ? `você • adm lv${myAdminLevel}` : 'você',
      });
    }
    remotePeersList.forEach((p) => {
      const isRemoteOwner = !!p.sessionId && !!ownerSid && p.sessionId === ownerSid;
      const isRemoteAdmin = !!p.sessionId && admins.includes(p.sessionId);
      const remoteLv = (p.sessionId && roomSettings.adminLevels?.[p.sessionId]) || 1;
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
                ? `adm lv${remoteLv}`
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
    roomSettings.adminLevels,
    myAdminLevel,
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

  /** Entra de fato numa sala (conecta o P2P). Usado pelo link, código e lobby. */
  const enterRoom = (
    userName: string,
    code: string,
    opts: {
      name?: string;
      type?: 'public' | 'private';
      password?: string;
      visible?: boolean;
      asOwner: boolean;
      via: 'link' | 'code' | 'create' | 'lobby';
    }
  ) => {
    const label = opts.name || `Sala ${code}`;
    const type: 'public' | 'private' = opts.type || 'private';
    setRoomName(label);
    setIsPrivate(type !== 'public');
    setRoomPassword(opts.password || '');
    setRoomCode(code);
    setJoinedExisting(!opts.asOwner);
    setCurrentUserName(userName);
    setIsNameModalOpen(false);
    setIsLobbyOpen(false);

    // Salva no arquivo de salas.
    // - Criei (dono): entra em "Salas recentes" e nas listas pública/privada + mapa (se visível).
    // - Só entrei: fica no arquivo (aparece na lista pública/privada e no mapa), mas não em "recentes".
    const existing = findSavedRoom(code);
    if (opts.asOwner) {
      saveRecentRoom({
        name: label,
        code,
        type,
        password: opts.password || '',
        // hash viaja pro diretório (a senha em si nunca sai deste navegador)
        pwHash: type === 'private' && opts.password ? hashPassword(opts.password) : undefined,
        visible: opts.visible !== false,
        createdByMe: true,
        createdBy: userName,
      });
      if (type === 'public' && opts.visible !== false) savePublicRoom({ name: label, code });
      // ponto no mapa = localização real do criador (só na criação; ao reentrar mantém)
      if (opts.via === 'create' || !(typeof existing?.lat === 'number' && typeof existing?.lng === 'number')) {
        tagRoomWithMyLocation(code);
      }
    } else if (!existing) {
      saveRecentRoom({
        name: label,
        code,
        type,
        // só guardo a senha se eu digitei uma válida (facilita reentrar)
        password: type === 'private' && opts.password ? opts.password : undefined,
        visible: true,
        createdByMe: false,
      });
    } else if (type === 'private' && opts.password && !existing.password) {
      saveRecentRoom({ ...existing, password: opts.password });
    }
    refreshRoomLists();
    // sala nova/alterada → manda pro diretório agora (todo mundo online recebe)
    roomDirectory.publishNow();

    setTimeout(() => {
      addSystemMessage(
        opts.via === 'link'
          ? `${userName} entrou na call ${code} pelo link.`
          : opts.via === 'code'
            ? `${userName} entrou na call ${code} pelo código.`
            : opts.via === 'create'
              ? `${userName} criou a sala "${label}" (${code}) ${type === 'private' ? '🔒 privada' : '🌐 pública'}. Copie o link para chamar amigos.`
              : `${userName} entrou em "${label}" (${code}).`
      );
      showToast(
        opts.via === 'create'
          ? `Sala "${label}" criada! Toque em Convidar para chamar.`
          : `Bem-vindo à call ${code}, ${userName}!`
      );
    }, 300);
  };

  const handleUserJoin = (userName: string, password: string) => {
    // veio por link → entra direto na sala do link (senha já foi validada no modal)
    if (initialInviteCode) {
      enterRoom(userName, initialInviteCode, {
        name: inviteMeta.name || undefined,
        type: inviteMeta.type,
        password: password || '',
        asOwner: false,
        via: 'link',
      });
      return;
    }
    // sem link → mostra o LOBBY (grupos, recentes, criar sala)
    setCurrentUserName(userName);
    setIsNameModalOpen(false);
    setIsLobbyOpen(true);
  };

  const handleLobbyCreate = (input: CreateRoomInput) => {
    enterRoom(currentUserName, input.code, {
      name: input.name,
      type: input.type,
      password: input.password,
      visible: input.visible,
      asOwner: true,
      via: 'create',
    });
  };

  const handleLobbyJoin = (code: string, name?: string, password?: string) => {
    // se for uma sala que EU criei, reentro como dono (com a senha/tipo salvos)
    const saved = findSavedRoom(code);
    if (saved?.createdByMe) {
      enterRoom(currentUserName, code, {
        name: saved.name,
        type: saved.type,
        password: saved.password || '',
        visible: saved.visible !== false,
        asOwner: true,
        via: 'lobby',
      });
      return;
    }
    enterRoom(currentUserName, code, {
      name: name || saved?.name,
      type: saved?.type || (password ? 'private' : undefined),
      password: password || saved?.password || '',
      asOwner: false,
      via: 'lobby',
    });
  };

  const handleRemoveRecent = (code: string) => {
    removeRecentRoom(code);
    refreshRoomLists();
  };



  /** O celular tem a API de captura de tela? (iPhone/Safari: não) */
  const mobileHasScreenCapture = () => {
    const nav: any = navigator;
    return !!(nav?.mediaDevices?.getDisplayMedia || nav?.getDisplayMedia);
  };

  const handleStartScreenShare = async () => {
    if (!can('screen')) {
      blockedToast('compartilhar a tela');
      return;
    }
    // Captura de tela/câmera SÓ funciona em HTTPS (ou localhost). Em HTTP o navegador
    // simplesmente não expõe a API — e o botão "não faz nada". Avisa em vez de falhar mudo.
    if (!window.isSecureContext) {
      showToast('Abra o site em HTTPS (https://…) — em HTTP o navegador bloqueia a captura de tela.');
      return;
    }
    // CELULAR: a captura de tela SÓ funciona se for chamada DIRETO no toque do usuário.
    // Abrir um menu antes quebra o "gesto" e o Android ignora sem erro nenhum.
    // Então: tem API → chama AGORA; não tem (iPhone) → aí sim mostra as alternativas.
    if (isMobileDevice && !streamState.isSharing) {
      if (mobileHasScreenCapture()) {
        await attemptNativeScreenShare();
      } else {
        setIsMobileShareOpen(true);
      }
      return;
    }
    await attemptNativeScreenShare();
  };

  const attemptNativeScreenShare = async () => {
    // NÃO mexe em estado antes de chamar a API (re-render atrasa e perde o gesto)
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

      let mediaStream: MediaStream;

      if (isMobileDevice) {
        // CELULAR (Android Chrome/Samsung/Edge/Firefox):
        // - chamada tem que ser síncrona com o toque (já garantido em handleStartScreenShare)
        // - `video: true` puro é o que o Android aceita com mais certeza
        // - o Android exibe "Iniciar agora" / "Compartilhar tela inteira"
        mediaStream = await nav.mediaDevices.getDisplayMedia({ video: true, audio: false });
      } else {
        // DESKTOP: qualidade alta + sem cursor + exclui a própria aba + áudio do sistema
        const cursorOpt = { cursor: 'never' as const, displaySurface: 'monitor' as const };
        const desktopOpts: any = {
          video: want4k
            ? { ...cursorOpt, width: { ideal: 3840, max: 3840 }, height: { ideal: 2160, max: 2160 }, frameRate: fps }
            : want1080
              ? { ...cursorOpt, width: { ideal: 1920, max: 1920 }, height: { ideal: 1080, max: 1080 }, frameRate: fps }
              : { ...cursorOpt, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: 48000,
          },
          selfBrowserSurface: 'exclude',
          surfaceSwitching: 'include',
          systemAudio: 'include',
          preferCurrentTab: false,
        };
        try {
          mediaStream = await nav.mediaDevices.getDisplayMedia(desktopOpts);
        } catch (e1: any) {
          if (e1?.name === 'NotAllowedError' || e1?.name === 'AbortError') throw e1;
          // navegador antigo (Firefox/Safari) não aceita as opções extras → tenta simples
          mediaStream = await nav.mediaDevices.getDisplayMedia({ video: true, audio: true });
        }
      }
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
      // captura começou → agora sim pode fechar o menu do celular (se estava aberto)
      setIsMobileShareOpen(false);
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
      if (error?.name === 'NotAllowedError' || error?.name === 'AbortError') {
        showToast('Compartilhamento cancelado.');
      } else if (isMobileDevice) {
        // iPhone/Safari não tem captura de tela via navegador (limite da Apple)
        const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        showToast(
          isIOS
            ? 'O iPhone não deixa capturar a tela pelo navegador (limite da Apple). Use a Câmera traseira.'
            : 'Seu navegador não conseguiu capturar a tela. Use o Chrome atualizado ou a Câmera traseira.'
        );
        setIsMobileShareOpen(true);
      } else {
        showToast('Não foi possível compartilhar a tela aqui. Tente a câmera.');
      }
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

  /** Fecha minhas mídias + avisa a sala que saí. */
  const teardownCall = () => {
    try {
      if (isRecording) handleStopRecording();
    } catch {}
    try {
      streamState.stream?.getTracks().forEach((t) => t.stop());
    } catch {}
    try {
      cameraStream?.getTracks().forEach((t) => t.stop());
    } catch {}
    try {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    } catch {}
    try {
      if (localBetaFileUrl) URL.revokeObjectURL(localBetaFileUrl);
    } catch {}
    setLocalBetaFileUrl(null);
    // avisa todo mundo que saí (nome some da lista + transmissão fecha nos outros)
    try {
      liveRoom.leaveRoom();
    } catch {}
  };

  /** Sai da call de verdade (botão vermelho): fecha tudo e recarrega no início. */
  const handleLeaveCall = () => {
    teardownCall();
    setTimeout(() => {
      window.location.href = window.location.pathname;
    }, 350);
  };

  /** Casinha: sai da call e volta pra tela LiveDC (lobby) SEM recarregar e sem perguntar. */
  const handleGoHome = () => {
    if (!currentUserName) return;
    if (roomCode) {
      teardownCall();
    }
    // reseta o estado da sala (o hook desconecta porque roomCode fica vazio)
    setStreamState({
      type: 'none',
      stream: null,
      videoUrl: undefined,
      title: 'Ninguém está transmitindo ainda.',
      quality: streamQuality,
      isSharing: false,
      isPaused: false,
    });
    setCameraStream(null);
    setIsCameraActive(false);
    setIsMuted(true);
    setIsDeafened(false);
    setMessages([]);
    setRoomCode('');
    setJoinedExisting(false);
    setRoomPassword('');
    setWasKicked(false);
    setExitReason(null);
    // limpa o ?room= da URL pra não reentrar sozinho
    try {
      const u = new URL(window.location.href);
      ['room', 't', 'n', 'k'].forEach((p) => u.searchParams.delete(p));
      window.history.replaceState({}, '', u.toString());
    } catch {}
    refreshRoomLists();
    setIsLobbyOpen(true);
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
        invitedRoomName={inviteMeta.name}
        invitedRoomType={inviteMeta.type}
        expectedPwHash={inviteMeta.pwHash}
        hashPassword={hashPassword}
      />
      <LobbyScreen
        isOpen={isLobbyOpen && !isNameModalOpen}
        userName={currentUserName}
        recentRooms={recentRooms}
        groups={groups}
        publicRooms={publicRooms}
        privateRooms={privateRooms}
        onCreateRoom={handleLobbyCreate}
        onJoinRoom={handleLobbyJoin}
        onRemoveRecent={handleRemoveRecent}
        onChangeName={() => {
          setIsLobbyOpen(false);
          setIsNameModalOpen(true);
        }}
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
        onHome={handleGoHome}
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
            isOwner={isRoomOwner}
            canManage={isRoomOwner || amAdmin}
            canKick={canKick}
            onKickParticipant={handleKickParticipant}
            onManageRoom={() => setIsManageOpen(true)}
            adminSessionIds={roomSettings.admins}
            sessionIdOf={(pid) => liveRoom.remotePeers[pid]?.sessionId}
            showOwnerCrown={roomSettings.permissions.showOwnerCrown !== false}
            showAdminCrown={roomSettings.permissions.showAdminCrown !== false}
            adminLevel={myAdminLevel}
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
          const labels: Record<string, string> = {
            mic: 'microfone',
            screen: 'compartilhar tela',
            camera: 'câmera',
            videoSource: 'fonte de vídeo (BETA)',
            chat: 'chat',
            gifs: 'GIFs',
            images: 'imagens',
            theme: 'tema da sala',
            adminCanBan: 'admins banirem pessoas',
            adminCanKick: 'admins desconectarem pessoas',
            showOwnerCrown: 'coroa do dono',
            showAdminCrown: 'coroa dos admins',
            adminLv1: 'poderes do ADM LV1 (limite + desconectar)',
            adminLv2: 'poderes do ADM LV2 (participantes, bans, admins, desconectar)',
            adminLv3: 'poderes do ADM LV3 (tudo + permissões)',
          };
          const l = labels[key] || key;
          const who = isRoomOwner ? 'Dono' : `ADM LV${myAdminLevel} ${currentUserName}`;
          if (key === 'showOwnerCrown' || key === 'showAdminCrown') {
            addSystemMessage(value ? `${who} ativou a ${l}.` : `${who} ocultou a ${l}.`);
          } else if (key.startsWith('adminLv') || key === 'adminCanBan' || key === 'adminCanKick') {
            addSystemMessage(value ? `${who} liberou ${l}.` : `${who} desativou ${l}.`);
          } else {
            addSystemMessage(
              value
                ? `${who} liberou "${l}" para todos.`
                : `${who} desativou "${l}" — só dono e admins podem agora.`
            );
          }
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
        onKick={(pid, name) => handleKickParticipant(pid, name)}
        isOwner={isRoomOwner}
        canBan={canBan}
        canKick={canKick}
        caps={myCaps}
        myLevel={myAdminLevel}
        onSetAdminLevel={(sid, level) => {
          liveRoom.setAdminLevel(sid, level);
          const who =
            participants.find((p) => liveRoom.remotePeers[p.id]?.sessionId === sid)?.name || 'Alguém';
          addSystemMessage(`${who} agora é ADM LV${level}.`);
          showToast(`${who} → ADM LV${level}`);
        }}
      />

      <ShareRoomModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        roomName={roomName}
        roomCode={roomCode}
        shareUrl={shareUrl}
        onRegenerateCode={handleRegenerateCode}
        roomPassword={isPrivate ? roomPassword : ''}
        isPrivate={isPrivate}
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
