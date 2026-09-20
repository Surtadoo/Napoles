import { useCallback, useEffect, useRef, useState } from 'react';
import { joinRoom } from 'trystero';
import type { ChatMessage } from '../types';

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
}: UseLiveRoomOptions) {
  const [remotePeers, setRemotePeers] = useState<Record<string, RemotePeerProfile>>({});
  const [remoteStreams, setRemoteStreams] = useState<RemoteStreamInfo[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected'>('idle');

  const roomRef = useRef<any>(null);
  const actionsRef = useRef<{ profile?: any; chat?: any } | null>(null);
  const localStreamsRef = useRef<Map<string, { stream: MediaStream; kind: string }>>(new Map());
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const roomCodeRef = useRef(roomCode);
  roomCodeRef.current = roomCode;

  const cbRef = useRef({ onRemoteChat, onPeerJoinNotice, onPeerLeaveNotice });
  cbRef.current = { onRemoteChat, onPeerJoinNotice, onPeerLeaveNotice };

  const profileRef = useRef({ userName, userAvatar, isMuted, isSharing, isCameraOn });
  profileRef.current = { userName, userAvatar, isMuted, isSharing, isCameraOn };

  const remotePeersRef = useRef<Record<string, RemotePeerProfile>>({});
  remotePeersRef.current = remotePeers;

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
    setConnectionStatus('idle');
  }, []);

  // ---- join / rejoin quando roomCode ou userName muda ----
  useEffect(() => {
    if (!enabled || !roomCode || !userName) return;

    let cancelled = false;
    setConnectionStatus('connecting');
    setRemotePeers({});
    setRemoteStreams([]);

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
    actionsRef.current = { profile: profileAction, chat: chatAction };

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

    try {
      (profileAction as any).onMessage = (data: any, meta: any) => {
        const peerId = meta?.peerId || (typeof meta === 'string' ? meta : null);
        if (!peerId || cancelled || !data) return;
        const name = String(data?.name || 'Convidado').slice(0, 24);
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
        // avisa entrada quando é perfil novo
        setRemotePeers((prev) => {
          return prev;
        });
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
        // manda perfil + streams para quem chegou (com retries)
        [300, 1200, 2500].forEach((ms) => {
          setTimeout(() => {
            if (cancelled) return;
            broadcastProfile(peerId);
            localStreamsRef.current.forEach(({ stream, kind }) => {
              try {
                room.addStream(stream, {
                  target: peerId,
                  metadata: { kind, owner: profileRef.current.userName },
                });
              } catch {}
            });
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
            // só anuncia se já temos nome, senão o perfil que chegar vai atualizar a lista
            if (known && known.name !== 'Convidado') cbRef.current.onPeerJoinNotice(known.name);
            else {
              // agenda verificação
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
        setRemotePeers((prev) => {
          const next = { ...prev };
          const left = next[peerId];
          delete next[peerId];
          if (left) cbRef.current.onPeerLeaveNotice(left.name);
          return next;
        });
        setRemoteStreams((prev) => prev.filter((s) => s.peerId !== peerId));
        const audio = audioElsRef.current.get(peerId);
        if (audio) {
          try {
            audio.pause();
            audio.srcObject = null;
          } catch {}
          audioElsRef.current.delete(peerId);
        }
      };
    } catch {}

    try {
      (room as any).onPeerStream = (stream: MediaStream, peerId: string, metadata: any) => {
        if (cancelled || !stream) return;
        const kind =
          metadata?.kind === 'screen' || metadata?.kind === 'camera' || metadata?.kind === 'mic'
            ? metadata.kind
            : stream.getVideoTracks().length > 0
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

        stream.getTracks().forEach((t) => {
          const prev = t.onended;
          t.onended = (e) => {
            try {
              (prev as any)?.(e);
            } catch {}
            const alive = stream.getTracks().some((x) => x.readyState === 'live');
            if (!alive) {
              setRemoteStreams((p) => p.filter((s) => s.key !== key));
              const a = audioElsRef.current.get(key);
              if (a) {
                try {
                  a.pause();
                } catch {}
                audioElsRef.current.delete(key);
              }
            }
          };
        });

        setRemoteStreams((prev) => {
          if (prev.some((s) => s.key === key)) {
            return prev.map((s) => (s.key === key ? { ...s, stream, kind: kind as any, ownerName } : s));
          }
          return [...prev, { key, peerId, stream, kind: kind as any, ownerName }];
        });
        setConnectionStatus('connected');
      };
    } catch {}

    // anúncio inicial agressivo (importante pra mobile que entra depois)
    [500, 1500, 3000, 5000].forEach((ms) => {
      setTimeout(() => {
        if (!cancelled) {
          broadcastProfile();
          setConnectionStatus('connected');
        }
      }, ms);
    });

    const keepAlive = setInterval(() => {
      if (!cancelled) broadcastProfile();
    }, 4000);

    return () => {
      cancelled = true;
      clearInterval(keepAlive);
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
      try {
        const r = room.addStream(stream, {
          metadata: { kind, owner: profileRef.current.userName },
        });
        // addStream retorna array de promises
        if (Array.isArray(r)) r.forEach((p: any) => (p as Promise<void>)?.catch?.(() => {}));
      } catch {}
    },
    []
  );

  const unpublishStream = useCallback((stream: MediaStream, key?: string) => {
    if (key) localStreamsRef.current.delete(key);
    else {
      for (const [k, v] of localStreamsRef.current.entries()) {
        if (v.stream === stream) localStreamsRef.current.delete(k);
      }
    }
    try {
      roomRef.current?.removeStream?.(stream);
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
  };
}
