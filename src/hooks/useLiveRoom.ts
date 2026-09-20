import { useCallback, useEffect, useRef, useState } from 'react';
import { joinRoom, selfId } from 'trystero';
import type { ChatMessage, SharedMediaPayload } from '../types';

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
}: UseLiveRoomOptions) {
  const [remotePeers, setRemotePeers] = useState<Record<string, RemotePeerProfile>>({});
  const [remoteStreams, setRemoteStreams] = useState<RemoteStreamInfo[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected'>('idle');
  const [sharedMedia, setSharedMedia] = useState<SharedMediaPayload | null>(null);

  const roomRef = useRef<any>(null);
  const actionsRef = useRef<{ profile?: any; chat?: any; kick?: any; media?: any } | null>(null);
  const localStreamsRef = useRef<Map<string, { stream: MediaStream; kind: string }>>(new Map());
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const roomCodeRef = useRef(roomCode);
  roomCodeRef.current = roomCode;

  const cbRef = useRef({ onRemoteChat, onPeerJoinNotice, onPeerLeaveNotice, onKicked, onMediaNotice });
  cbRef.current = { onRemoteChat, onPeerJoinNotice, onPeerLeaveNotice, onKicked, onMediaNotice };

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
    actionsRef.current = { profile: profileAction, chat: chatAction, kick: kickAction, media: mediaAction };

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
        // manda perfil + streams + vídeo BETA para quem chegou (com retries)
        [300, 1200, 2500].forEach((ms) => {
          setTimeout(() => {
            if (cancelled) return;
            broadcastProfile(peerId);
            sendMediaTo(peerId);
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
        if (Array.isArray(r)) r.forEach((p: any) => (p as Promise<void>)?.catch?.(() => {}));
      } catch {}
      // reforça bitrate alto logo após publicar (evita WebRTC derrubar p/ 1080p)
      setTimeout(() => {
        try {
          const peers = room?.getPeers ? room.getPeers() : {};
          Object.values(peers || {}).forEach((pc: any) => {
            try {
              const senders = pc?.getSenders ? pc.getSenders() : [];
              (senders || []).forEach((sender: any) => {
                try {
                  if (!sender?.track || sender.track.kind !== 'video') return;
                  const params = sender.getParameters ? sender.getParameters() : {};
                  if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
                  params.encodings = params.encodings.map((e: any) => ({
                    ...e,
                    maxBitrate: 8000000,
                    scaleResolutionDownBy: 1,
                  }));
                  try {
                    params.degradationPreference = 'maintain-resolution';
                  } catch {}
                  if (sender.setParameters) sender.setParameters(params).catch(() => {});
                } catch {}
              });
            } catch {}
          });
        } catch {}
      }, 900);
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

  /** Aumenta o bitrate dos senders de vídeo (4K/1080p real). */
  const boostSenders = useCallback((qualityLabel?: string) => {
    const q = (qualityLabel || '').toLowerCase();
    const is4k = q.includes('4k') || q.includes('2160');
    const is1080 = q.includes('1080');
    const maxBitrate = is4k ? 12000000 : is1080 ? 5000000 : q.includes('720') ? 2500000 : 1500000;
    const degradation = is4k || is1080 ? 'maintain-resolution' : ('balanced' as any);
    try {
      const room = roomRef.current;
      const peers = room?.getPeers ? room.getPeers() : {};
      Object.values(peers || {}).forEach((pc: any) => {
        try {
          const senders = pc?.getSenders ? pc.getSenders() : [];
          (senders || []).forEach((sender: any) => {
            try {
              if (!sender?.track || sender.track.kind !== 'video') return;
              const params = sender.getParameters ? sender.getParameters() : {};
              if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
              params.encodings = params.encodings.map((e: any) => ({
                ...e,
                maxBitrate,
                ...(is4k ? { scaleResolutionDownBy: 1 } : {}),
              }));
              try {
                params.degradationPreference = degradation;
              } catch {}
              if (sender.setParameters) {
                sender.setParameters(params).catch(() => {});
              }
            } catch {}
          });
        } catch {}
      });
    } catch {}
  }, []);

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
  };
}
