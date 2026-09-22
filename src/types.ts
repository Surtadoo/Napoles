export interface Participant {
  id: string;
  name: string;
  avatar: string;
  isOwner?: boolean;
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
};

export interface BannedEntry {
  sessionId: string;
  name: string;
  bannedAt: number;
  by: string;
}

/** Estado de gerência da sala — sincronizado do dono para todos */
export interface RoomSettings {
  permissions: RoomPermissions;
  /** sessionIds dos administradores */
  admins: string[];
  banned: BannedEntry[];
  /** 0 = sem limite */
  maxParticipants: number;
  ownerSessionId: string;
  ownerName: string;
  version: number;
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
