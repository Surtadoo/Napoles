export interface Participant {
  id: string;
  name: string;
  avatar: string;
  isOwner?: boolean;
  isAdmin?: boolean;
  isGuest?: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  isScreenSharing?: boolean;
  isCameraOn?: boolean;
  tag?: string;
}

export interface ChatMessage {
  id: string;
  sender: string;
  avatar: string;
  text?: string;
  mediaUrl?: string;
  isGif?: boolean;
  timestamp: string;
  isSystem?: boolean;
  color?: string;
}

export type StreamSourceType = 'none' | 'screen' | 'camera' | 'youtube' | 'sample';

export interface StreamState {
  type: StreamSourceType;
  stream: MediaStream | null;
  videoUrl?: string;
  title: string;
  quality: string;
  isSharing: boolean;
  isPaused: boolean;
}

/** Permissões da sala — quando false, só dono + admins podem fazer aquilo */
export interface RoomPermissions {
  mic: boolean;
  screen: boolean;
  camera: boolean;
  videoSource: boolean;
  chat: boolean;
  gifs: boolean;
  images: boolean;
  theme: boolean;
  /** admins podem banir pessoas */
  adminCanBan: boolean;
  /** admins podem desconectar (expulsar) pessoas da call */
  adminCanKick: boolean;
  /** mostrar a coroa do dono (adm principal) para os outros */
  showOwnerCrown: boolean;
  /** mostrar a coroa de quem virou admin para os outros */
  showAdminCrown: boolean;
  /** ADM LV1: limite de participantes + desconectar da call */
  adminLv1: boolean;
  /** ADM LV2: participantes, banimentos, gerenciar administradores, desconectar */
  adminLv2: boolean;
  /** ADM LV3: tudo do LV2 + gerenciar permissões */
  adminLv3: boolean;
}

export const DEFAULT_PERMISSIONS: RoomPermissions = {
  mic: true,
  screen: true,
  camera: true,
  videoSource: true,
  chat: true,
  gifs: true,
  images: true,
  theme: true,
  adminCanBan: false,
  adminCanKick: false,
  showOwnerCrown: true,
  showAdminCrown: true,
  adminLv1: true,
  adminLv2: true,
  adminLv3: true,
};

export interface BannedEntry {
  sessionId: string;
  name: string;
  bannedAt: number;
  by: string;
}

/** Nível do administrador (1 = básico, 3 = quase dono) */
export type AdminLevel = 1 | 2 | 3;

/** Estado de gerência da sala — sincronizado do dono para todos */
export interface RoomSettings {
  permissions: RoomPermissions;
  /** sessionIds dos administradores */
  admins: string[];
  /** nível de cada admin (sessionId → 1|2|3). Sem entrada = 1 */
  adminLevels?: Record<string, AdminLevel>;
  banned: BannedEntry[];
  /** 0 = sem limite */
  maxParticipants: number;
  ownerSessionId: string;
  ownerName: string;
  version: number;
}

/** O que um admin pode fazer, calculado a partir do nível + permissões ligadas. */
export interface AdminCaps {
  /** aba Limite de participantes */
  limit: boolean;
  /** desconectar da call */
  kick: boolean;
  /** aba Participantes (ver/gerir) */
  participants: boolean;
  /** aba Banimentos */
  ban: boolean;
  /** aba Gerenciar administradores */
  admins: boolean;
  /** aba Gerenciar permissões */
  permissions: boolean;
}

export function computeAdminCaps(
  settings: RoomSettings,
  sessionId: string,
  isOwner: boolean
): AdminCaps {
  if (isOwner) {
    return { limit: true, kick: true, participants: true, ban: true, admins: true, permissions: true };
  }
  const none: AdminCaps = { limit: false, kick: false, participants: false, ban: false, admins: false, permissions: false };
  if (!settings.admins.includes(sessionId)) return none;
  const p = settings.permissions;
  const lvl: AdminLevel = (settings.adminLevels?.[sessionId] as AdminLevel) || 1;

  const caps: AdminCaps = { ...none };
  // toggles antigos (compatibilidade): valem pra qualquer nível
  if (p.adminCanBan) caps.ban = true;
  if (p.adminCanKick) caps.kick = true;

  // LV1: limite + desconectar
  if (lvl >= 1 && p.adminLv1) {
    caps.limit = true;
    caps.kick = true;
  }
  // LV2: participantes, banimentos, admins, desconectar
  if (lvl >= 2 && p.adminLv2) {
    caps.participants = true;
    caps.ban = true;
    caps.admins = true;
    caps.kick = true;
  }
  // LV3: tudo do LV2 + permissões
  if (lvl >= 3 && p.adminLv3) {
    caps.participants = true;
    caps.ban = true;
    caps.admins = true;
    caps.kick = true;
    caps.permissions = true;
  }
  return caps;
}

export type SharedMediaPlatform = 'youtube' | 'twitch' | 'kick' | 'file';
export type SharedMediaController = 'leader' | 'any';

export interface SharedMediaPayload {
  id: string;
  platform: SharedMediaPlatform;
  rawUrl: string;
  embedUrl: string;
  title: string;
  controller: SharedMediaController;
  leaderId: string;
  leaderName: string;
  createdAt: number;
  fileName?: string;
  localOnly?: boolean;
}
