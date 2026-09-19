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
