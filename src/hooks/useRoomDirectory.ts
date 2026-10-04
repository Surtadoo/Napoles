import { useEffect, useRef, useCallback } from 'react';
import { joinRoom } from 'trystero';
import { loadAllRooms, mergeIncomingRooms, removeRoomFromOthers, type RecentRoom } from '../utils/lobby';

/**
 * DIRETÓRIO DE SALAS COMPARTILHADO (P2P)
 * --------------------------------------
 * Um site estático NÃO consegue gravar arquivo no servidor. Então, pra todo mundo ver
 * as salas públicas/privadas que qualquer pessoa criou, usamos o mesmo P2P da call:
 * todo navegador que abre o LiveDC entra num "canal de diretório" global e troca a
 * lista de salas com quem estiver online. Quem entra depois recebe a lista de quem já
 * estava. Cada navegador guarda a cópia no seu arquivo local (espelho), então a lista
 * vai se espalhando e sobrevive mesmo se o criador sair.
 *
 * Senhas de salas privadas NÃO são enviadas — só o hash pra validar.
 */

const DIR_APP_ID = 'livedc-directory-v1';
const DIR_ROOM = 'livedc-global-rooms-directory';

const RELAYS = [
  'wss://nostr.wine',
  'wss://relay.primal.net',
  'wss://purplepag.es',
  'wss://nos.lol',
  'wss://nostr.bitcoiner.social',
  'wss://relay.snort.social',
  'wss://nostr.mom',
  'wss://offchain.pub',
  'wss://relay.nostr.net',
];

/** versão "pública" da sala: sem senha em texto, sem flags pessoais */
export interface DirectoryRoom {
  name: string;
  code: string;
  type: 'public' | 'private';
  pwHash?: string;
  lat?: number;
  lng?: number;
  place?: string;
  createdAt?: number;
  createdBy?: string;
  lastJoined?: number;
  visible?: boolean;
  /** true = criador pediu pra remover a sala do diretório */
  removed?: boolean;
}

function hashPassword(pw: string): string {
  const s = (pw || '').trim();
  if (!s) return '';
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36);
}

function toDirectory(r: RecentRoom): DirectoryRoom | null {
  if (r.visible === false) return null; // invisível não vai pro diretório
  return {
    name: r.name,
    code: r.code,
    type: r.type,
    pwHash: r.type === 'private' && r.password ? hashPassword(r.password) : r.pwHash,
    lat: r.lat,
    lng: r.lng,
    place: r.place,
    createdAt: r.createdAt,
    createdBy: r.createdBy,
    lastJoined: r.lastJoined,
    visible: true,
  };
}

interface Options {
  enabled: boolean;
  onUpdated: () => void;
}

export function useRoomDirectory({ enabled, onUpdated }: Options) {
  const roomRef = useRef<any>(null);
  const actionRef = useRef<any>(null);
  const leavingRef = useRef<Promise<void> | null>(null);
  const onUpdatedRef = useRef(onUpdated);
  onUpdatedRef.current = onUpdated;

  /** minha lista pública (o que eu conheço) */
  const snapshot = useCallback((): DirectoryRoom[] => {
    return loadAllRooms()
      .map(toDirectory)
      .filter(Boolean) as DirectoryRoom[];
  }, []);

  const broadcast = useCallback((target?: string) => {
    const a = actionRef.current;
    if (!a) return;
    const rooms = snapshot();
    if (rooms.length === 0) return;
    try {
      if (target) a.send({ kind: 'rooms', rooms }, { target } as any);
      else a.send({ kind: 'rooms', rooms });
    } catch {}
  }, [snapshot]);

  /** avisa todo mundo que uma sala foi apagada (some da lista deles na hora) */
  const broadcastDelete = useCallback((code: string, ownerId: string) => {
    const a = actionRef.current;
    if (!a) return;
    const send = () => {
      try {
        a.send({ kind: 'delete', code, ownerId, ts: Date.now() });
      } catch {}
    };
    send();
    [400, 1500, 4000].forEach((ms) => setTimeout(send, ms));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let room: any = null;
    let iv: ReturnType<typeof setInterval> | null = null;

    // espera a saída anterior terminar (mesmo motivo do useLiveRoom: o trystero
    // reutiliza a instância enquanto `leave()` não completou → StrictMode entregava
    // um canal já fechado e o diretório parava de sincronizar)
    const prevLeaving = leavingRef.current;

    const doJoin = () => {
      if (cancelled) return;
      try {
        room = joinRoom(
          {
            appId: DIR_APP_ID,
            relayConfig: { urls: RELAYS, redundancy: RELAYS.length } as any,
            trickleIce: true,
          } as any,
          DIR_ROOM
        );
      } catch {
        return;
      }
      roomRef.current = room;
      const action = room.makeAction('livedc-dir-v1');
      actionRef.current = action;

      try {
        (action as any).onMessage = (data: any) => {
          if (cancelled || !data) return;
          if (data.kind === 'delete' && typeof data.code === 'string') {
            const changed = removeRoomFromOthers(data.code);
            if (changed) onUpdatedRef.current?.();
            return;
          }
          if (data.kind !== 'rooms' || !Array.isArray(data.rooms)) return;
          const changed = mergeIncomingRooms(data.rooms);
          if (changed) onUpdatedRef.current?.();
        };
      } catch {}

      try {
        (room as any).onPeerJoin = (peerId: string) => {
          if (cancelled) return;
          [200, 900, 2500].forEach((ms) => setTimeout(() => !cancelled && broadcast(peerId), ms));
        };
      } catch {}

      [500, 2000, 5000].forEach((ms) => setTimeout(() => !cancelled && broadcast(), ms));
      iv = setInterval(() => !cancelled && broadcast(), 20000);
    };

    if (prevLeaving) prevLeaving.then(doJoin, doJoin);
    else doJoin();

    return () => {
      cancelled = true;
      if (iv) clearInterval(iv);
      const r = room;
      if (r) {
        let p: Promise<any>;
        try {
          p = Promise.resolve(r.leave?.());
        } catch {
          p = Promise.resolve();
        }
        const wrapped: Promise<void> = p
          .catch(() => {})
          .then(() => new Promise<void>((res) => setTimeout(res, 150)))
          .then(() => {
            if (leavingRef.current === wrapped) leavingRef.current = null;
          });
        leavingRef.current = wrapped;
      }
      roomRef.current = null;
      actionRef.current = null;
    };
  }, [enabled, broadcast]);

  /** chama depois de criar/alterar uma sala → espalha pra todo mundo agora */
  const publishNow = useCallback(() => {
    broadcast();
    [400, 1500].forEach((ms) => setTimeout(() => broadcast(), ms));
  }, [broadcast]);

  return { publishNow, broadcastDelete };
}
