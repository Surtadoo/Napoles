import { useCallback, useEffect, useRef, useState } from 'react';
import { joinRoom, selfId } from 'trystero';
import type { ChatMessage, SharedMediaPayload, RoomSettings, AdminLevel } from '../types';
import { DEFAULT_PERMISSIONS, computeAdminCaps } from '../types';

export interface RemotePeerProfile {
  peerId: string;
  name: string;
  avatar: string;
  muted: boolean;
  sharing: boolean;
  cameraOn: boolean;
  lastSeen: number;
  /** id estável da sessão (sobrevive a reconexão) — evita "duas pessoas com o mesmo nome" */
  sessionId?: string;
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
  /** true = eu criei a sala (sou o dono/coroa) */
  isOwner: boolean;
  onRemoteChat: (msg: ChatMessage) => void;
  onPeerJoinNotice: (name: string) => void;
  onPeerLeaveNotice: (name: string) => void;
  onKicked?: () => void;
  onBanned?: () => void;
  onMediaNotice?: (text: string) => void;
  onRoomFull?: () => void;
}

const APP_ID = 'livedc-call-v3-fast';

// Relays em paralelo → descoberta rápida
const RELAY_URLS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.mostr.pub',
  'wss://relay.primal.net',
  'wss://nostr.wine',
  'wss://relay.nostr.band',
  'wss://purplepag.es',
  'wss://nostr.mom',
];

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun.cloudflare.com:3478',
      ],
    },
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 4,
};

