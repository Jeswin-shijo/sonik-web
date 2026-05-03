export type AuthView = 'login' | 'register-otp' | 'forgot-otp';

export type OtpForm = {
  email: string;
  otp: string;
};

export type RegisterForm = {
  profileName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export type LoginForm = {
  email: string;
  password: string;
};

export type ResetForm = {
  newPassword: string;
};

export type AuthProvider = 'local' | 'google' | 'hybrid';
export type UserRole = 'user' | 'admin';

export type SessionUser = {
  id: number;
  email: string;
  profileName: string;
  authProvider: AuthProvider;
  role: UserRole;
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

export type ArtistSummary = {
  id: string;
  name: string;
  trackCount: number;
  albumCount: number;
  tracks: MusicTrack[];
};

export type AlbumSummary = {
  id: string;
  title: string;
  artist: string;
  trackCount: number;
  tracks: MusicTrack[];
};

export type QueueItemSummary = {
  id: string;
  position: number;
  track: MusicTrack;
};

export type TracksResponse = {
  tracks: MusicTrack[];
};

export type ArtistsResponse = {
  artists: ArtistSummary[];
};

export type AlbumsResponse = {
  albums: AlbumSummary[];
};

export type PlaylistsResponse = {
  playlists: PlaylistSummary[];
};

export type PlaylistResponse = {
  playlist: PlaylistSummary;
};

export type QueueResponse = {
  queue: QueueItemSummary[];
};

export type QueueActionResponse = QueueResponse & {
  queueItem: QueueItemSummary;
  message: string;
};

export type ActionIconName =
  | 'heart'
  | 'heart-filled'
  | 'plus'
  | 'check'
  | 'more'
  | 'queue'
  | 'queue-add'
  | 'play-next'
  | 'share'
  | 'artist'
  | 'album';
export type RepeatMode = 'off' | 'all' | 'one';
export type ThemeMode = 'dark' | 'light';
