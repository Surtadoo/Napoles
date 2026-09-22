import { useCallback, useEffect, useRef, useState } from 'react';
import { joinRoom, selfId } from 'trystero';
import type { ChatMessage, SharedMediaPayload, RoomSettings } from '../types';
import { DEFAULT_ROOM_SETTINGS } from '../types';

export interface RemotePeerProfile {
  peerId: string;
  name: string;
  avatar: string;
  muted: boolean;
  sharing: boolean;
  cameraOn: boolean;
  lastSeen: number;
}

export interface RemoteStreamInfo {
  key: string;
  peerId: string;
  stream: MediaStream;
  kind: 'screen' | 'camera' | 'mic' | 'unknown';
  ownerName: string;
}

interface UseLiveRoomOptions {
  roomCode: string;
  userName: string;
  userAvatar: string;
  enabled: boolean;
  isMuted: boolean;
  isSharing: boolean;
  isCameraOn: boolean;
  onRemoteChat: (msg: ChatMessage) => void;
  onPeerJoinNotice: (name: string) => void;
  onPeerLeaveNotice: (name: string) => void;
  onKicked?: () => void;
  onMediaNotice?: (text: string) => void;
  onQualityChanged?: (info: { label: string }) => void;
  /** sou o dono da sala (coroa) — controlo permissões, admin, limite e banimentos */
  isLeader?: boolean;
  onBanned?: (info: { by: string }) => void;
  onSettingsNotice?: (text: string) => void;
}

const APP_ID = 'livedc-call-v2-stable';

