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

export function buildShareUrl(roomCode: string): string {
  try {
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}?room=${encodeURIComponent(roomCode)}`;
  } catch {
    return `?room=${encodeURIComponent(roomCode)}`;
  }
}

export function persistRoomCodeInUrl(roomCode: string) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomCode);
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
