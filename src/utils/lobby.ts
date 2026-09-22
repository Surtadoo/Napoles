export interface RecentRoom {
  name: string;
  code: string;
  type: 'public' | 'private';
  lastJoined: number;
  /** senha da sala (só privadas) — só fica no navegador de quem criou/digitou */
  password?: string;
  /** hash da senha — é o que viaja pelo diretório pra validar sem expor a senha */
  pwHash?: string;
  /** false = invisível (não aparece nas listas) */
  visible?: boolean;
  /** true = fui eu que criei */
  createdByMe?: boolean;
  /** posição no mapa 3D */
  lat?: number;
  lng?: number;
  /** cidade/país aproximado (texto livre) */
  place?: string;
  createdAt?: number;
  createdBy?: string;
}

export interface LobbyGroup {
  id: string;
  name: string;
  role: string;
  members: number;
  online: number;
  code: string;
  emoji: string;
}

/** Arquivo de salas: é o que fica salvo em disco (livedc-rooms.json) */
export interface RoomsFile {
  version: number;
  updatedAt: number;
  rooms: RecentRoom[];
  groups: LobbyGroup[];
}

const ROOMS_KEY = 'livedc-rooms-file-v2';
const FILE_URL = '/livedc-rooms.json';
const FILE_NAME = 'livedc-rooms.json';

// ----------------------------------------------------------------------------
// Persistência: espelho local (localStorage) + arquivo (download / import / fetch)
// ----------------------------------------------------------------------------

function emptyFile(): RoomsFile {
  return { version: 1, updatedAt: 0, rooms: [], groups: [] };
}

function sanitizeRoom(r: any): RecentRoom | null {
  if (!r || typeof r.code !== 'string' || !/^\d{4,10}$/.test(r.code)) return null;
  return {
    name: String(r.name || `Sala ${r.code}`).slice(0, 48),
    code: r.code,
    type: r.type === 'public' ? 'public' : 'private',
    lastJoined: Number(r.lastJoined || 0),
    password: r.password ? String(r.password) : undefined,
    pwHash: r.pwHash ? String(r.pwHash) : undefined,
    visible: r.visible !== false,
    createdByMe: !!r.createdByMe,
    lat: typeof r.lat === 'number' ? r.lat : undefined,
    lng: typeof r.lng === 'number' ? r.lng : undefined,
    place: r.place ? String(r.place).slice(0, 60) : undefined,
    createdAt: Number(r.createdAt || r.lastJoined || 0),
    createdBy: r.createdBy ? String(r.createdBy).slice(0, 24) : undefined,
  };
}

function sanitizeFile(raw: any): RoomsFile {
  const f = emptyFile();
  if (!raw || typeof raw !== 'object') return f;
  f.version = Number(raw.version || 1);
  f.updatedAt = Number(raw.updatedAt || 0);
  f.rooms = Array.isArray(raw.rooms) ? (raw.rooms.map(sanitizeRoom).filter(Boolean) as RecentRoom[]) : [];
  f.groups = Array.isArray(raw.groups)
    ? raw.groups
        .filter((g: any) => g && g.id && g.name && /^\d{4,10}$/.test(String(g.code || '')))
        .map((g: any) => ({
          id: String(g.id),
          name: String(g.name).slice(0, 40),
          role: String(g.role || 'Membro'),
          members: Number(g.members || 0),
          online: Number(g.online || 0),
          code: String(g.code),
          emoji: String(g.emoji || '🎮'),
        }))
    : [];
  return f;
}

export function loadFile(): RoomsFile {
  try {
    const raw = localStorage.getItem(ROOMS_KEY);
    if (raw) return sanitizeFile(JSON.parse(raw));
  } catch {
    // ignora
  }
  return emptyFile();
}

function persistFile(f: RoomsFile) {
  try {
    f.updatedAt = Date.now();
    localStorage.setItem(ROOMS_KEY, JSON.stringify(f));
  } catch {
    // ignora
  }
}

/** Mescla salas/grupos de outro arquivo (mais recente vence). */
function mergeFiles(a: RoomsFile, b: RoomsFile): RoomsFile {
  const byCode = new Map<string, RecentRoom>();
  [...a.rooms, ...b.rooms].forEach((r) => {
    const cur = byCode.get(r.code);
    if (!cur || (r.lastJoined || 0) >= (cur.lastJoined || 0)) {
      byCode.set(r.code, { ...cur, ...r, createdByMe: !!(cur?.createdByMe || r.createdByMe) });
    }
  });
  const byId = new Map<string, LobbyGroup>();
  [...a.groups, ...b.groups].forEach((g) => byId.set(g.id, g));
  return {
    version: 1,
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
    rooms: [...byCode.values()].sort((x, y) => (y.lastJoined || 0) - (x.lastJoined || 0)).slice(0, 200),
    groups: [...byId.values()],
  };
}

