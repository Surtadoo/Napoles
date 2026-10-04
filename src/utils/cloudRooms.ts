import type { RecentRoom } from './lobby';

/**
 * BANCO DE SALAS NA NUVEM
 * -----------------------
 * Padrão (zero config): a API do PRÓPRIO site → /api/rooms
 *   (Cloudflare Pages Function + KV; veja functions/api/rooms.ts e CLOUDFLARE.md)
 * Opcional: Firebase Realtime Database, se public/livedc-config.json tiver databaseUrl.
 *
 * Toda sala criada é GRAVADA aqui e todo mundo (qualquer rede) LÊ daqui.
 * A senha nunca vai pro banco — só o hash.
 */

export interface CloudRoom {
  name: string;
  code: string;
  type: 'public' | 'private';
  pwHash?: string;
  lat?: number;
  lng?: number;
  place?: string;
  createdAt: number;
  createdBy?: string;
  updatedAt: number;
  visible: boolean;
  ownerId?: string;
}

type Backend =
  | { kind: 'pages' }
  | { kind: 'firebase'; databaseUrl: string; path: string }
  | { kind: 'none' };

let backendCache: Backend | undefined;

function normalizeUrl(u: string): string {
  return (u || '').trim().replace(/\/+$/, '');
}
function normalizePath(p: string): string {
  return (p || 'livedc/rooms').trim().replace(/^\/+|\/+$/g, '');
}

/** Descobre qual backend usar: Firebase (se configurado) → API do site → nenhum. */
export async function detectBackend(): Promise<Backend> {
  if (backendCache) return backendCache;

  // 1) Firebase opcional
  try {
    const res = await fetch(`/livedc-config.json?v=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const j = await res.json();
      const databaseUrl = normalizeUrl(String(j?.databaseUrl || ''));
      if (/^https:\/\/.+firebase(io|database)\.(com|app)/i.test(databaseUrl)) {
        backendCache = { kind: 'firebase', databaseUrl, path: normalizePath(String(j?.path || 'livedc/rooms')) };
        return backendCache;
      }
    }
  } catch {
    // segue
  }

  // 2) API do próprio site (Pages Function + KV)
  try {
    const res = await fetch(`/api/rooms?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const j = await res.json().catch(() => null);
      if (j && Array.isArray(j.rooms)) {
        backendCache = { kind: 'pages' };
        return backendCache;
      }
    }
    // 503 = função existe mas KV não ligado; 404 = sem função (ex.: preview local)
  } catch {
    // segue
  }

  backendCache = { kind: 'none' };
  return backendCache;
}

export function resetBackendCache() {
  backendCache = undefined;
}

function clean<T extends Record<string, any>>(o: T): T {
  const out: any = {};
  Object.keys(o).forEach((k) => {
    if (o[k] !== undefined) out[k] = o[k];
  });
  return out;
}

function toCloud(r: RecentRoom, ownerId?: string): CloudRoom {
  return {
    name: r.name,
    code: r.code,
    type: r.type,
    pwHash: r.pwHash,
    lat: typeof r.lat === 'number' ? r.lat : undefined,
    lng: typeof r.lng === 'number' ? r.lng : undefined,
    place: r.place,
    createdAt: r.createdAt || r.lastJoined || Date.now(),
    createdBy: r.createdBy,
    updatedAt: Date.now(),
    visible: r.visible !== false,
    ownerId,
  };
}

function fbUrl(b: Extract<Backend, { kind: 'firebase' }>, code?: string) {
  const base = `${b.databaseUrl}/${b.path}`;
  return code ? `${base}/${encodeURIComponent(code)}.json` : `${base}.json`;
}

/** GRAVA (cria/atualiza) */
export async function cloudSaveRoom(r: RecentRoom, ownerId?: string): Promise<boolean> {
  const b = await detectBackend();
  if (b.kind === 'none') return false;
  const body = clean(toCloud(r, ownerId));
  try {
    if (b.kind === 'pages') {
      const res = await fetch(`/api/rooms/${encodeURIComponent(r.code)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return res.ok;
    }
    const res = await fetch(fbUrl(b, r.code), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Atualiza alguns campos (ex.: posição no mapa) */
export async function cloudPatchRoom(
  code: string,
  patch: Partial<CloudRoom>,
  ownerId?: string
): Promise<boolean> {
  const b = await detectBackend();
  if (b.kind === 'none') return false;
  const body = clean({ ...patch, updatedAt: Date.now(), ownerId });
  try {
    if (b.kind === 'pages') {
      const res = await fetch(`/api/rooms/${encodeURIComponent(code)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return res.ok;
    }
    const res = await fetch(fbUrl(b, code), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** APAGA */
export async function cloudDeleteRoom(code: string, ownerId?: string): Promise<boolean> {
  const b = await detectBackend();
  if (b.kind === 'none') return false;
  try {
    if (b.kind === 'pages') {
      const res = await fetch(
        `/api/rooms/${encodeURIComponent(code)}?ownerId=${encodeURIComponent(ownerId || '')}`,
        { method: 'DELETE' }
      );
      return res.ok;
    }
    const res = await fetch(fbUrl(b, code), { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}

function parseRooms(list: any): CloudRoom[] {
  const out: CloudRoom[] = [];
  const values: any[] = Array.isArray(list) ? list : Object.values(list || {});
  values.forEach((v: any) => {
    if (!v || typeof v.code !== 'string' || !/^\d{4,10}$/.test(v.code)) return;
    out.push({
      name: String(v.name || `Sala ${v.code}`).slice(0, 48),
      code: v.code,
      type: v.type === 'public' ? 'public' : 'private',
      pwHash: v.pwHash ? String(v.pwHash) : undefined,
      lat: typeof v.lat === 'number' ? v.lat : undefined,
      lng: typeof v.lng === 'number' ? v.lng : undefined,
      place: v.place ? String(v.place).slice(0, 60) : undefined,
      createdAt: Number(v.createdAt || 0),
      createdBy: v.createdBy ? String(v.createdBy).slice(0, 24) : undefined,
      updatedAt: Number(v.updatedAt || 0),
      visible: v.visible !== false,
      ownerId: v.ownerId ? String(v.ownerId) : undefined,
    });
  });
  return out;
}

/** LÊ todas */
export async function cloudLoadRooms(): Promise<CloudRoom[] | null> {
  const b = await detectBackend();
  if (b.kind === 'none') return null;
  try {
    if (b.kind === 'pages') {
      const res = await fetch(`/api/rooms?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return null;
      const j = await res.json();
      return parseRooms(j?.rooms || []);
    }
    const res = await fetch(`${fbUrl(b)}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const j = await res.json();
    return parseRooms(j || {});
  } catch {
    return null;
  }
}

/** Testa a conexão */
export async function cloudPing(): Promise<'ok' | 'off' | 'error'> {
  resetBackendCache();
  const b = await detectBackend();
  if (b.kind === 'none') {
    // distingue "sem função" de "função sem KV" pra mostrar o status certo
    try {
      const res = await fetch(`/api/rooms?t=${Date.now()}`, { cache: 'no-store' });
      if (res.status === 503) return 'error';
    } catch {
      // ignora
    }
    return 'off';
  }
  return 'ok';
}

export function isCloudConfigured(): boolean {
  return !!backendCache && backendCache.kind !== 'none';
}
