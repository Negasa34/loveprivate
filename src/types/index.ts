export interface User {
  username: string;
  isOnline: boolean;
  lastSeen: Date | null;
}

export interface Message {
  _id: string;
  sender: string;
  content: string;
  fileType: 'image' | 'pdf' | null;
  fileName: string | null;
  filePath: string | null;
  timestamp: Date | string;
  read: boolean;
}

export interface AuthResponse {
  username: string;
  token: string;
}

export interface PartnerStatus {
  username: string;
  gender?: string | null;
  isOnline: boolean;
  lastSeen: Date | string | null;
  isFriend?: boolean;
  requestSent?: boolean;
  requestReceived?: boolean;
}

export interface UnreadCount {
  count: number;
}

export type SocketEvent = 
  | 'new_message'
  | 'partner_typing'
  | 'partner_stop_typing'
  | 'user_online'
  | 'user_offline'
  | 'online_users'
  | 'messages_read'
  | 'error_message';