// Relays rápidos e estáveis (menos = conecta mais rápido no celular)
const RELAY_URLS = [
  'wss://relay.mostr.pub',
  'wss://nos.lol',
  'wss://relay.damus.io',
  'wss://nostr.wine',
  'wss://purplepag.es',
];

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    {
      urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443'],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

export function useLiveRoom({
  roomCode,
  userName,
  userAvatar,
  enabled,
  isMuted,
  isSharing,
  isCameraOn,
  onRemoteChat,
  onPeerJoinNotice,
  onPeerLeaveNotice,
  onKicked,
  onMediaNotice,
  onQualityChanged,
  isLeader,
  onBanned,
  onSettingsNotice,
}: UseLiveRoomOptions) {
  const [remotePeers, setRemotePeers] = useState<Record<string, RemotePeerProfile>>({});
  const [remoteStreams, setRemoteStreams] = useState<RemoteStreamInfo[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected'>('idle');
  const [sharedMedia, setSharedMedia] = useState<SharedMediaPayload | null>(null);
  const [roomSettings, setRoomSettings] = useState<RoomSettings>(DEFAULT_ROOM_SETTINGS);

  const roomRef = useRef<any>(null);
  const actionsRef = useRef<{
    profile?: any;
    chat?: any;
    kick?: any;
    media?: any;
    hello?: any;
    bye?: any;
    stream?: any;
    settings?: any;
  } | null>(null);

  const roomSettingsRef = useRef<RoomSettings>(DEFAULT_ROOM_SETTINGS);
  roomSettingsRef.current = roomSettings;
  const isLeaderRef = useRef(false);
  const localStreamsRef = useRef<Map<string, { stream: MediaStream; kind: string }>>(new Map());
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const roomCodeRef = useRef(roomCode);
  roomCodeRef.current = roomCode;

  const cbRef = useRef({
    onRemoteChat,
    onPeerJoinNotice,
    onPeerLeaveNotice,
    onKicked,
    onMediaNotice,
    onQualityChanged,
    onBanned,
    onSettingsNotice,
  });
  cbRef.current = {
    onRemoteChat,
    onPeerJoinNotice,
    onPeerLeaveNotice,
    onKicked,
    onMediaNotice,
    onQualityChanged,
    onBanned,
    onSettingsNotice,
  };

  isLeaderRef.current = !!isLeader;

  const profileRef = useRef({ userName, userAvatar, isMuted, isSharing, isCameraOn });
  profileRef.current = { userName, userAvatar, isMuted, isSharing, isCameraOn };

  const remotePeersRef = useRef<Record<string, RemotePeerProfile>>({});
  remotePeersRef.current = remotePeers;

  const remoteStreamsRef = useRef<RemoteStreamInfo[]>([]);
  remoteStreamsRef.current = remoteStreams;

  // ---- qualidade adaptativa (evita delay/travamento na transmissão) ----
  const TIERS = [
    { label: '4K 30fps', maxBitrate: 6000000, frameRate: 30, scale: 1 },
    { label: '1080p 30fps', maxBitrate: 3000000, frameRate: 30, scale: 1 },
    { label: '720p 30fps', maxBitrate: 1500000, frameRate: 30, scale: 1 },
    { label: '480p 24fps', maxBitrate: 700000, frameRate: 24, scale: 2 },
  ];
  const qualityTierRef = useRef(1);
  const qualityTimerRef = useRef<NodeJS.Timeout | null>(null);

  const tierFromLabel = useCallback((label?: string) => {
    const q = (label || '').toLowerCase();
    if (q.includes('4k') || q.includes('2160')) return 0;
    if (q.includes('1080')) return 1;
    if (q.includes('720')) return 2;
    return 3;
  }, []);

  const applyTier = useCallback((tier?: number) => {
    const t = TIERS[Math.min(Math.max(tier ?? qualityTierRef.current, 0), TIERS.length - 1)];
    try {
      const peers = roomRef.current?.getPeers?.() || {};
      Object.values(peers).forEach((pc: any) => {
        try {
          const senders = pc?.getSenders ? pc.getSenders() : [];
          (senders || []).forEach((sender: any) => {
            try {
              if (!sender?.track || sender.track.kind !== 'video') return;
              const params = sender.getParameters ? sender.getParameters() : {};
              if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
              params.encodings = params.encodings.map((e: any) => ({
                ...e,
                maxBitrate: t.maxBitrate,
                maxFramerate: t.frameRate,
                scaleResolutionDownBy: t.scale,
              }));
              try {
                params.degradationPreference = 'balanced';
              } catch {}
              if (sender.setParameters) sender.setParameters(params).catch(() => {});
            } catch {}
          });
        } catch {}
      });
    } catch {}
    return t.label;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopQualityMonitor = useCallback(() => {
    if (qualityTimerRef.current) {
      clearInterval(qualityTimerRef.current);
      qualityTimerRef.current = null;
    }
  }, []);

  /** Monitora a saúde da transmissão e reduz qualidade sozinho pra manter fluidez. */
  const startQualityMonitor = useCallback(() => {
    stopQualityMonitor();
    let ticks = 0;
    qualityTimerRef.current = setInterval(async () => {
      ticks += 1;
      if (ticks > 40) {
        stopQualityMonitor();
        return;
      }
      try {
        const peers = roomRef.current?.getPeers?.() || {};
        const pcs = Object.values(peers) as any[];
        if (pcs.length === 0) return;
        let bandwidthLimited = false;
        let cpuLimited = false;
        let lowFps = false;
        for (const pc of pcs) {
          try {
            const report = await pc.getStats();
            report.forEach((s: any) => {
              if (s.type !== 'outbound-rtp' || s.kind !== 'video' || s.isRemote) return;
              if (s.qualityLimitationReason === 'bandwidth') bandwidthLimited = true;
              if (s.qualityLimitationReason === 'cpu') cpuLimited = true;
              if (typeof s.framesPerSecond === 'number' && s.framesPerSecond > 0 && s.framesPerSecond < 10) {
                lowFps = true;
              }
            });
          } catch {}
        }
        if ((bandwidthLimited || lowFps || cpuLimited) && qualityTierRef.current < TIERS.length - 1) {
          qualityTierRef.current += 1;
          const label = applyTier();
          cbRef.current.onQualityChanged?.({ label });
        }
      } catch {}
    }, 4000);
  }, [applyTier, stopQualityMonitor]);

  const sharedMediaRef = useRef<SharedMediaPayload | null>(null);
  sharedMediaRef.current = sharedMedia;

  const myProfilePayload = useCallback(() => {
    const p = profileRef.current;
    return {
      name: p.userName,
      avatar: p.userAvatar,
      muted: p.isMuted,
      sharing: p.isSharing,
      cameraOn: p.isCameraOn,
      ts: Date.now(),
    };
  }, []);

  /** Remove por completo um peer: nome, vídeos, áudio e BETA dele. */
  const dropPeer = useCallback((peerId: string, notice?: boolean) => {
    if (!peerId) return;
    setRemotePeers((prev) => {
      const next = { ...prev };
      const left = next[peerId];
      delete next[peerId];
      if (left && notice) cbRef.current.onPeerLeaveNotice(left.name);
      return next;
    });
    setRemoteStreams((prev) => {
      const alvo = prev.filter((s) => s.peerId === peerId);
      alvo.forEach((s) => {
        try {
          s.stream.getTracks().forEach((t) => {
            t.onended = null;
            t.onmute = null;
            t.onunmute = null;
          });
        } catch {}
      });
      return prev.filter((s) => s.peerId !== peerId);
    });
    // encerra TODO áudio desse peer (chaves são `${peerId}-${streamId}`)
    Array.from(audioElsRef.current.keys())
      .filter((k) => k.startsWith(`${peerId}-`) || k === peerId)
      .forEach((k) => {
        const a = audioElsRef.current.get(k);
        if (a) {
          try {
            a.pause();
            (a as any).srcObject = null;
            a.removeAttribute?.('src');
          } catch {}
          audioElsRef.current.delete(k);
        }
      });
    // se o BETA era desse peer (arquivo/stream), fecha para todos
    const cur = sharedMediaRef.current;
    if (cur && cur.leaderId === peerId) {
      setSharedMedia(null);
    }
  }, []);

  const cleanupRoom = useCallback(() => {
    try {
      roomRef.current?.leave?.();
    } catch {}
    roomRef.current = null;
    actionsRef.current = null;
    audioElsRef.current.forEach((a) => {
      try {
        a.pause();
        a.srcObject = null;
      } catch {}
    });
    audioElsRef.current.clear();
    setRemotePeers({});
    setRemoteStreams([]);
    setSharedMedia(null);
    setConnectionStatus('idle');
  }, []);

  // ---- join / rejoin quando roomCode ou userName muda ----
  useEffect(() => {
    if (!enabled || !roomCode || !userName) return;

    let cancelled = false;
    setConnectionStatus('connecting');
    setRemotePeers({});
    setRemoteStreams([]);
    setSharedMedia(null);

    let room: any = null;
    try {
      room = joinRoom(
        {
          appId: APP_ID,
          password: `livedc-${roomCode}`,
          relayConfig: { urls: RELAY_URLS, redundancy: 3 } as any,
          rtcConfig: RTC_CONFIG,
        } as any,
        `livedc-room-${roomCode}`
      );
    } catch (e) {
      console.error('[LiveDC] join falhou', e);
      setConnectionStatus('idle');
      return;
    }
    roomRef.current = room;

    const profileAction = room.makeAction('livedc-profile-v3');
    const chatAction = room.makeAction('livedc-chat-v3');
    const kickAction = room.makeAction('livedc-kick-v1');
    const mediaAction = room.makeAction('livedc-media-v2');
    const helloAction = room.makeAction('livedc-hello-v1');
    const byeAction = room.makeAction('livedc-bye-v1');
    const streamAction = room.makeAction('livedc-stream-v1');
    const settingsAction = room.makeAction('livedc-settings-v1');
    actionsRef.current = {
      profile: profileAction,
      chat: chatAction,
      kick: kickAction,
      media: mediaAction,
      hello: helloAction,
      bye: byeAction,
      stream: streamAction,
      settings: settingsAction,
    };

    // ---- configurações da sala (só o líder manda; todos obedecem) ----
    try {
      (settingsAction as any).onMessage = (data: any, meta: any) => {
        const peerId = meta?.peerId || (typeof meta === 'string' ? meta : null);
        if (!data || cancelled) return;
        if (data.kind === 'ban' && data.targetName) {
          // fui banido?
          if (String(data.targetName).trim().toLowerCase() === String(profileRef.current.userName).trim().toLowerCase()) {
            cbRef.current.onBanned?.({ by: String(data.by || 'O dono da sala') });
          }
          return;
        }
        if (data.kind === 'settings' && data.settings) {
          setRoomSettings(data.settings as RoomSettings);
          cbRef.current.onSettingsNotice?.(
            `Configurações da sala atualizadas por ${String(data.by || 'admin')}.`
          );
        }
        // aviso de expulsão silenciosa já entra pelo canal de kick
        void peerId;
      };
    } catch {}

    // ---- "tchau": a pessoa saiu da call → sai da lista e fecha a tela dela ----
    try {
      (byeAction as any).onMessage = (_data: any, meta: any) => {
        const peerId = meta?.peerId || (typeof meta === 'string' ? meta : null);
        if (!peerId || cancelled) return;
        dropPeer(peerId, true);
      };
    } catch {}

    // ---- controle de transmissão: parar tela/câmera fecha na hora pra todos ----
    try {
      (streamAction as any).onMessage = (data: any, meta: any) => {
        const peerId = meta?.peerId || (typeof meta === 'string' ? meta : null);
        if (!peerId || cancelled || !data) return;
        if (data.kind === 'stop') {
          const tipo = String(data.type || '');
          setRemoteStreams((prev) => {
            const alvo = prev.filter((s) => {
              if (s.peerId !== peerId) return false;
              if (tipo === 'mic') return s.kind === 'mic';
              if (tipo === 'screen' || tipo === 'camera') {
                return s.kind === tipo || s.kind === 'unknown';
              }
              return true;
            });
            alvo.forEach((s) => {
              try {
                s.stream.getTracks().forEach((t) => {
                  t.onended = null;
                  t.onmute = null;
                  t.onunmute = null;
                });
              } catch {}
              Array.from(audioElsRef.current.keys())
                .filter((k) => k.startsWith(`${s.peerId}-`))
                .forEach((k) => {
                  const a = audioElsRef.current.get(k);
                  if (a) {
                    try {
                      a.pause();
                      (a as any).srcObject = null;
                    } catch {}
                    audioElsRef.current.delete(k);
                  }
                });
            });
            const restantes = prev.filter((s) => !alvo.includes(s));
            return restantes;
          });
          // também derruba o status "transmitindo" do perfil
          setRemotePeers((prev) =>
            prev[peerId] ? { ...prev, [peerId]: { ...prev[peerId], sharing: false, cameraOn: false } } : prev
          );
        }
      };
    } catch {}

    // recebo ordem de expulsão? só obedeço se o alvo for o meu selfId
    try {
      (kickAction as any).onMessage = (data: any) => {
        if (cancelled || !data) return;
        try {
          if (String(data.target || '') === String(selfId)) {
            cbRef.current.onKicked?.();
          }
        } catch {}
      };
    } catch {}

    // vídeo BETA compartilhado (YouTube/Twitch/Kick/arquivo)
    try {
      (mediaAction as any).onMessage = (data: any, meta: any) => {
        const peerId = meta?.peerId || (typeof meta === 'string' ? meta : null);
        if (!data || cancelled) return;
        if (data.kind === 'set' && data.media) {
          const m = data.media as SharedMediaPayload;
          const cur = sharedMediaRef.current;
          // se o vídeo atual é "só o líder controla" e quem mandou não é o líder, ignora
          if (cur && cur.controller === 'leader' && cur.leaderId !== peerId) return;
          setSharedMedia(m);
          cbRef.current.onMediaNotice?.(`${m.leaderName} compartilhou: ${m.title}`);
        } else if (data.kind === 'clear') {
          const cur = sharedMediaRef.current;
          if (cur && cur.controller === 'leader' && cur.leaderId !== peerId) return;
          setSharedMedia(null);
          cbRef.current.onMediaNotice?.(`${String(data.byName || 'Alguém')} encerrou o vídeo.`);
        }
      };
    } catch {}

    const broadcastProfile = (target?: string) => {
      if (cancelled) return;
      try {
        if (target) profileAction.send(myProfilePayload(), { target } as any);
        else profileAction.send(myProfilePayload());
      } catch {
        try {
          if (target) (profileAction as any).send(myProfilePayload(), target);
          else (profileAction as any).send(myProfilePayload());
        } catch {}
      }
    };

    const sendMediaTo = (target: string) => {
      const cur = sharedMediaRef.current;
      if (!cur) return;
      try {
        mediaAction.send({ kind: 'set', media: cur }, { target } as any);
      } catch {
        try {
          (mediaAction as any).send({ kind: 'set', media: cur }, target);
        } catch {}
      }
    };

    // ---- ENTRADA RÁPIDA: "olá" trocado assim que a conexão abre ----
    const greeted = new Set<string>();

    const pushLocalStreamsTo = (peerId: string) => {
      localStreamsRef.current.forEach(({ stream, kind }) => {
        try {
          room.addStream(stream, {
            target: peerId,
            metadata: { kind, owner: profileRef.current.userName },
          });
        } catch {}
      });
    };

    const sendSettingsTo = (target?: string) => {
      try {
        const payload = {
          kind: 'settings',
          settings: roomSettingsRef.current,
          by: profileRef.current.userName,
        };
        if (target) settingsAction.send(payload, { target } as any);
        else settingsAction.send(payload);
      } catch {
        try {
          const payload = {
            kind: 'settings',
            settings: roomSettingsRef.current,
            by: profileRef.current.userName,
          };
          if (target) (settingsAction as any).send(payload, target);
          else (settingsAction as any).send(payload);
        } catch {}
      }
    };

    const greetPeer = (peerId: string, forceAsk = false) => {
      if (!peerId || cancelled) return;
      broadcastProfile(peerId);
      sendMediaTo(peerId);
      pushLocalStreamsTo(peerId);
      if (isLeaderRef.current) sendSettingsTo(peerId);
      if (!greeted.has(peerId) || forceAsk) {
        greeted.add(peerId);
        try {
          helloAction.send({ ask: true, by: profileRef.current.userName }, { target: peerId } as any);
        } catch {
          try {
            (helloAction as any).send({ ask: true, by: profileRef.current.userName }, peerId);
          } catch {}
        }
      }
    };

    try {
      (helloAction as any).onMessage = (_data: any, meta: any) => {
        const peerId = meta?.peerId || (typeof meta === 'string' ? meta : null);
        if (!peerId || cancelled) return;
        // alguém novo chegou: manda meu perfil + meu vídeo/BETA imediatamente
        broadcastProfile(peerId);
        sendMediaTo(peerId);
        pushLocalStreamsTo(peerId);
      };
    } catch {}

    // varre peers conectados com frequência nos primeiros segundos (entrada rápida)
    let greetTicks = 0;
    const greetPoll = setInterval(() => {
      if (cancelled) return;
      greetTicks += 1;
      try {
        const peers = room.getPeers ? room.getPeers() : {};
        const ids = Object.keys(peers || {});
        ids.forEach((pid) => greetPeer(pid));
        if (greetTicks >= 60) clearInterval(greetPoll);
      } catch {}
    }, 400);

    try {
      (profileAction as any).onMessage = (data: any, meta: any) => {
        const peerId = meta?.peerId || (typeof meta === 'string' ? meta : null);
        if (!peerId || cancelled || !data) return;
        if (peerId === selfId) return;
        const name = String(data?.name || 'Convidado').slice(0, 24);

        // ---- evita a MESMA pessoa aparecer 2x na call (reconexão / 2 abas) ----
        const norm = name.trim().toLowerCase();
        const dupIds = Object.keys(remotePeersRef.current).filter(
          (pid) => pid !== peerId && (remotePeersRef.current[pid]?.name || '').trim().toLowerCase() === norm
        );
        if (dupIds.length > 0) {
          const streamingDup = dupIds.find((pid) =>
            remoteStreamsRef.current.some((s) => s.peerId === pid)
          );
          if (streamingDup) {
            // quem já está transmitindo é a conexão boa: ignora a duplicada
            return;
          }
          // remove a entrada velha e mantém só a nova conexão
          setRemotePeers((prev) => {
            const next = { ...prev };
            dupIds.forEach((pid) => delete next[pid]);
            return next;
          });
          setRemoteStreams((prev) => prev.filter((s) => !dupIds.includes(s.peerId)));
          dupIds.forEach((pid) => {
            Array.from(audioElsRef.current.keys())
              .filter((k) => k.startsWith(pid))
              .forEach((k) => {
                const a = audioElsRef.current.get(k);
                if (a) {
                  try {
                    a.pause();
                  } catch {}
                  audioElsRef.current.delete(k);
                }
              });
          });
        }

        // ---- líder aplica banimentos ----
        const s = roomSettingsRef.current;
        if (isLeaderRef.current && s.bans.some((b) => b.trim().toLowerCase() === norm)) {
          try {
            (settingsAction as any).send({
              kind: 'ban',
              targetName: name,
              by: profileRef.current.userName,
            });
          } catch {}
          try {
            kickAction.send({ target: peerId, by: profileRef.current.userName, reason: 'ban' });
          } catch {}
          dropPeer(peerId, false);
          cbRef.current.onSettingsNotice?.(`${name} tentou entrar, mas está banido da sala.`);
          return;
        }

        // ---- líder respeita o limite de participantes ----
        if (isLeaderRef.current && s.limit > 0) {
          const ehAdmin = s.admins.some((a) => a.trim().toLowerCase() === norm);
          const conectados = Object.keys(remotePeersRef.current).length;
          if (!ehAdmin && conectados > s.limit) {
            try {
              kickAction.send({
                target: peerId,
                by: profileRef.current.userName,
                reason: 'limit',
              });
            } catch {}
            dropPeer(peerId, false);
            cbRef.current.onSettingsNotice?.(
              `${name} não entrou: sala cheia (limite ${s.limit} pessoas).`
            );
            return;
          }
        }

        setRemotePeers((prev) => ({
          ...prev,
          [peerId]: {
            peerId,
            name,
            avatar: String(data?.avatar || ''),
            muted: !!data?.muted,
            sharing: !!data?.sharing,
            cameraOn: !!data?.cameraOn,
            lastSeen: Date.now(),
          },
        }));
        setRemoteStreams((prev) =>
          prev.map((s) => (s.peerId === peerId ? { ...s, ownerName: name } : s))
        );
      };
    } catch {}

    // guarda nomes já anunciados para não repetir toast
    const announced = new Set<string>();

    try {
      (chatAction as any).onMessage = (data: any, meta: any) => {
        const peerId = meta?.peerId || (typeof meta === 'string' ? meta : null);
        if (!data || cancelled) return;
        const msg: ChatMessage = {
          id: String(data.id || `${Date.now()}-${peerId}`),
          sender: String(data.sender || 'Convidado'),
          avatar: String(data.avatar || ''),
          text: data.text ? String(data.text) : undefined,
          mediaUrl: data.mediaUrl ? String(data.mediaUrl) : undefined,
          timestamp: String(
            data.timestamp ||
              new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          ),
          color: 'text-sky-400',
        };
        cbRef.current.onRemoteChat(msg);
      };
    } catch {}

    try {
      (room as any).onPeerJoin = (peerId: string) => {
        if (cancelled) return;
        // manda perfil + streams + vídeo BETA na hora e com retries curtos
        greetPeer(peerId, true);
        [250, 900, 2000].forEach((ms) => {
          setTimeout(() => {
            if (cancelled) return;
            greetPeer(peerId);
          }, ms);
        });
        setConnectionStatus('connected');
        // tenta descobrir nome logo depois
        setTimeout(() => {
          if (cancelled) return;
          const known = remotePeersRef.current[peerId];
          const label = known?.name && known.name !== 'Convidado' ? known.name : 'Alguém';
          if (!announced.has(peerId)) {
            announced.add(peerId);
            if (known && known.name !== 'Convidado') cbRef.current.onPeerJoinNotice(known.name);
            else {
              setTimeout(() => {
                const later = remotePeersRef.current[peerId];
                if (later && !announced.has(peerId + '-2')) {
                  announced.add(peerId + '-2');
                  cbRef.current.onPeerJoinNotice(later.name);
                } else if (!later) {
                  cbRef.current.onPeerJoinNotice(label);
                }
              }, 2500);
            }
          }
        }, 800);
      };
    } catch {}

    try {
      (room as any).onPeerLeave = (peerId: string) => {
        if (cancelled) return;
        // nome sai da call + tela/câmera dele fecha + áudio encerra
        dropPeer(peerId, true);
      };
    } catch {}

    try {
      (room as any).onPeerStream = (stream: MediaStream, peerId: string, metadata: any) => {
        if (cancelled || !stream) return;
        // ignora stream sem trilha de vídeo viva (evita tile cinza)
        const liveVideo = stream.getVideoTracks().filter((t) => t.readyState === 'live');
        const hasLiveVideo = liveVideo.length > 0;
        const hasAudio = stream.getAudioTracks().length > 0;
        if (!hasLiveVideo && !hasAudio) return;
        const kind =
          metadata?.kind === 'screen' || metadata?.kind === 'camera' || metadata?.kind === 'mic'
            ? metadata.kind
            : hasLiveVideo
              ? 'unknown'
              : 'mic';
        const key = `${peerId}-${stream.id}`;
        const ownerName =
          String((metadata as any)?.owner || '') ||
          remotePeersRef.current[peerId]?.name ||
          'Convidado';

        // áudio remoto: toca mesmo sem vídeo
        try {
          if (stream.getAudioTracks().length > 0 && !audioElsRef.current.has(key)) {
            const audio = new Audio();
            audio.srcObject = stream;
            (audio as any).playsInline = true;
            audio.autoplay = true;
            audio.play().catch(() => {
              // iOS exige gesto: tenta de novo no primeiro toque
              const retry = () => {
                audio.play().catch(() => {});
                window.removeEventListener('touchend', retry);
                window.removeEventListener('click', retry);
              };
              window.addEventListener('touchend', retry);
              window.addEventListener('click', retry);
            });
            audioElsRef.current.set(key, audio);
          }
        } catch {}

        const limparEste = () => {
          setRemoteStreams((p) => p.filter((s) => s.key !== key));
          const a = audioElsRef.current.get(key);
          if (a) {
            try {
              a.pause();
              (a as any).srcObject = null;
            } catch {}
            audioElsRef.current.delete(key);
          }
        };

        stream.getTracks().forEach((t) => {
          const prevEnded = t.onended;
          t.onended = (e) => {
            try {
              (prevEnded as any)?.(e);
            } catch {}
            if (!stream.getTracks().some((x) => x.readyState === 'live')) limparEste();
          };
          // quando quem transmite para, a trilha remota fica "muda" —
          // se continuar muda por 2,5s, a transmissão acabou: fecha a tela
          let muteTimer: NodeJS.Timeout | null = null;
          const prevMute = t.onmute;
          const prevUnmute = t.onunmute;
          t.onmute = (e) => {
            try {
              (prevMute as any)?.(e);
            } catch {}
            if (muteTimer) clearTimeout(muteTimer);
            muteTimer = setTimeout(() => {
              if (t.readyState !== 'live' || t.muted) limparEste();
            }, 2500);
          };
          t.onunmute = (e) => {
            try {
              (prevUnmute as any)?.(e);
            } catch {}
            if (muteTimer) clearTimeout(muteTimer);
          };
        });

        setRemoteStreams((prev) => {
          // agrupa por peer + tipo (evita tela duplicada do mesmo peer)
          const sameGroup = (a: string, b: string) => {
            if (a === 'mic' || b === 'mic') return a === b;
            if (a === 'unknown' || b === 'unknown') return true;
            return a === b;
          };
          const k = kind as string;
          // remove duplicadas antigas do mesmo grupo (mantém só a mais nova)
          const stale = prev.filter(
            (s) => s.peerId === peerId && s.key !== key && sameGroup(s.kind as string, k)
          );
          stale.forEach((d) => {
            const a = audioElsRef.current.get(d.key);
            if (a) {
              try {
                a.pause();
                (a as any).srcObject = null;
              } catch {}
              audioElsRef.current.delete(d.key);
            }
          });
          let next = prev.filter(
            (s) => !(s.peerId === peerId && s.key !== key && sameGroup(s.kind as string, k))
          );
          if (next.some((s) => s.key === key)) {
            return next.map((s) => (s.key === key ? { ...s, stream, kind: kind as any, ownerName } : s));
          }
          return [...next, { key, peerId, stream, kind: kind as any, ownerName }];
        });
        setConnectionStatus('connected');
      };
    } catch {}

    // anúncio inicial agressivo (o mais cedo possível = entra rápido na lista)
    [120, 400, 800, 1500, 2500, 4000].forEach((ms) => {
      setTimeout(() => {
        if (!cancelled) {
          broadcastProfile();
          try {
            const peers = room.getPeers ? room.getPeers() : {};
            Object.keys(peers || {}).forEach((pid) => greetPeer(pid));
          } catch {}
          setConnectionStatus('connected');
        }
      }, ms);
    });

    const keepAlive = setInterval(() => {
      if (!cancelled) broadcastProfile();
    }, 2500);

    // rede limpa peers mortos: sem perfil por 12s = saiu da call (fecha a tela dele)
    const prune = setInterval(() => {
      if (cancelled) return;
      const agora = Date.now();
      Object.keys(remotePeersRef.current).forEach((pid) => {
        const visto = remotePeersRef.current[pid]?.lastSeen || 0;
        if (visto && agora - visto > 12000) dropPeer(pid, true);
      });
    }, 4000);

    // avisa a sala ao fechar/recarregar a aba (tira o nome e a tela na hora)
    const avisarSaida = () => {
      try {
        (byeAction as any)?.send?.({ kind: 'bye', name: profileRef.current.userName });
      } catch {}
    };
    window.addEventListener('pagehide', avisarSaida);
    window.addEventListener('beforeunload', avisarSaida);

    return () => {
      cancelled = true;
      clearInterval(keepAlive);
      clearInterval(greetPoll);
      clearInterval(prune);
      window.removeEventListener('pagehide', avisarSaida);
      window.removeEventListener('beforeunload', avisarSaida);
      stopQualityMonitor();
      try {
        room.leave?.();
      } catch {}
      if (roomRef.current === room) {
        roomRef.current = null;
        actionsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, roomCode, userName]);

  // reenvia perfil quando mudo/share/câmera muda
  useEffect(() => {
    if (!actionsRef.current?.profile || !enabled || !userName) return;
    const t = setTimeout(() => {
      try {
        actionsRef.current?.profile?.send(myProfilePayload());
      } catch {}
    }, 200);
    return () => clearTimeout(t);
  }, [isMuted, isSharing, isCameraOn, userName, enabled, myProfilePayload]);

  const sendChat = useCallback((msg: ChatMessage) => {
    const payload = {
      id: msg.id,
      sender: msg.sender,
      avatar: msg.avatar,
      text: msg.text || '',
      mediaUrl: msg.mediaUrl || '',
      timestamp: msg.timestamp,
    };
    try {
      actionsRef.current?.chat?.send(payload);
    } catch {}
  }, []);

  const publishStream = useCallback(
    (stream: MediaStream, kind: 'screen' | 'camera' | 'mic', key?: string) => {
      const mapKey = key || `${kind}-${stream.id}`;
      localStreamsRef.current.set(mapKey, { stream, kind });
      const room = roomRef.current;
      if (!room) return;
      // dica de conteúdo: ajuda o navegador a otimizar texto/movimento
      try {
        const vt = stream.getVideoTracks()[0] as any;
        if (vt && 'contentHint' in vt) {
          vt.contentHint = kind === 'screen' ? 'detail' : 'motion';
        }
      } catch {}
      try {
        const r = room.addStream(stream, {
          metadata: { kind, owner: profileRef.current.userName },
        });
        if (Array.isArray(r)) r.forEach((p: any) => (p as Promise<void>)?.catch?.(() => {}));
      } catch {}
      // avisa a sala que comecei a transmitir (entra na hora pra todos)
      try {
        actionsRef.current?.stream?.send({
          kind: 'start',
          type: kind,
          owner: profileRef.current.userName,
        });
      } catch {}
      // aplica a qualidade escolhida e passa a vigiar a rede p/ evitar delay
      setTimeout(() => applyTier(), 700);
      setTimeout(() => applyTier(), 1800);
      if (kind !== 'mic') startQualityMonitor();
    },
    [applyTier, startQualityMonitor]
  );

  const unpublishStream = useCallback(
    (stream: MediaStream, key?: string) => {
      let tipo = '';
      if (key) {
        tipo = localStreamsRef.current.get(key)?.kind || '';
        localStreamsRef.current.delete(key);
      } else {
        for (const [k, v] of localStreamsRef.current.entries()) {
          if (v.stream === stream) {
            tipo = v.kind;
            localStreamsRef.current.delete(k);
          }
        }
      }
      try {
        roomRef.current?.removeStream?.(stream);
      } catch {}
      // encerra as trilhas (garante que o outro lado receba o fim)
      try {
        stream.getTracks().forEach((t) => t.stop());
      } catch {}
      // avisa todos: a tela/câmera fechou → some imediatamente pra eles
      try {
        actionsRef.current?.stream?.send({
          kind: 'stop',
          type: tipo || 'screen',
          owner: profileRef.current.userName,
        });
      } catch {}
      // sem mais vídeo local: para de monitorar qualidade
      const aindaTemVideo = Array.from(localStreamsRef.current.values()).some(
        (v) => v.kind !== 'mic'
      );
      if (!aindaTemVideo) stopQualityMonitor();
    },
    [stopQualityMonitor]
  );

  /** Só o líder: aplica e sincroniza as configurações da sala para todos. */
  const updateRoomSettings = useCallback((next: RoomSettings) => {
    setRoomSettings(next);
    try {
      actionsRef.current?.settings?.send({
        kind: 'settings',
        settings: next,
        by: profileRef.current.userName,
      });
    } catch {}
  }, []);

  /** Só o líder: bane alguém da sala (não entra mais + sai agora). */
  const banPeer = useCallback(
    (peerId: string, name: string) => {
      const next: RoomSettings = {
        ...roomSettingsRef.current,
        bans: Array.from(new Set([...roomSettingsRef.current.bans, name])),
      };
      updateRoomSettings(next);
      try {
        actionsRef.current?.settings?.send({
          kind: 'ban',
          targetName: name,
          by: profileRef.current.userName,
        });
      } catch {}
      if (peerId) {
        try {
          actionsRef.current?.kick?.send({
            target: peerId,
            by: profileRef.current.userName,
            reason: 'ban',
          });
        } catch {}
        dropPeer(peerId, true);
      }
    },
    [dropPeer, updateRoomSettings]
  );

  /** Avisa a sala que estou saindo (tira meu nome e minha tela na hora). */
  const announceLeave = useCallback(() => {
    try {
      actionsRef.current?.stream?.send({ kind: 'stop', type: 'all' });
    } catch {}
    try {
      actionsRef.current?.bye?.send({
        kind: 'bye',
        name: profileRef.current.userName,
      });
    } catch {}
    try {
      roomRef.current?.leave?.();
    } catch {}
  }, []);

  /** Aplica a qualidade escolhida nos senders (e volta a subir se a rede melhorar). */
  const boostSenders = useCallback(
    (qualityLabel?: string) => {
      qualityTierRef.current = tierFromLabel(qualityLabel);
      applyTier();
      try {
        startQualityMonitor();
      } catch {}
    },
    [applyTier, startQualityMonitor, tierFromLabel]
  );

  // expulsa um peer da call (só o dono usa). Envia ordem + remove localmente.
  const kickPeer = useCallback(
    (targetPeerId: string, targetName: string) => {
      try {
        actionsRef.current?.kick?.send({
          target: targetPeerId,
          by: profileRef.current.userName,
          ts: Date.now(),
        });
      } catch {}
      setRemotePeers((prev) => {
        const next = { ...prev };
        delete next[targetPeerId];
        return next;
      });
      setRemoteStreams((prev) => prev.filter((s) => s.peerId !== targetPeerId));
      const audioKeys = Array.from(audioElsRef.current.keys()).filter((k) =>
        k.startsWith(targetPeerId)
      );
      audioKeys.forEach((k) => {
        const a = audioElsRef.current.get(k);
        if (a) {
          try {
            a.pause();
          } catch {}
          audioElsRef.current.delete(k);
        }
      });
      return targetName;
    },
    []
  );

  /** Compartilha um vídeo BETA com toda a sala (YouTube/Twitch/Kick/arquivo). */
  const broadcastMedia = useCallback((media: SharedMediaPayload) => {
    setSharedMedia(media);
    try {
      actionsRef.current?.media?.send({ kind: 'set', media });
    } catch {}
  }, []);

  /** Encerra o vídeo BETA para toda a sala. */
  const clearMedia = useCallback((byName: string) => {
    setSharedMedia(null);
    try {
      actionsRef.current?.media?.send({ kind: 'clear', byName });
    } catch {}
  }, []);

  return {
    remotePeers,
    remoteStreams,
    remotePeersList: Object.values(remotePeers),
    connectionStatus,
    peerCount: Object.keys(remotePeers).length,
    sendChat,
    publishStream,
    unpublishStream,
    cleanupRoom,
    kickPeer,
    boostSenders,
    myPeerId: selfId as string,
    sharedMedia,
    broadcastMedia,
    clearMedia,
    announceLeave,
    dropPeer,
    roomSettings,
    updateRoomSettings,
    banPeer,
  };
}
