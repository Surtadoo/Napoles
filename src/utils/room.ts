export function generateRoomCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function getRoomCodeFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room') || params.get('sala') || params.get('r') || params.get('code');
    if (room && /^[A-Za-z0-9-]{4,24}$/.test(room)) return room;
    if (window.location.hash) {
      const hash = window.location.hash.replace(/^#\/?/, '');
      const hashParams = new URLSearchParams(hash.includes('=') ? hash : '');
      const hRoom =
        hashParams.get('room') || hashParams.get('sala') || hashParams.get('code');
      if (hRoom && /^[A-Za-z0-9-]{4,24}$/.test(hRoom)) return hRoom;
      if (/^[A-Za-z0-9-]{4,24}$/.test(hash)) return hash;
    }
  } catch {
    // ignora
  }
  return null;
}

export function isInviteLink(): boolean {
  return getRoomCodeFromUrl() !== null;
}

/** Hash simples da senha (só pra validar no link, não é segurança forte). */
export function hashPassword(pw: string): string {
  const s = (pw || '').trim();
  if (!s) return '';
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36);
}

/** Info da sala vinda no link: tipo (pública/privada), nome e hash da senha. */
export function getRoomMetaFromUrl(): { type: 'public' | 'private'; name: string; pwHash: string } {
  try {
    const p = new URLSearchParams(window.location.search);
    const t = p.get('t');
    const name = (p.get('n') || '').slice(0, 40);
    const pwHash = p.get('k') || '';
    return { type: t === 'pub' ? 'public' : 'private', name, pwHash };
  } catch {
    return { type: 'private', name: '', pwHash: '' };
  }
}

export function buildShareUrl(
  roomCode: string,
  meta?: { type?: 'public' | 'private'; name?: string; password?: string }
): string {
  try {
    const base = `${window.location.origin}${window.location.pathname}`;
    const u = new URL(base);
    u.searchParams.set('room', roomCode);
    if (meta?.type) u.searchParams.set('t', meta.type === 'public' ? 'pub' : 'priv');
    if (meta?.name) u.searchParams.set('n', meta.name.slice(0, 40));
    if (meta?.type === 'private' && meta?.password) u.searchParams.set('k', hashPassword(meta.password));
    return u.toString();
  } catch {
    return `?room=${encodeURIComponent(roomCode)}`;
  }
}

export function persistRoomCodeInUrl(
  roomCode: string,
  meta?: { type?: 'public' | 'private'; name?: string; password?: string }
) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomCode);
    if (meta?.type) url.searchParams.set('t', meta.type === 'public' ? 'pub' : 'priv');
    if (meta?.name) url.searchParams.set('n', meta.name.slice(0, 40));
    if (meta?.type === 'private' && meta?.password) {
      url.searchParams.set('k', hashPassword(meta.password));
    } else {
      url.searchParams.delete('k');
    }
    window.history.replaceState({}, '', url.toString());
  } catch {
    // ignora
  }
}

export function avatarForName(name: string): string {
  const seed = encodeURIComponent((name || 'anon').trim() || 'anon');
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${seed}&backgroundColor=1e293b,0f172a,164e63`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}