/**
 * Carrega o arquivo publicado junto com o site (public/livedc-rooms.json) e mescla
 * com o espelho local. Assim, ao levar o site pra outro lugar, as salas vêm junto.
 */
export async function syncFromBundledFile(): Promise<RoomsFile> {
  const local = loadFile();
  try {
    const res = await fetch(`${FILE_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const remote = sanitizeFile(await res.json());
      const merged = mergeFiles(local, remote);
      persistFile(merged);
      return merged;
    }
  } catch {
    // sem arquivo publicado: segue só com o local
  }
  return local;
}

/** Baixa o arquivo de salas (pra colocar em public/livedc-rooms.json do site). */
export function downloadRoomsFile() {
  try {
    const f = loadFile();
    const blob = new Blob([JSON.stringify(f, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = FILE_NAME;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    // ignora
  }
}

/** Importa um livedc-rooms.json escolhido pelo usuário (mescla com o que já tem). */
export async function importRoomsFile(file: File): Promise<RoomsFile> {
  const text = await file.text();
  const incoming = sanitizeFile(JSON.parse(text));
  const merged = mergeFiles(loadFile(), incoming);
  persistFile(merged);
  return merged;
}

// ----------------------------------------------------------------------------
// Salas
// ----------------------------------------------------------------------------

/** Todas as salas salvas (inclui invisíveis) — uso interno. */
export function loadAllRooms(): RecentRoom[] {
  return loadFile().rooms;
}

/** "Salas recentes" = salas CRIADAS por mim e visíveis (públicas e privadas). */
export function loadRecentRooms(): RecentRoom[] {
  return loadAllRooms()
    .filter((r) => r.createdByMe && r.visible !== false)
    .slice(0, 12);
}

/** Salas públicas visíveis (de qualquer criador). */
export function loadPublicRooms(): RecentRoom[] {
  return loadAllRooms().filter((r) => r.type === 'public' && r.visible !== false);
}

/** Salas privadas visíveis (de qualquer criador). Senha só é usada pra validar. */
export function loadPrivateRooms(): RecentRoom[] {
  return loadAllRooms().filter((r) => r.type === 'private' && r.visible !== false);
}

export function saveRecentRoom(room: Omit<RecentRoom, 'lastJoined'>) {
  const f = loadFile();
  const prev = f.rooms.find((r) => r.code === room.code);
  // posição: a que veio agora (localização real do criador) > a já salva > sem posição
  const hasNew = typeof room.lat === 'number' && typeof room.lng === 'number';
  const hasPrev = typeof prev?.lat === 'number' && typeof prev?.lng === 'number';
  const pos = hasNew
    ? { lat: room.lat, lng: room.lng, place: room.place }
    : hasPrev
      ? { lat: prev!.lat, lng: prev!.lng, place: prev!.place }
      : {};
  const entry: RecentRoom = {
    ...prev,
    ...room,
    ...pos,
    lastJoined: Date.now(),
    createdAt: prev?.createdAt || Date.now(),
  };
  f.rooms = [entry, ...f.rooms.filter((r) => r.code !== room.code)].slice(0, 200);
  persistFile(f);
}

/**
 * Recebe salas de OUTRAS pessoas (via diretório P2P) e mescla no arquivo local.
 * Nunca sobrescreve senha/createdByMe das minhas. Retorna true se algo mudou.
 */
export function mergeIncomingRooms(incoming: any[]): boolean {
  const f = loadFile();
  let changed = false;
  for (const raw of incoming) {
    if (!raw || typeof raw.code !== 'string' || !/^\d{4,10}$/.test(raw.code)) continue;
    const idx = f.rooms.findIndex((r) => r.code === raw.code);
    const inc: Partial<RecentRoom> = {
      name: String(raw.name || `Sala ${raw.code}`).slice(0, 48),
      code: raw.code,
      type: raw.type === 'public' ? 'public' : 'private',
      pwHash: raw.pwHash ? String(raw.pwHash) : undefined,
      lat: typeof raw.lat === 'number' ? raw.lat : undefined,
      lng: typeof raw.lng === 'number' ? raw.lng : undefined,
      place: raw.place ? String(raw.place).slice(0, 60) : undefined,
      createdAt: Number(raw.createdAt || 0) || undefined,
      createdBy: raw.createdBy ? String(raw.createdBy).slice(0, 24) : undefined,
      lastJoined: Number(raw.lastJoined || 0),
      visible: raw.visible !== false,
    };
    if (idx === -1) {
      f.rooms.push({
        name: inc.name!,
        code: inc.code!,
        type: inc.type!,
        lastJoined: inc.lastJoined || 0,
        pwHash: inc.pwHash,
        lat: inc.lat,
        lng: inc.lng,
        place: inc.place,
        createdAt: inc.createdAt,
        createdBy: inc.createdBy,
        visible: true,
        createdByMe: false,
      });
      changed = true;
      continue;
    }
    const cur = f.rooms[idx];
    // minhas salas: só completo o que falta (posição/criador), nunca sobrescrevo
    if (cur.createdByMe) {
      let touched = false;
      if (cur.lat == null && inc.lat != null) {
        cur.lat = inc.lat;
        cur.lng = inc.lng;
        cur.place = inc.place;
        touched = true;
      }
      if (touched) changed = true;
      continue;
    }
    // salas dos outros: aceito a versão mais recente
    const newer = (inc.lastJoined || 0) >= (cur.lastJoined || 0);
    const next: RecentRoom = {
      ...cur,
      name: newer ? inc.name! : cur.name,
      type: newer ? inc.type! : cur.type,
      pwHash: inc.pwHash || cur.pwHash,
      lat: inc.lat ?? cur.lat,
      lng: inc.lng ?? cur.lng,
      place: inc.place || cur.place,
      createdAt: cur.createdAt || inc.createdAt,
      createdBy: cur.createdBy || inc.createdBy,
      lastJoined: Math.max(cur.lastJoined || 0, inc.lastJoined || 0),
      visible: true,
    };
    if (JSON.stringify(next) !== JSON.stringify(cur)) {
      f.rooms[idx] = next;
      changed = true;
    }
  }
  if (changed) {
    f.rooms.sort((a, b) => (b.lastJoined || 0) - (a.lastJoined || 0));
    f.rooms = f.rooms.slice(0, 300);
    persistFile(f);
  }
  return changed;
}

/** Atualiza só a posição de uma sala (quando a localização chega depois). */
export function updateRoomLocation(code: string, lat: number, lng: number, place?: string) {
  const f = loadFile();
  const r = f.rooms.find((x) => x.code === code);
  if (!r) return;
  r.lat = lat;
  r.lng = lng;
  if (place) r.place = place;
  persistFile(f);
}

/** mantido por compatibilidade (agora públicas ficam no mesmo arquivo) */
export function savePublicRoom(room: Omit<RecentRoom, 'lastJoined' | 'type'>) {
  const f = loadFile();
  const prev = f.rooms.find((r) => r.code === room.code);
  if (prev) {
    prev.type = 'public';
    prev.visible = true;
    prev.lastJoined = Date.now();
  } else {
    f.rooms.unshift({ ...room, type: 'public', visible: true, lastJoined: Date.now() });
  }
  persistFile(f);
}

/** Busca uma sala salva pelo código (pra recuperar senha/tipo ao reentrar). */
export function findSavedRoom(code: string): RecentRoom | undefined {
  return loadAllRooms().find((r) => r.code === code);
}

export function removeRecentRoom(code: string) {
  const f = loadFile();
  f.rooms = f.rooms.filter((r) => r.code !== code);
  persistFile(f);
}

/** Busca por nome, código ou lugar. */
export function searchRooms(rooms: RecentRoom[], q: string): RecentRoom[] {
  const s = (q || '').trim().toLowerCase();
  if (!s) return rooms;
  return rooms.filter(
    (r) =>
      r.name.toLowerCase().includes(s) ||
      r.code.includes(s) ||
      (r.place || '').toLowerCase().includes(s) ||
      (r.createdBy || '').toLowerCase().includes(s)
  );
}

// ----------------------------------------------------------------------------
// Grupos
// ----------------------------------------------------------------------------

export function loadGroups(): LobbyGroup[] {
  const f = loadFile();
  if (f.groups.length > 0) return f.groups;
  const seed: LobbyGroup[] = [
    { id: 'g-rapazes', name: 'Os rapazes', role: 'Membro', members: 19, online: 6, code: '190619', emoji: '🎮' },
  ];
  f.groups = seed;
  persistFile(f);
  return seed;
}

export function saveGroups(groups: LobbyGroup[]) {
  const f = loadFile();
  f.groups = groups;
  persistFile(f);
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/** Gera um código de 6 dígitos estável a partir do nome da sala (mesmo nome = mesma sala). */
export function codeFromRoomName(name: string): string {
  const s = name.trim().toLowerCase();
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  const n = 100000 + (h % 900000);
  return String(n);
}

/** Aceita "reuniao-time", um link completo com ?room=, ou um código de 6 dígitos. */
export function parseRoomInput(input: string): { name: string; code: string } | null {
  const raw = (input || '').trim();
  if (!raw) return null;
  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      const c = u.searchParams.get('room') || u.searchParams.get('sala') || u.searchParams.get('code');
      if (c && /^\d{4,10}$/.test(c)) return { name: `Sala ${c}`, code: c };
      return null;
    }
  } catch {
    return null;
  }
  if (/^\d{4,10}$/.test(raw)) return { name: `Sala ${raw}`, code: raw };
  const clean = raw.replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 32);
  if (!clean) return null;
  return { name: clean, code: codeFromRoomName(clean) };
}
