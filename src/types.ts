export type UserRole = "duckie" | "dobby";

export interface ChatMessage {
  id: string;
  sender: UserRole;
  text: string;
  timestamp: number;
  isOffline?: boolean;
}

export interface MediaState {
  url: string;
  playing: boolean;
  currentTime: number;
  sender: UserRole;
  timestamp: number;
}

export interface ParticipantPresence {
  duckieOnline: boolean;
  dobbyOnline: boolean;
  lastSeenDuckie: number;
  lastSeenDobby: number;
}

export interface MovieRoomState {
  media: MediaState;
  chats: ChatMessage[];
  presence: ParticipantPresence;
  serverTime: number;
}

export interface SignalMessage {
  id: string;
  sender: UserRole;
  type: "offer" | "answer" | "candidate";
  payload: any;
  timestamp: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  life: number;
  maxLife: number;
  emoji?: string;
}
