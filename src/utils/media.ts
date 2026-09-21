export type MediaPlatform = 'youtube' | 'twitch' | 'kick' | 'file';
export type MediaController = 'leader' | 'any';

export interface ParsedMedia {
  embedUrl: string;
  title: string;
}

function getEmbedParent(): string {
  try {
    const h = window.location.hostname;
    return h || 'localhost';
  } catch {
    return 'localhost';
  }
}

export function platformLabel(p: MediaPlatform): string {
  switch (p) {
    case 'youtube':
      return 'YouTube';
    case 'twitch':
      return 'Twitch';
    case 'kick':
      return 'Kick';
    case 'file':
      return 'Arquivo';
  }
}

export function platformPlaceholder(p: MediaPlatform): string {
  switch (p) {
    case 'youtube':
      return 'https://youtube.com/watch?v=... ou playlist com list=...';
    case 'twitch':
      return 'https://twitch.tv/nomedocanal ou /videos/123 ou clipe';
    case 'kick':
      return 'https://kick.com/nomedocanal';
    case 'file':
      return 'https://seusite.com/video.mp4 ou envie um arquivo abaixo';
  }
}

/** Converte link de YouTube/Twitch/Kick/arquivo em URL incorporável + título. */
export function parseMediaLink(
  platform: MediaPlatform,
  rawLink: string
): ParsedMedia | { error: string } {
  const link = (rawLink || '').trim();
  if (!link) return { error: 'Cole o link primeiro.' };
  if (!/^https?:\/\//i.test(link) && !/^blob:/i.test(link)) {
    return { error: 'O link precisa começar com http:// ou https://' };
  }

  if (platform === 'youtube') {
    const idMatch = link.match(
      /(?:youtube\.com\/(?:watch\?[^#]*v=|shorts\/|live\/|embed\/|v\/)|youtu\.be\/)([\w-]{11})/
    );
    const listMatch = link.match(/[?&]list=([\w-]+)/);
    if (listMatch) {
      const list = listMatch[1];
      return {
        embedUrl: `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(list)}&autoplay=1&rel=0`,
        title: idMatch ? 'YouTube — vídeo + playlist' : 'YouTube — playlist',
      };
    }
    if (idMatch) {
      return {
        embedUrl: `https://www.youtube-nocookie.com/embed/${idMatch[1]}?autoplay=1&rel=0&enablejsapi=1`,
        title: 'YouTube — vídeo',
      };
    }
    return {
      error: 'Link do YouTube inválido. Use watch?v=, youtu.be, shorts, live ou playlist com list=.',
    };
  }

  if (platform === 'twitch') {
    const parent = getEmbedParent();
    const parents = `parent=${encodeURIComponent(parent)}&parent=localhost`;
    const clipMatch = link.match(
      /(?:clips\.twitch\.tv\/([\w-]+)|twitch\.tv\/\w+\/clip\/([\w-]+))/i
    );
    if (clipMatch) {
      const slug = clipMatch[1] || clipMatch[2];
      return {
        embedUrl: `https://clips.twitch.tv/embed?clip=${encodeURIComponent(slug)}&${parents}&autoplay=true&muted=false`,
        title: 'Twitch — clipe',
      };
    }
    const vodMatch = link.match(/twitch\.tv\/videos\/(\d+)/i);
    if (vodMatch) {
      return {
        embedUrl: `https://player.twitch.tv/?video=${vodMatch[1]}&${parents}&autoplay=true&muted=false`,
        title: 'Twitch — VOD',
      };
    }
    const chMatch = link.match(/twitch\.tv\/([A-Za-z0-9_]{3,})/i);
    if (chMatch) {
      return {
        embedUrl: `https://player.twitch.tv/?channel=${encodeURIComponent(chMatch[1])}&${parents}&autoplay=true&muted=false`,
        title: `Twitch — ${chMatch[1]} ao vivo`,
      };
    }
    return { error: 'Link da Twitch inválido. Use twitch.tv/canal, /videos/ ou clipe.' };
  }

  if (platform === 'kick') {
    const m = link.match(/kick\.com\/([A-Za-z0-9_\-]+)/i);
    if (!m || ['videos', 'clips', 'video', 'clip', 'categories'].includes(m[1].toLowerCase())) {
      return { error: 'Link do Kick inválido. Use kick.com/nomedocanal.' };
    }
    const channel = m[1];
    const isVod = /\/(videos|clips)\//i.test(link);
    return {
      embedUrl: `https://player.kick.com/${encodeURIComponent(channel)}?autoplay=true&muted=false`,
      title: isVod ? `Kick — ${channel} (vídeo)` : `Kick — ${channel} ao vivo`,
    };
  }

  // file
  if (/^blob:/i.test(link)) {
    return { error: 'Para arquivo do aparelho use o botão "Escolher arquivo".' };
  }
  if (/\.(mp4|webm|ogg|ogv|mov|m4v)(\?|#|$)/i.test(link) || /\.m3u8(\?|#|$)/i.test(link)) {
    const name = link.split('/').pop()?.split('?')[0] || 'vídeo';
    return { embedUrl: link, title: `Arquivo — ${decodeURIComponent(name).slice(0, 40)}` };
  }
  return {
    error: 'Cole um link direto de vídeo (.mp4, .webm, .m3u8) ou envie um arquivo do aparelho.',
  };
}

/** Liga/desliga o mudo na URL do player (YouTube/Twitch/Kick). Arquivo usa <video muted>. */
export function withMutedParam(embedUrl: string, platform: MediaPlatform, muted: boolean): string {
  try {
    if (platform === 'youtube') {
      if (muted) {
        return /[?&]mute=/.test(embedUrl)
          ? embedUrl.replace(/([?&])mute=[01]/, '$1mute=1')
          : `${embedUrl}&mute=1`;
      }
      return embedUrl.replace(/([?&])mute=1/, '$1mute=0');
    }
    if (platform === 'twitch') {
      return embedUrl.replace(/muted=(true|false)/, muted ? 'muted=true' : 'muted=false');
    }
    if (platform === 'kick') {
      if (/muted=/.test(embedUrl)) {
        return embedUrl.replace(/muted=(true|false)/, muted ? 'muted=true' : 'muted=false');
      }
      return `${embedUrl}${embedUrl.includes('?') ? '&' : '?'}muted=${muted ? 'true' : 'false'}`;
    }
  } catch {
    // ignora
  }
  return embedUrl;
}
