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

/** Info da sala vinda no link: tipo (pública/privada), nome e hash da senha. Lê ?query E #hash. */
export function getRoomMetaFromUrl(): { type: 'public' | 'private'; name: string; pwHash: string } {
  try {
    const q = new URLSearchParams(window.location.search);
    const h = new URLSearchParams((window.location.hash || '').replace(/^#\/?/, ''));
    const get = (k: string) => q.get(k) || h.get(k) || '';
    const t = get('t');
    const name = get('n').slice(0, 40);
    const pwHash = get('k');
    // sem 't' no link: se tem hash de senha é privada; senão trata como pública (não bloqueia)
    const type: 'public' | 'private' = t === 'pub' ? 'public' : t === 'priv' ? 'private' : pwHash ? 'private' : 'public';
    return { type, name, pwHash };
  } catch {
    return { type: 'public', name: '', pwHash: '' };
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
    // Repete no #hash: navegadores embutidos (WhatsApp/Instagram) e alguns redirects
    // às vezes DERRUBAM o ?query — o hash sobrevive. Lemos dos dois lugares.
    const hp = new URLSearchParams();
    hp.set('room', roomCode);
    if (meta?.type) hp.set('t', meta.type === 'public' ? 'pub' : 'priv');
    if (meta?.type === 'private' && meta?.password) hp.set('k', hashPassword(meta.password));
    u.hash = hp.toString();
    return u.toString();
  } catch {
    return `?room=${encodeURIComponent(roomCode)}#room=${encodeURIComponent(roomCode)}`;
  }
}

export function persistRoomCodeInUrl(
  roomCode: string,
  meta?: { type?: 'public' | 'private'; name?: string; password?: string }
) {
  try {
    // a URL da barra = exatamente o link compartilhável (com ?query E #hash)
    window.history.replaceState({}, '', buildShareUrl(roomCode, meta));
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
