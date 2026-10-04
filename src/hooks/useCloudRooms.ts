import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cloudLoadRooms,
  cloudSaveRoom,
  cloudPatchRoom,
  cloudDeleteRoom,
  cloudPing,
  isCloudConfigured,
} from '../utils/cloudRooms';
import { replaceFromCloud, findSavedRoom } from '../utils/lobby';

export type CloudStatus = 'checking' | 'ok' | 'off' | 'error';

interface Options {
  onUpdated: () => void;
  /** id estável deste navegador (dono das salas que cria) */
  ownerId: string;
}

/**
 * Sincroniza o arquivo local com o BANCO NA NUVEM.
 * - Ao abrir: baixa tudo.
 * - A cada 8s: baixa de novo (salas novas de outras pessoas aparecem sozinhas).
 * - Ao criar/alterar/apagar: grava na hora e baixa em seguida.
 */
export function useCloudRooms({ onUpdated, ownerId }: Options) {
  const [status, setStatus] = useState<CloudStatus>('checking');
  const onUpdatedRef = useRef(onUpdated);
  onUpdatedRef.current = onUpdated;
  const busyRef = useRef(false);

  const pull = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const rooms = await cloudLoadRooms();
      if (rooms === null) {
        setStatus(isCloudConfigured() ? 'error' : 'off');
        return;
      }
      setStatus('ok');
      const changed = replaceFromCloud(rooms);
      if (changed) onUpdatedRef.current?.();
    } finally {
      busyRef.current = false;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const p = await cloudPing();
      if (!alive) return;
      setStatus(p === 'ok' ? 'ok' : p);
      if (p === 'ok') pull();
    })();
    const iv = setInterval(() => {
      if (document.visibilityState === 'visible') pull();
    }, 8000);
    const onVis = () => {
      if (document.visibilityState === 'visible') pull();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false;
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [pull]);

  /** grava a sala (do arquivo local) no banco */
  const push = useCallback(
    async (code: string) => {
      const r = findSavedRoom(code);
      if (!r) return false;
      const ok = await cloudSaveRoom(r, r.createdByMe ? ownerId : undefined);
      if (ok) {
        setStatus('ok');
        setTimeout(() => pull(), 600);
      }
      return ok;
    },
    [ownerId, pull]
  );

  const patch = useCallback(
    async (code: string, fields: { lat?: number; lng?: number; place?: string; name?: string; visible?: boolean }) => {
      const ok = await cloudPatchRoom(code, fields, ownerId);
      if (ok) setTimeout(() => pull(), 600);
      return ok;
    },
    [pull, ownerId]
  );

  const remove = useCallback(
    async (code: string) => {
      const ok = await cloudDeleteRoom(code, ownerId);
      if (ok) setTimeout(() => pull(), 400);
      return ok;
    },
    [pull, ownerId]
  );

  return { status, pull, push, patch, remove };
}
