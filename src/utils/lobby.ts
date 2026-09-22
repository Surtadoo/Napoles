export interface RecentRoom {
  name: string;
  code: string;
  type: 'public' | 'private';
  lastJoined: number;
  /** senha da sala (só privadas) */
  password?: string;
  /** false = invisível (não aparece nas listas) */
  visible?: boolean;
  /** true = fui eu que criei */
  createdByMe?: boolean;
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

const RECENT_KEY = 'livedc-recent-rooms-v1';
const GROUPS_KEY = 'livedc-groups-v1';
const PUBLIC_KEY = 'livedc-public-rooms-v1';

/** Todas as salas salvas (inclui invisíveis) — uso interno. */
export function loadAllRooms(): RecentRoom[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((r) => r && typeof r.code === 'string' && /^\d{4,10}$/.test(r.code))
      .slice(0, 20);
  } catch {
    return [];
  }
}

/** "Salas recentes" = só salas CRIADAS por mim e marcadas como visíveis. */
export function loadRecentRooms(): RecentRoom[] {
  return loadAllRooms().filter((r) => r.createdByMe && r.visible !== false).slice(0, 8);
}

export function saveRecentRoom(room: Omit<RecentRoom, 'lastJoined'>) {
  try {
    const cur = loadAllRooms().filter((r) => r.code !== room.code);
    const next: RecentRoom[] = [{ ...room, lastJoined: Date.now() }, ...cur].slice(0, 20);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignora
  }
}

/** Busca uma sala salva pelo código (pra recuperar senha/tipo ao reentrar). */
export function findSavedRoom(code: string): RecentRoom | undefined {
  return loadAllRooms().find((r) => r.code === code);
}

export function removeRecentRoom(code: string) {
  try {
    const next = loadAllRooms().filter((r) => r.code !== code);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignora
  }
}

/** Grupos do usuário (salvo local). Começa com um grupo de exemplo se não houver nenhum. */
export function loadGroups(): LobbyGroup[] {
  try {
    const raw = localStorage.getItem(GROUPS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) return arr;
    }
  } catch {
    // ignora
  }
  const seed: LobbyGroup[] = [
    {
      id: 'g-rapazes',
      name: 'Os rapazes',
      role: 'Membro',
      members: 19,
      online: 6,
      code: '190619',
      emoji: '🎮',
    },
  ];
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(seed));
  } catch {
    // ignora
  }
  return seed;
}

export function saveGroups(groups: LobbyGroup[]) {
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  } catch {
    // ignora
  }
}

/** Salas públicas conhecidas por este navegador (criadas como "Pública"). */
export function loadPublicRooms(): RecentRoom[] {
  try {
    const raw = localStorage.getItem(PUBLIC_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, 30) : [];
  } catch {
    return [];
  }
}

export function savePublicRoom(room: Omit<RecentRoom, 'lastJoined' | 'type'>) {
  try {
    const cur = loadPublicRooms().filter((r) => r.code !== room.code);
    const entry: RecentRoom = { ...room, type: 'public', lastJoined: Date.now() };
    const next: RecentRoom[] = [entry, ...cur].slice(0, 30);
    localStorage.setItem(PUBLIC_KEY, JSON.stringify(next));
  } catch {
    // ignora
  }
}

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
  // link com ?room=
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
  // só código numérico
  if (/^\d{4,10}$/.test(raw)) return { name: `Sala ${raw}`, code: raw };
  // nome livre → código determinístico
  const clean = raw.replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 32);
  if (!clean) return null;
  return { name: clean, code: codeFromRoomName(clean) };
}
