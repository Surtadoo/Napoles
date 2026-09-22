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

export interface RoomPermissions {
  mic: boolean;
  screen: boolean;
  camera: boolean;
  videoSource: boolean;
  chat: boolean;
  gifs: boolean;
  images: boolean;
  proTheme: boolean;
}

export interface RoomSettings {
  permissions: RoomPermissions;
  limit: number; // 0 = sem limite
  admins: string[]; // nomes
  bans: string[]; // nomes
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  permissions: {
    mic: true,
    screen: true,
    camera: true,
    videoSource: true,
    chat: true,
    gifs: true,
    images: true,
    proTheme: true,
  },
  limit: 0,
  admins: [],
  bans: [],
};

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
