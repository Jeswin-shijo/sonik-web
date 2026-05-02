export type AuthView = 'login' | 'register' | 'forgot' | 'reset';

export type AuthProvider = 'local' | 'google' | 'hybrid';

export type SessionUser = {
  id: number;
  email: string;
  profileName: string;
  authProvider: AuthProvider;
  googleConnected: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SessionState = {
  accessToken: string;
  tokenType: string;
  user: SessionUser;
};

export type AuthResponse = {
  message: string;
  accessToken: string;
  tokenType: string;
  user: SessionUser;
};

export type ForgotPasswordResponse = {
  message: string;
  devResetToken?: string;
  expiresAt?: string;
  host?: string;
};

export type ApiErrorPayload = {
  message?: string | string[];
};

export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  plays: string;
  mood: string;
  coverClass: string;
  coverUrl?: string | null;
  streamUrl?: string;
};

export type PlaylistSummary = {
  id: string;
  name: string;
  description: string | null;
  trackCount: number;
  tracks: MusicTrack[];
};

export type TracksResponse = {
  tracks: MusicTrack[];
};

export type PlaylistsResponse = {
  playlists: PlaylistSummary[];
};

export type PlaylistResponse = {
  playlist: PlaylistSummary;
};

export type ActionIconName = 'heart' | 'heart-filled' | 'plus' | 'check';
export type RepeatMode = 'off' | 'all' | 'one';