// sessão estável por aba (não muda em reconexão) → dedup de peer
function getSessionId(): string {
  try {
    const k = 'livedc-session-id';
    let v = sessionStorage.getItem(k);
    if (!v) {
      v = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(k, v);
    }
    return v;
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
const MY_SESSION_ID = getSessionId();

/** Aplica bitrate/prioridade nos senders de vídeo de um RTCPeerConnection. */
function tuneSendersOnPc(pc: any, opts: { maxBitrate: number; keepRes: boolean }) {
  try {
    const senders = pc?.getSenders ? pc.getSenders() : [];
    (senders || []).forEach((sender: any) => {
      try {
        if (!sender?.track) return;
        const params = sender.getParameters ? sender.getParameters() : {};
        if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
        if (sender.track.kind === 'video') {
          params.encodings = params.encodings.map((e: any) => ({
            ...e,
            maxBitrate: opts.maxBitrate,
            scaleResolutionDownBy: 1,
            networkPriority: 'high',
            priority: 'high',
          }));
          try {
            // 'maintain-framerate' = evita travar/engasgar (delay). Quem quer 4K nítido
            // usa maintain-resolution, mas em 60fps o framerate é o que mata o atraso.
            params.degradationPreference = opts.keepRes ? 'maintain-resolution' : 'maintain-framerate';
          } catch {}
        } else if (sender.track.kind === 'audio') {
          params.encodings = params.encodings.map((e: any) => ({
            ...e,
            maxBitrate: 64000,
            networkPriority: 'high',
            priority: 'high',
          }));
        }
        if (sender.setParameters) sender.setParameters(params).catch(() => {});
      } catch {}
    });
  } catch {}
}

/** Reduz latência no receptor: buffer de jitter mínimo (playoutDelayHint). */
function tuneReceiversOnPc(pc: any) {
  try {
    const receivers = pc?.getReceivers ? pc.getReceivers() : [];
    (receivers || []).forEach((r: any) => {
      try {
        if ('playoutDelayHint' in r) r.playoutDelayHint = 0;
        if ('jitterBufferTarget' in r) r.jitterBufferTarget = 0;
      } catch {}
    });
  } catch {}
}

export function useLiveRoom({
  roomCode,
  userName,
  userAvatar,
  enabled,
  isMuted,
  isSharing,
  isCameraOn,
  isOwner,
  onRemoteChat,
  onPeerJoinNotice,
  onPeerLeaveNotice,
  onKicked,
  onBanned,
  onMediaNotice,
  onRoomFull,
}: UseLiveRoomOptions) {
  const [remotePeers, setRemotePeers] = useState<Record<string, RemotePeerProfile>>({});
  const [remoteStreams, setRemoteStreams] = useState<RemoteStreamInfo[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected'>('idle');
  const [sharedMedia, setSharedMedia] = useState<SharedMediaPayload | null>(null);

  // gerência da sala (permissões/admins/banidos/limite) — o dono é a fonte da verdade
  const makeDefaultSettings = (): RoomSettings => ({
    permissions: { ...DEFAULT_PERMISSIONS },
    admins: [],
    adminLevels: {},
    banned: [],
    maxParticipants: 0,
    ownerSessionId: isOwner ? MY_SESSION_ID : '',
    ownerName: isOwner ? userName : '',
    version: 0,
  });
  const [roomSettings, setRoomSettings] = useState<RoomSettings>(makeDefaultSettings);
  const roomSettingsRef = useRef<RoomSettings>(roomSettings);
  roomSettingsRef.current = roomSettings;
  const isOwnerRef = useRef(isOwner);
  isOwnerRef.current = isOwner;
  const broadcastSettingsRef = useRef<((target?: string) => void) | null>(null);

  const roomRef = useRef<any>(null);
  const actionsRef = useRef<{
    profile?: any;
    chat?: any;
    kick?: any;
    media?: any;
    signal?: any;
    settings?: any;
    adminReq?: any;
  } | null>(null);
  const localStreamsRef = useRef<Map<string, { stream: MediaStream; kind: string }>>(new Map());
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const qualityRef = useRef<string>('1080p 60fps');
  const roomCodeRef = useRef(roomCode);
  roomCodeRef.current = roomCode;

  const cbRef = useRef({
    onRemoteChat,
    onPeerJoinNotice,
    onPeerLeaveNotice,
    onKicked,
    onBanned,
    onMediaNotice,
    onRoomFull,
  });
  cbRef.current = {
    onRemoteChat,
    onPeerJoinNotice,
    onPeerLeaveNotice,
    onKicked,
    onBanned,
    onMediaNotice,
    onRoomFull,
  };

  const profileRef = useRef({ userName, userAvatar, isMuted, isSharing, isCameraOn });
  profileRef.current = { userName, userAvatar, isMuted, isSharing, isCameraOn };

  const remotePeersRef = useRef<Record<string, RemotePeerProfile>>({});
  remotePeersRef.current = remotePeers;

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
      sid: MY_SESSION_ID,
      ts: Date.now(),
    };
  }, []);

  const stopAudioFor = (key: string) => {
    const a = audioElsRef.current.get(key);
    if (a) {
      try {
        a.pause();
        (a as any).srcObject = null;
      } catch {}
      audioElsRef.current.delete(key);
    }
  };

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
          relayConfig: { urls: RELAY_URLS, redundancy: RELAY_URLS.length } as any,
          rtcConfig: RTC_CONFIG,
          trickleIce: true,
        } as any,
        `livedc-room-${roomCode}`
      );
    } catch (e) {
      console.error('[LiveDC] join falhou', e);
      setConnectionStatus('idle');
      return;
    }
    roomRef.current = room;

    const profileAction = room.makeAction('livedc-profile-v4');
    const chatAction = room.makeAction('livedc-chat-v3');
    const kickAction = room.makeAction('livedc-kick-v1');
    const mediaAction = room.makeAction('livedc-media-v2');
    // sinal explícito: "parei a tela/câmera" ou "saí da call" → some na hora pra todos
    const signalAction = room.makeAction('livedc-signal-v1');
    // gerência da sala (permissões/admins/banidos/limite) — só o dono envia
    const settingsAction = room.makeAction('livedc-settings-v1');
    // pedidos de admin (ban/unban) → só o dono executa e registra
    const adminReqAction = room.makeAction('livedc-adminreq-v1');
    actionsRef.current = {
      profile: profileAction,
      chat: chatAction,
      kick: kickAction,
      media: mediaAction,
      signal: signalAction,
      settings: settingsAction,
      adminReq: adminReqAction,
    };

    try {
      (adminReqAction as any).onMessage = (data: any, meta: any) => {
        const peerId = meta?.peerId || (typeof meta === 'string' ? meta : null);
        if (!data || cancelled || !peerId) return;
        if (!isOwnerRef.current) return; // só o dono processa
        const bySid = String(data.bySid || remotePeersRef.current[peerId]?.sessionId || '');
        const s = roomSettingsRef.current;
        if (!bySid || !s.admins.includes(bySid)) return;
        // capacidades de quem pediu (pelo nível + toggles ligados)
        const caps = computeAdminCaps(s, bySid, false);
        const byLv: AdminLevel = (s.adminLevels?.[bySid] as AdminLevel) || 1;
        const targetSid = String(data.targetSid || '');
        const by = String(data.by || 'admin');

        const apply = (next: RoomSettings) => {
          const bumped: RoomSettings = { ...next, version: (s.version || 0) + 1 };
          roomSettingsRef.current = bumped;
          setRoomSettings(bumped);
          broadcastSettingsRef.current?.();
          [300, 1200].forEach((ms) => setTimeout(() => broadcastSettingsRef.current?.(), ms));
        };

        // ninguém mexe no dono
        if (targetSid && targetSid === MY_SESSION_ID) return;

        if (data.kind === 'ban') {
          if (!caps.ban || !targetSid) return;
          const name = String(data.targetName || 'Convidado');
          apply({
            ...s,
            admins: s.admins.filter((a) => a !== targetSid),
            banned: s.banned.some((b) => b.sessionId === targetSid)
              ? s.banned
              : [...s.banned, { sessionId: targetSid, name, bannedAt: Date.now(), by }],
          });
          setRemotePeers((prev) => {
            const next = { ...prev };
            Object.keys(next).forEach((pid) => {
              if (next[pid]?.sessionId === targetSid) delete next[pid];
            });
            return next;
          });
          setRemoteStreams((prev) => {
            const gone = prev.filter((st) => remotePeersRef.current[st.peerId]?.sessionId === targetSid);
            gone.forEach((st) => stopAudioFor(st.key));
            return prev.filter((st) => !gone.includes(st));
          });
        } else if (data.kind === 'unban') {
          if (!caps.ban || !targetSid) return;
          apply({ ...s, banned: s.banned.filter((b) => b.sessionId !== targetSid) });
        } else if (data.kind === 'setMax') {
          if (!caps.limit) return;
          const max = Math.max(0, Math.floor(Number(data.max) || 0));
          apply({ ...s, maxParticipants: max });
        } else if (data.kind === 'toggleAdmin') {
          if (!caps.admins || !targetSid || targetSid === bySid) return;
          const has = s.admins.includes(targetSid);
          // admin não remove alguém de nível maior que o dele
          const targetLv: AdminLevel = (s.adminLevels?.[targetSid] as AdminLevel) || 1;
          if (has && targetLv > byLv) return;
          const levels = { ...(s.adminLevels || {}) };
          if (has) delete levels[targetSid];
          else levels[targetSid] = 1;
          apply({
            ...s,
            admins: has ? s.admins.filter((a) => a !== targetSid) : [...s.admins, targetSid],
            adminLevels: levels,
          });
        } else if (data.kind === 'setAdminLevel') {
          if (!caps.admins || !targetSid || targetSid === bySid) return;
          const lv = (Math.min(3, Math.max(1, Math.floor(Number(data.level) || 1))) as AdminLevel);
          if (lv > byLv) return; // não dá nível acima do próprio
          apply({
            ...s,
            admins: s.admins.includes(targetSid) ? s.admins : [...s.admins, targetSid],
            adminLevels: { ...(s.adminLevels || {}), [targetSid]: lv },
          });
        } else if (data.kind === 'setPermission') {
          if (!caps.permissions) return;
          const key = String(data.key || '') as keyof RoomSettings['permissions'];
          const locked = ['adminLv1', 'adminLv2', 'adminLv3', 'showOwnerCrown'];
          if (!key || locked.includes(key) || !(key in s.permissions)) return;
          apply({ ...s, permissions: { ...s.permissions, [key]: !!data.value } });
        }
      };
    } catch {}

    // se sou o dono, garanto que as configs têm meu id/nome
    if (isOwnerRef.current) {
      const fixed: RoomSettings = {
        ...roomSettingsRef.current,
        ownerSessionId: MY_SESSION_ID,
        ownerName: profileRef.current.userName,
      };
      roomSettingsRef.current = fixed;
      setRoomSettings(fixed);
    } else {
      // convidado: zera pra receber as configs do dono desta sala
      const fresh: RoomSettings = {
        permissions: { ...DEFAULT_PERMISSIONS },
        admins: [],
        adminLevels: {},
        banned: [],
        maxParticipants: 0,
        ownerSessionId: '',
        ownerName: '',
        version: 0,
      };
      roomSettingsRef.current = fresh;
      setRoomSettings(fresh);
    }

    const broadcastSettings = (target?: string) => {
      if (cancelled || !isOwnerRef.current) return;
      const s = roomSettingsRef.current;
      const payload = { ...s, ownerSessionId: MY_SESSION_ID, ownerName: profileRef.current.userName };
      try {
        if (target) settingsAction.send(payload as any, { target } as any);
        else settingsAction.send(payload as any);
      } catch {}
    };
    // deixa acessível pras funções de gerência (pushSettings) reenviarem via este canal
    broadcastSettingsRef.current = broadcastSettings;

    try {
      (settingsAction as any).onMessage = (data: any, meta: any) => {
        const peerId = meta?.peerId || (typeof meta === 'string' ? meta : null);
        if (!data || cancelled || !peerId) return;
        const incoming = data as RoomSettings;
        const cur = roomSettingsRef.current;
        if (isOwnerRef.current) return; // dono não aceita configs de ninguém
        // aceita do dono conhecido; se ainda não conheço dono, aceita o primeiro que se declarar
        if (cur.ownerSessionId && incoming.ownerSessionId && incoming.ownerSessionId !== cur.ownerSessionId) {
          return;
        }
        // versão igual ou maior sempre aplica (igual = reenvio/garantia)
        if (typeof incoming.version === 'number' && incoming.version < (cur.version || 0)) return;
        const next: RoomSettings = {
          permissions: { ...DEFAULT_PERMISSIONS, ...(incoming.permissions || {}) },
          admins: Array.isArray(incoming.admins) ? incoming.admins : [],
          adminLevels:
            incoming.adminLevels && typeof incoming.adminLevels === 'object' ? incoming.adminLevels : {},
          banned: Array.isArray(incoming.banned) ? incoming.banned : [],
          maxParticipants: Number(incoming.maxParticipants || 0),
          ownerSessionId: String(incoming.ownerSessionId || ''),
          ownerName: String(incoming.ownerName || ''),
          version: Number(incoming.version || 0),
        };
        roomSettingsRef.current = next;
        setRoomSettings(next);
        // fui banido? saio na hora
        const banned = (incoming.banned || []).some((b) => b.sessionId === MY_SESSION_ID);
        if (banned) cbRef.current.onBanned?.();
      };
    } catch {}

    try {
      (kickAction as any).onMessage = (data: any) => {
        if (cancelled || !data) return;
        try {
          const isMe =
            String(data.target || '') === String(selfId) ||
            String(data.targetSid || '') === MY_SESSION_ID;
          if (!isMe) return;
          if (data.full) cbRef.current.onRoomFull?.();
          else if (data.ban) cbRef.current.onBanned?.();
          else cbRef.current.onKicked?.();
        } catch {}
      };
    } catch {}

    try {
      (signalAction as any).onMessage = (data: any, meta: any) => {
        const peerId = meta?.peerId || (typeof meta === 'string' ? meta : null);
        if (!data || !peerId || cancelled) return;
        const kind = String(data.kind || '');
        if (kind === 'stop-stream') {
          // remove imediatamente os vídeos desse tipo desse peer (sem esperar track.onended)
          const which = String(data.streamKind || '');
          setRemoteStreams((prev) => {
            const gone = prev.filter(
              (s) =>
                s.peerId === peerId &&
                (which === 'all' || which === '' || s.kind === which || s.kind === 'unknown')
            );
            gone.forEach((s) => {
              try {
                s.stream.getTracks().forEach((t) => t.stop());
              } catch {}
              stopAudioFor(s.key);
            });
            return prev.filter((s) => !gone.includes(s));
          });
          setRemotePeers((prev) => {
            const p = prev[peerId];
            if (!p) return prev;
            return {
              ...prev,
              [peerId]: {
                ...p,
                sharing: which === 'camera' ? p.sharing : false,
                cameraOn: which === 'screen' ? p.cameraOn : false,
              },
            };
          });
        } else if (kind === 'leave') {
          // a pessoa saiu: tira da lista + fecha vídeos/áudio dela na hora
          setRemotePeers((prev) => {
            const next = { ...prev };
            const left = next[peerId];
            delete next[peerId];
            if (left && left.name !== 'Conectando…') {
              const sid = left.sessionId;
              // também remove qualquer outro registro da mesma sessão
              if (sid) {
                Object.keys(next).forEach((pid) => {
                  if (next[pid]?.sessionId === sid) delete next[pid];
                });
              }
              cbRef.current.onPeerLeaveNotice(left.name);
            }
            return next;
          });
          setRemoteStreams((prev) => {
            prev
              .filter((s) => s.peerId === peerId)
              .forEach((s) => {
                try {
                  s.stream.getTracks().forEach((t) => t.stop());
                } catch {}
                stopAudioFor(s.key);
              });
            return prev.filter((s) => s.peerId !== peerId);
          });
          // se quem saiu era o líder do vídeo BETA, encerra o vídeo
          const cur = sharedMediaRef.current;
          if (cur && cur.leaderId === peerId) {
            setSharedMedia(null);
          }
        }
      };
    } catch {}

    try {
      (mediaAction as any).onMessage = (data: any, meta: any) => {
        const peerId = meta?.peerId || (typeof meta === 'string' ? meta : null);
        if (!data || cancelled) return;
        if (data.kind === 'set' && data.media) {
          const m = data.media as SharedMediaPayload;
          const cur = sharedMediaRef.current;
          if (cur && cur.controller === 'leader' && cur.leaderId !== peerId) return;
          if (cur && cur.id === m.id) return; // já temos esse
          setSharedMedia(m);
          cbRef.current.onMediaNotice?.(`${m.leaderName} compartilhou: ${m.title}`);
        } else if (data.kind === 'clear') {
          const cur = sharedMediaRef.current;
          if (cur && cur.controller === 'leader' && cur.leaderId !== peerId) return;
          if (!cur) return;
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
      } catch {}
    };

    // aplica tuning de latência em todas as conexões atuais
    const tuneAll = () => {
      try {
        const peers = room.getPeers ? room.getPeers() : {};
        const q = (qualityRef.current || '').toLowerCase();
        const is4k = q.includes('4k') || q.includes('2160');
        const is1080 = q.includes('1080');
        const maxBitrate = is4k ? 12000000 : is1080 ? 5000000 : 2500000;
        Object.values(peers || {}).forEach((pc: any) => {
          tuneSendersOnPc(pc, { maxBitrate, keepRes: is4k });
          tuneReceiversOnPc(pc);
        });
      } catch {}
    };

    // nomes já anunciados (por sessão, não por peerId → sem toast duplicado)
    const announcedSessions = new Set<string>();

    try {
      (profileAction as any).onMessage = (data: any, meta: any) => {
        const peerId = meta?.peerId || (typeof meta === 'string' ? meta : null);
        if (!peerId || cancelled || !data) return;
        const name = String(data?.name || 'Convidado').slice(0, 24);
        const sid = data?.sid ? String(data.sid) : undefined;

        setRemotePeers((prev) => {
          const next: Record<string, RemotePeerProfile> = { ...prev };
          // DEDUP: se já existe outro peerId com a MESMA sessão, é reconexão → remove o antigo
          if (sid) {
            Object.keys(next).forEach((pid) => {
              if (pid !== peerId && next[pid]?.sessionId === sid) {
                delete next[pid];
              }
            });
          }
          next[peerId] = {
            peerId,
            name,
            avatar: String(data?.avatar || ''),
            muted: !!data?.muted,
            sharing: !!data?.sharing,
            cameraOn: !!data?.cameraOn,
            lastSeen: Date.now(),
            sessionId: sid,
          };
          return next;
        });
        setRemoteStreams((prev) => {
          // perfil diz que NÃO está transmitindo → limpa vídeo fantasma dele na hora
          const clean = prev.filter((s) => {
            if (s.peerId !== peerId) return true;
            if (s.kind === 'mic') return true;
            const isScreen = s.kind === 'screen' || s.kind === 'unknown';
            const isCam = s.kind === 'camera';
            if (isScreen && !data?.sharing) {
              stopAudioFor(s.key);
              return false;
            }
            if (isCam && !data?.cameraOn) {
              stopAudioFor(s.key);
              return false;
            }
            return true;
          });
          return clean.map((s) => (s.peerId === peerId ? { ...s, ownerName: name } : s));
        });

        // DONO: se essa sessão está banida, expulsa de novo automaticamente
        if (isOwnerRef.current && sid) {
          const isBanned = roomSettingsRef.current.banned.some((b) => b.sessionId === sid);
          if (isBanned) {
            try {
              kickAction.send({ target: peerId, targetSid: sid, ban: true, by: profileRef.current.userName, ts: Date.now() });
            } catch {}
            setRemotePeers((prev) => {
              const next = { ...prev };
              delete next[peerId];
              return next;
            });
            return;
          }
          // limite de participantes: se passou, avisa e expulsa o excedente
          const max = roomSettingsRef.current.maxParticipants;
          if (max > 0) {
            const total = Object.keys(remotePeersRef.current).length + 1; // +eu
            if (total > max && !remotePeersRef.current[peerId]) {
              try {
                kickAction.send({ target: peerId, targetSid: sid, full: true, by: profileRef.current.userName, ts: Date.now() });
              } catch {}
            }
          }
          // manda as configs pra quem chegou
          broadcastSettings(peerId);
        }

        // anuncia entrada só 1x por sessão
        const announceKey = sid || peerId;
        if (!announcedSessions.has(announceKey) && name && name !== 'Convidado') {
          announcedSessions.add(announceKey);
          cbRef.current.onPeerJoinNotice(name);
        }
      };
    } catch {}

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
        setConnectionStatus('connected');

        // placeholder imediato (nome chega em seguida)
        setRemotePeers((prev) => {
          if (prev[peerId]) return prev;
          return {
            ...prev,
            [peerId]: {
              peerId,
              name: 'Conectando…',
              avatar: '',
              muted: true,
              sharing: false,
              cameraOn: false,
              lastSeen: Date.now(),
            },
          };
        });

        // manda perfil já + retries rápidos; streams e BETA
        broadcastProfile(peerId);
        [150, 500, 1200, 2500, 5000].forEach((ms) => {
          setTimeout(() => {
            if (cancelled) return;
            broadcastProfile(peerId);
            sendMediaTo(peerId);
            broadcastSettings(peerId);
            localStreamsRef.current.forEach(({ stream, kind }) => {
              try {
                room.addStream(stream, {
                  target: peerId,
                  metadata: { kind, owner: profileRef.current.userName },
                });
              } catch {}
            });
            tuneAll();
          }, ms);
        });

        // se em 8s ainda não veio nome, marca como "Convidado" (não some, não duplica)
        setTimeout(() => {
          if (cancelled) return;
          setRemotePeers((prev) => {
            const p = prev[peerId];
            if (!p || p.name !== 'Conectando…') return prev;
            return { ...prev, [peerId]: { ...p, name: 'Convidado' } };
          });
        }, 8000);
      };
    } catch {}

    try {
      (room as any).onPeerLeave = (peerId: string) => {
        if (cancelled) return;
        setRemotePeers((prev) => {
          const next = { ...prev };
          const left = next[peerId];
          delete next[peerId];
          // só avisa saída se a sessão não continuar viva em outro peerId (reconexão)
          if (left && left.name !== 'Conectando…') {
            const stillAlive = left.sessionId
              ? Object.values(next).some((p) => p.sessionId === left.sessionId)
              : false;
            if (!stillAlive) cbRef.current.onPeerLeaveNotice(left.name);
          }
          return next;
        });
        setRemoteStreams((prev) => {
          prev.filter((s) => s.peerId === peerId).forEach((s) => stopAudioFor(s.key));
          return prev.filter((s) => s.peerId !== peerId);
        });
      };
    } catch {}

    try {
      (room as any).onPeerStream = (stream: MediaStream, peerId: string, metadata: any) => {
        if (cancelled || !stream) return;
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

        // baixa latência no receptor
        try {
          const peers = room.getPeers ? room.getPeers() : {};
          const pc = peers?.[peerId];
          if (pc) tuneReceiversOnPc(pc);
          // 'contentHint' ajuda o decoder a priorizar fluidez
          liveVideo.forEach((t) => {
            try {
              if ('contentHint' in t && !t.contentHint) (t as any).contentHint = kind === 'screen' ? 'detail' : 'motion';
            } catch {}
          });
        } catch {}

        try {
          if (hasAudio && !audioElsRef.current.has(key)) {
            const audio = new Audio();
            audio.srcObject = stream;
            (audio as any).playsInline = true;
            audio.autoplay = true;
            audio.play().catch(() => {
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

        stream.getTracks().forEach((t) => {
          const prev = t.onended;
          t.onended = (e) => {
            try {
              (prev as any)?.(e);
            } catch {}
            const alive = stream.getTracks().some((x) => x.readyState === 'live');
            if (!alive) {
              setRemoteStreams((p) => p.filter((s) => s.key !== key));
              stopAudioFor(key);
            }
          };
        });

        setRemoteStreams((prev) => {
          const sameGroup = (a: string, b: string) => {
            if (a === 'mic' || b === 'mic') return a === b;
            if (a === 'unknown' || b === 'unknown') return true;
            return a === b;
          };
          const k = kind as string;
          prev
            .filter((s) => s.peerId === peerId && s.key !== key && sameGroup(s.kind as string, k))
            .forEach((d) => stopAudioFor(d.key));
          const next = prev.filter(
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

    // anúncio inicial agressivo
    [100, 400, 900, 1800, 3000, 5000, 8000].forEach((ms) => {
      setTimeout(() => {
        if (!cancelled) {
          broadcastProfile();
          setConnectionStatus('connected');
        }
      }, ms);
    });

    // keep-alive + re-tuning periódico (segura o bitrate, evita degradar → delay)
    let ticks = 0;
    const keepAlive = setInterval(() => {
      if (cancelled) return;
      ticks += 1;
      if (ticks <= 15 || ticks % 2 === 0) broadcastProfile();
      if (localStreamsRef.current.size > 0 && ticks % 3 === 0) tuneAll();
      // dono reenvia as configs (admins/permissões/bans) a cada 6s → todos sempre em dia
      if (isOwnerRef.current && ticks % 3 === 0) broadcastSettings();
    }, 2000);

    // fechou a aba / atualizou / trocou de página → avisa a sala antes de morrer
    const sendLeaveSignal = () => {
      try {
        signalAction.send({ kind: 'leave', byName: profileRef.current.userName, ts: Date.now() });
      } catch {}
      try {
        const cur = sharedMediaRef.current;
        if (cur && cur.leaderId === selfId) {
          mediaAction.send({ kind: 'clear', byName: profileRef.current.userName });
        }
      } catch {}
    };
    window.addEventListener('beforeunload', sendLeaveSignal);
    window.addEventListener('pagehide', sendLeaveSignal);

    return () => {
      cancelled = true;
      clearInterval(keepAlive);
      window.removeEventListener('beforeunload', sendLeaveSignal);
      window.removeEventListener('pagehide', sendLeaveSignal);
      // saindo (troca de sala / desmontou) → avisa antes de fechar
      sendLeaveSignal();
      const r = room;
      setTimeout(() => {
        try {
          r.leave?.();
        } catch {}
      }, 200);
      if (roomRef.current === room) {
        roomRef.current = null;
        actionsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, roomCode, userName]);

  useEffect(() => {
    if (!actionsRef.current?.profile || !enabled || !userName) return;
    // manda AGORA (sem esperar) + reforços → "Transmitindo tela" some na hora nos outros
    const send = () => {
      try {
        actionsRef.current?.profile?.send(myProfilePayload());
      } catch {}
    };
    send();
    const t1 = setTimeout(send, 300);
    const t2 = setTimeout(send, 1200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
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

  /** Aumenta o bitrate dos senders + baixa latência (usa a qualidade escolhida). */
  const boostSenders = useCallback((qualityLabel?: string) => {
    if (qualityLabel) qualityRef.current = qualityLabel;
    const q = (qualityRef.current || '').toLowerCase();
    const is4k = q.includes('4k') || q.includes('2160');
    const is1080 = q.includes('1080');
    const maxBitrate = is4k ? 12000000 : is1080 ? 5000000 : q.includes('720') ? 2500000 : 1500000;
    try {
      const room = roomRef.current;
      const peers = room?.getPeers ? room.getPeers() : {};
      Object.values(peers || {}).forEach((pc: any) => {
        tuneSendersOnPc(pc, { maxBitrate, keepRes: is4k });
        tuneReceiversOnPc(pc);
      });
    } catch {}
  }, []);

  const publishStream = useCallback(
    (stream: MediaStream, kind: 'screen' | 'camera' | 'mic', key?: string) => {
      const mapKey = key || `${kind}-${stream.id}`;
      localStreamsRef.current.set(mapKey, { stream, kind });

      // contentHint: tela = 'detail' (nitidez), câmera = 'motion' (fluidez)
      try {
        stream.getVideoTracks().forEach((t) => {
          if ('contentHint' in t) (t as any).contentHint = kind === 'screen' ? 'detail' : 'motion';
        });
        stream.getAudioTracks().forEach((t) => {
          if ('contentHint' in t) (t as any).contentHint = 'speech';
        });
      } catch {}

      const room = roomRef.current;
      if (!room) return;
      try {
        const r = room.addStream(stream, {
          metadata: { kind, owner: profileRef.current.userName },
        });
        if (Array.isArray(r)) r.forEach((p: any) => (p as Promise<void>)?.catch?.(() => {}));
      } catch {}
      // tuning logo após publicar + reforços (o WebRTC tenta baixar bitrate depois de segundos)
      [600, 1500, 3000, 6000, 10000].forEach((ms) => {
        setTimeout(() => {
          try {
            boostSenders();
          } catch {}
        }, ms);
      });
    },
    [boostSenders]
  );

  const unpublishStream = useCallback((stream: MediaStream, key?: string) => {
    let removedKind: string = 'all';
    if (key) {
      const entry = localStreamsRef.current.get(key);
      if (entry) removedKind = entry.kind;
      localStreamsRef.current.delete(key);
    } else {
      for (const [k, v] of localStreamsRef.current.entries()) {
        if (v.stream === stream) {
          removedKind = v.kind;
          localStreamsRef.current.delete(k);
        }
      }
    }
    try {
      roomRef.current?.removeStream?.(stream);
    } catch {}
    // para as tracks (o onended dispara no remoto) + avisa explicitamente → some na hora
    try {
      stream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
    } catch {}
    try {
      actionsRef.current?.signal?.send({
        kind: 'stop-stream',
        streamKind: removedKind,
        ts: Date.now(),
      });
    } catch {}
  }, []);

  /** Avisa todo mundo que saí (a lista e os vídeos somem na hora) e fecha tudo local. */
  const leaveRoom = useCallback(() => {
    // avisa a sala
    try {
      actionsRef.current?.signal?.send({
        kind: 'leave',
        byName: profileRef.current.userName,
        ts: Date.now(),
      });
    } catch {}
    // se eu era o líder do vídeo BETA, encerro pra todos
    try {
      const cur = sharedMediaRef.current;
      if (cur && cur.leaderId === selfId) {
        actionsRef.current?.media?.send({ kind: 'clear', byName: profileRef.current.userName });
      }
    } catch {}
    // para e remove todas as minhas transmissões
    try {
      localStreamsRef.current.forEach(({ stream }) => {
        try {
          roomRef.current?.removeStream?.(stream);
        } catch {}
        try {
          stream.getTracks().forEach((t) => t.stop());
        } catch {}
      });
    } catch {}
    localStreamsRef.current.clear();
    // dá alguns ms pro sinal sair antes de fechar a conexão
    const room = roomRef.current;
    roomRef.current = null;
    actionsRef.current = null;
    setTimeout(() => {
      try {
        room?.leave?.();
      } catch {}
    }, 250);
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

  const kickPeer = useCallback((targetPeerId: string, targetName: string) => {
    const sid = remotePeersRef.current[targetPeerId]?.sessionId;
    try {
      actionsRef.current?.kick?.send({
        target: targetPeerId,
        targetSid: sid,
        by: profileRef.current.userName,
        ts: Date.now(),
      });
    } catch {}
    setRemotePeers((prev) => {
      const next = { ...prev };
      delete next[targetPeerId];
      return next;
    });
    setRemoteStreams((prev) => {
      prev.filter((s) => s.peerId === targetPeerId).forEach((s) => stopAudioFor(s.key));
      return prev.filter((s) => s.peerId !== targetPeerId);
    });
    return targetName;
  }, []);

  // ---------- GERÊNCIA DA SALA (só dono) ----------
  const pushSettings = useCallback((updater: (s: RoomSettings) => RoomSettings) => {
    const next = updater(roomSettingsRef.current);
    const bumped: RoomSettings = {
      ...next,
      ownerSessionId: MY_SESSION_ID,
      ownerName: profileRef.current.userName,
      version: (roomSettingsRef.current.version || 0) + 1,
    };
    roomSettingsRef.current = bumped;
    setRoomSettings(bumped);
    const send = () => {
      try {
        if (broadcastSettingsRef.current) broadcastSettingsRef.current();
        else actionsRef.current?.settings?.send(roomSettingsRef.current as any);
      } catch {}
    };
    // envia já + reforços (garante que chegue em tempo real pra todos)
    send();
    [250, 800, 2000, 4000].forEach((ms) => setTimeout(send, ms));
    return bumped;
  }, []);

  /** capacidades minhas AGORA (dono = tudo; admin = pelo nível + toggles) */
  const myCapsNow = () => computeAdminCaps(roomSettingsRef.current, MY_SESSION_ID, isOwnerRef.current);

  /** admin manda um pedido pro dono aplicar (o dono valida o nível antes). */
  const sendAdminReq = (payload: Record<string, unknown>) => {
    try {
      actionsRef.current?.adminReq?.send({
        ...payload,
        by: profileRef.current.userName,
        bySid: MY_SESSION_ID,
        ts: Date.now(),
      });
    } catch {}
  };

  const setPermission = useCallback(
    (key: keyof RoomSettings['permissions'], value: boolean) => {
      if (isOwnerRef.current) {
        pushSettings((s) => ({ ...s, permissions: { ...s.permissions, [key]: value } }));
        return;
      }
      // LV3 pode mexer em permissões — MENOS nos toggles de nível/coroa do dono (só dono)
      const locked: Array<keyof RoomSettings['permissions']> = ['adminLv1', 'adminLv2', 'adminLv3', 'showOwnerCrown'];
      if (myCapsNow().permissions && !locked.includes(key)) {
        sendAdminReq({ kind: 'setPermission', key, value });
      }
    },
    [pushSettings]
  );

  const setMaxParticipants = useCallback(
    (max: number) => {
      const clean = Math.max(0, Math.floor(max || 0));
      if (isOwnerRef.current) {
        pushSettings((s) => ({ ...s, maxParticipants: clean }));
        return;
      }
      if (myCapsNow().limit) sendAdminReq({ kind: 'setMax', max: clean });
    },
    [pushSettings]
  );

  const toggleAdmin = useCallback(
    (sessionId: string) => {
      if (!sessionId) return;
      if (sessionId === roomSettingsRef.current.ownerSessionId) return; // dono não é "admin"
      if (isOwnerRef.current) {
        pushSettings((s) => {
          const has = s.admins.includes(sessionId);
          const levels = { ...(s.adminLevels || {}) };
          if (has) delete levels[sessionId];
          else levels[sessionId] = 1;
          return {
            ...s,
            admins: has ? s.admins.filter((a) => a !== sessionId) : [...s.admins, sessionId],
            adminLevels: levels,
          };
        });
        return;
      }
      // LV2/LV3 podem gerenciar admins (nunca a si mesmos, nunca o dono)
      if (myCapsNow().admins && sessionId !== MY_SESSION_ID) {
        sendAdminReq({ kind: 'toggleAdmin', targetSid: sessionId });
      }
    },
    [pushSettings]
  );

  /** Define o nível (1|2|3) de um admin. Dono direto; LV2/LV3 pedem (só pra níveis ≤ o próprio). */
  const setAdminLevel = useCallback(
    (sessionId: string, level: AdminLevel) => {
      if (!sessionId) return;
      const lv = (Math.min(3, Math.max(1, Math.floor(level))) as AdminLevel) || 1;
      if (isOwnerRef.current) {
        pushSettings((s) => ({
          ...s,
          admins: s.admins.includes(sessionId) ? s.admins : [...s.admins, sessionId],
          adminLevels: { ...(s.adminLevels || {}), [sessionId]: lv },
        }));
        return;
      }
      const myLv = (roomSettingsRef.current.adminLevels?.[MY_SESSION_ID] as AdminLevel) || 1;
      if (myCapsNow().admins && sessionId !== MY_SESSION_ID && lv <= myLv) {
        sendAdminReq({ kind: 'setAdminLevel', targetSid: sessionId, level: lv });
      }
    },
    [pushSettings]
  );

  /** Remove localmente um peer (usado por kick/ban). */
  const dropPeerLocally = useCallback((targetPeerId: string) => {
    setRemotePeers((prev) => {
      const next = { ...prev };
      delete next[targetPeerId];
      return next;
    });
    setRemoteStreams((prev) => {
      prev.filter((s) => s.peerId === targetPeerId).forEach((s) => stopAudioFor(s.key));
      return prev.filter((s) => s.peerId !== targetPeerId);
    });
  }, []);

  const isAdminSession = (sid: string) => roomSettingsRef.current.admins.includes(sid);
  const amAdminNow = () => isOwnerRef.current || isAdminSession(MY_SESSION_ID);

  const banPeer = useCallback(
    (targetPeerId: string, targetName: string) => {
      const sid = remotePeersRef.current[targetPeerId]?.sessionId || `peer-${targetPeerId}`;
      // ninguém bane o dono
      if (sid && sid === roomSettingsRef.current.ownerSessionId) return;

      if (isOwnerRef.current) {
        pushSettings((s) => ({
          ...s,
          admins: s.admins.filter((a) => a !== sid),
          banned: s.banned.some((b) => b.sessionId === sid)
            ? s.banned
            : [...s.banned, { sessionId: sid, name: targetName, bannedAt: Date.now(), by: profileRef.current.userName }],
        }));
        try {
          actionsRef.current?.kick?.send({
            target: targetPeerId,
            targetSid: sid,
            ban: true,
            by: profileRef.current.userName,
            ts: Date.now(),
          });
        } catch {}
        dropPeerLocally(targetPeerId);
        return;
      }

      // ADMIN com poder de banir (toggle antigo OU nível LV2/LV3): kick direto + dono registra
      if (myCapsNow().ban) {
        try {
          actionsRef.current?.kick?.send({
            target: targetPeerId,
            targetSid: sid,
            ban: true,
            by: profileRef.current.userName,
            ts: Date.now(),
          });
        } catch {}
        try {
          actionsRef.current?.adminReq?.send({
            kind: 'ban',
            targetSid: sid,
            targetName,
            by: profileRef.current.userName,
            bySid: MY_SESSION_ID,
            ts: Date.now(),
          });
        } catch {}
        dropPeerLocally(targetPeerId);
      }
    },
    [pushSettings, dropPeerLocally]
  );

  /** Expulsa (sem banir). Dono sempre pode; admin só com adminCanKick. */
  const kickAsAdmin = useCallback(
    (targetPeerId: string, targetName: string) => {
      const sid = remotePeersRef.current[targetPeerId]?.sessionId;
      if (sid && sid === roomSettingsRef.current.ownerSessionId) return targetName;
      if (!myCapsNow().kick) return targetName;
      try {
        actionsRef.current?.kick?.send({
          target: targetPeerId,
          targetSid: sid,
          by: profileRef.current.userName,
          ts: Date.now(),
        });
      } catch {}
      dropPeerLocally(targetPeerId);
      return targetName;
    },
    [dropPeerLocally]
  );

  const unbanSession = useCallback(
    (sessionId: string) => {
      if (isOwnerRef.current) {
        pushSettings((s) => ({ ...s, banned: s.banned.filter((b) => b.sessionId !== sessionId) }));
        return;
      }
      if (myCapsNow().ban) {
        try {
          actionsRef.current?.adminReq?.send({
            kind: 'unban',
            targetSid: sessionId,
            by: profileRef.current.userName,
            bySid: MY_SESSION_ID,
            ts: Date.now(),
          });
        } catch {}
      }
    },
    [pushSettings]
  );

  // sou admin? (dono sempre é)
  const amAdmin = isOwner || roomSettings.admins.includes(MY_SESSION_ID);

  /** posso fazer X? true se permissão liberada OU sou dono/admin */
  const can = useCallback(
    (key: keyof RoomSettings['permissions']) => {
      if (isOwnerRef.current) return true;
      if (roomSettingsRef.current.admins.includes(MY_SESSION_ID)) return true;
      return !!roomSettingsRef.current.permissions[key];
    },
    []
  );

  /** minhas capacidades de gerência (reativo) */
  const myCaps = computeAdminCaps(roomSettings, MY_SESSION_ID, isOwner);
  const myAdminLevel: AdminLevel = isOwner
    ? 3
    : ((roomSettings.adminLevels?.[MY_SESSION_ID] as AdminLevel) || 1);
  /** admin com poder de banir? */
  const canBan = myCaps.ban;
  /** admin com poder de expulsar? */
  const canKick = myCaps.kick;
  void amAdminNow;
  void isAdminSession;

  const broadcastMedia = useCallback((media: SharedMediaPayload) => {
    setSharedMedia(media);
    try {
      actionsRef.current?.media?.send({ kind: 'set', media });
    } catch {}
  }, []);

  const clearMedia = useCallback((byName: string) => {
    setSharedMedia(null);
    try {
      actionsRef.current?.media?.send({ kind: 'clear', byName });
    } catch {}
  }, []);

  // lista deduplicada por sessão (garantia extra contra "mesmo nome 2x")
  const remotePeersList = (() => {
    const bySession = new Map<string, RemotePeerProfile>();
    const noSession: RemotePeerProfile[] = [];
    Object.values(remotePeers).forEach((p) => {
      if (!p.sessionId) {
        noSession.push(p);
        return;
      }
      const cur = bySession.get(p.sessionId);
      if (!cur || p.lastSeen > cur.lastSeen) bySession.set(p.sessionId, p);
    });
    return [...bySession.values(), ...noSession];
  })();

  return {
    remotePeers,
    remoteStreams,
    remotePeersList,
    connectionStatus,
    peerCount: remotePeersList.length,
    sendChat,
    publishStream,
    unpublishStream,
    cleanupRoom,
    leaveRoom,
    kickPeer,
    boostSenders,
    myPeerId: selfId as string,
    mySessionId: MY_SESSION_ID,
    sharedMedia,
    broadcastMedia,
    clearMedia,
    // gerência da sala
    roomSettings,
    amAdmin,
    can,
    canBan,
    canKick,
    myCaps,
    myAdminLevel,
    setPermission,
    setMaxParticipants,
    toggleAdmin,
    setAdminLevel,
    banPeer,
    kickAsAdmin,
    unbanSession,
  };
}
