import { GoogleOAuthProvider } from "@react-oauth/google";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { AuthForms } from "./components/AuthForms";
import { ConfirmProvider } from "./components/ConfirmDialog";
import { AppProvider, useApp } from "./context/AppContext";
import { AccessScreen } from "./screens/AccessScreen";
import { AdminScreen } from "./screens/AdminScreen";
import { MusicPlayer } from "./screens/MusicPlayer";
import { googleClientId } from "./config";
import "./App.css";

function BrandMark() {
  return (
    <span className="brand-mark">
      <svg viewBox="0 0 32 32" width="16" height="16" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="bmlg-boot" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#f5c15d" />
            <stop offset="0.5" stopColor="#ff8c69" />
            <stop offset="1" stopColor="#55d6c2" />
          </linearGradient>
        </defs>
        <rect x="1" y="15" width="5" height="12" rx="2.5" fill="url(#bmlg-boot)" />
        <rect x="8" y="10" width="5" height="17" rx="2.5" fill="url(#bmlg-boot)" />
        <rect x="15" y="5" width="5" height="22" rx="2.5" fill="url(#bmlg-boot)" />
        <rect x="22" y="10" width="5" height="17" rx="2.5" fill="url(#bmlg-boot)" />
        <rect x="29" y="15" width="5" height="12" rx="2.5" fill="url(#bmlg-boot)" />
      </svg>
    </span>
  );
}

function AppRoutes() {
  const navigate = useNavigate();
  const app = useApp();
  const {
    session, isBootstrapping, themeMode, toggleThemeMode,
    view, isSubmitting, errorMessage, noticeMessage,
    loginForm, registerForm, resetForm, otpForm, otpStep,
    setLoginForm, setRegisterForm, setResetForm, setOtpForm,
    setErrorMessage, onViewChange, clearFeedback, logout,
    handleLogin, handleSendOtp, handleVerifyOtpSignup, handleVerifyOtpResetPassword,
    handleGoogleSuccess, handleDeleteAccount, handleUpdateProfile,
    handleChangePassword, handleUploadAvatar,
    audioRef,
    visibleTracks, favoriteTracks, playlists, artists, albums, languages,
    singers, lyricists, queueItems, libraryTracks,
    selectedPlaylistId, selectedSourceLabel, addToPlaylistId,
    searchQuery, durationByTrackId,
    selectedTrack, selectedTrackId, progress, currentTime, duration,
    isPlaying, isShuffle, repeatMode, volume,
    selectTrack, selectPlaylist, selectArtist, selectAlbum, selectLanguage, selectSinger, selectLyricist,
    selectNextTrack, selectPreviousTrack, togglePlayback, toggleRepeatMode,
    setIsShuffle, setVolume, seekToProgress, syncAudioTime, syncAudioMetadata,
    handleTrackEnded, enqueueTrack, shareTrack,
    saveTrackToPlaylist, addSelectedTrackToPlaylist, removeTrackFromPlaylist,
    createPlaylist, toggleFavorite,
    loadLibraryTracks, setLibraryTracks, setTracks,
    setSearchQuery, setAddToPlaylistId,
    notifications, dismissNotification,
  } = app;

  if (isBootstrapping) {
    return (
      <div className={`app-theme theme-${themeMode}`}>
        <div className="boot-screen">
          <BrandMark />
          <p>Opening Sonik</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-theme theme-${themeMode}`}>
      <Routes>
        <Route
          path="/"
          element={<Navigate to={session ? "/player" : "/login"} replace />}
        />

        <Route
          path="/login"
          element={
            session ? (
              <Navigate to="/player" replace />
            ) : (
              <AccessScreen
                view={view}
                activeForm={
                  <AuthForms
                    view={view}
                    isSubmitting={isSubmitting}
                    loginForm={loginForm}
                    registerForm={registerForm}
                    resetForm={resetForm}
                    otpForm={otpForm}
                    otpStep={otpStep}
                    setLoginForm={setLoginForm}
                    setRegisterForm={setRegisterForm}
                    setResetForm={setResetForm}
                    setOtpForm={setOtpForm}
                    onLogin={handleLogin}
                    onSendOtp={handleSendOtp}
                    onVerifyOtpSignup={handleVerifyOtpSignup}
                    onVerifyOtpResetPassword={handleVerifyOtpResetPassword}
                  />
                }
                errorMessage={errorMessage}
                noticeMessage={noticeMessage}
                onViewChange={onViewChange}
                onClearFeedback={clearFeedback}
                onGoogleSuccess={handleGoogleSuccess}
                onGoogleError={() =>
                  setErrorMessage("Google sign-in could not be completed.")
                }
                themeMode={themeMode}
                onThemeToggle={toggleThemeMode}
              />
            )
          }
        />

        <Route
          path="/player"
          element={
            !session ? (
              <Navigate to="/login" replace />
            ) : !selectedTrack ? (
              <div className="boot-screen">
                <BrandMark />
                <p>Loading library…</p>
              </div>
            ) : (
              <MusicPlayer
                session={session}
                onOpenAdmin={() => navigate("/admin")}
                audioRef={audioRef}
                tracks={visibleTracks}
                libraryTracks={libraryTracks}
                favoriteTrackIds={favoriteTracks.map((t) => t.id)}
                playlists={playlists}
                artists={artists}
                albums={albums}
                languages={languages}
                singers={singers}
                lyricists={lyricists}
                onSelectSinger={selectSinger}
                onSelectLyricist={selectLyricist}
                onSelectLanguage={selectLanguage}
                queueItems={queueItems}
                selectedPlaylistId={selectedPlaylistId}
                selectedSourceLabel={selectedSourceLabel}
                addToPlaylistId={addToPlaylistId}
                searchQuery={searchQuery}
                durationByTrackId={durationByTrackId}
                selectedTrack={selectedTrack}
                selectedTrackId={selectedTrackId}
                progress={progress}
                currentTime={currentTime}
                duration={duration}
                isPlaying={isPlaying}
                isShuffle={isShuffle}
                repeatMode={repeatMode}
                volume={volume}
                onSelectTrack={selectTrack}
                onSelectPlaylist={selectPlaylist}
                onSelectArtist={selectArtist}
                onSelectAlbum={selectAlbum}
                onSearchChange={setSearchQuery}
                onAddToPlaylistTargetChange={setAddToPlaylistId}
                onCreatePlaylist={createPlaylist}
                onAddToPlaylist={addSelectedTrackToPlaylist}
                onSaveTrackToPlaylist={saveTrackToPlaylist}
                onRemoveFromPlaylist={removeTrackFromPlaylist}
                onToggleFavorite={toggleFavorite}
                onPlayNext={(trackId) => void enqueueTrack(trackId, "next")}
                onAddToQueue={(trackId) => void enqueueTrack(trackId, "end")}
                onShareTrack={(track) =>
                  void shareTrack(track).catch(() => undefined)
                }
                onProgressChange={seekToProgress}
                onPlayToggle={togglePlayback}
                onNext={selectNextTrack}
                onPrevious={selectPreviousTrack}
                onShuffleToggle={() => setIsShuffle((c) => !c)}
                onRepeatToggle={toggleRepeatMode}
                onVolumeChange={setVolume}
                onLoadedMetadata={syncAudioMetadata}
                onTimeUpdate={syncAudioTime}
                onEnded={handleTrackEnded}
                onLogout={logout}
                onDeleteAccount={handleDeleteAccount}
                onUpdateProfile={handleUpdateProfile}
                onChangePassword={handleChangePassword}
                onUploadAvatar={handleUploadAvatar}
                themeMode={themeMode}
                onThemeToggle={toggleThemeMode}
                notifications={notifications}
                onDismissNotification={dismissNotification}
              />
            )
          }
        />

        <Route
          path="/admin"
          element={
            !session ? (
              <Navigate to="/login" replace />
            ) : session.user.role !== "admin" ? (
              <Navigate to="/player" replace />
            ) : (
              <AdminScreen
                session={session}
                tracks={libraryTracks}
                onClose={() => {
                  void loadLibraryTracks();
                  navigate("/player");
                }}
                onTrackUploaded={() => void loadLibraryTracks()}
                onTrackDeleted={(trackId) => {
                  setLibraryTracks((c) => c.filter((t) => t.id !== trackId));
                  setTracks((c) => c.filter((t) => t.id !== trackId));
                  void loadLibraryTracks();
                }}
                themeMode={themeMode}
                onThemeToggle={toggleThemeMode}
              />
            )
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  const inner = (
    <BrowserRouter>
      <ConfirmProvider>
        <AppProvider>
          <AppRoutes />
        </AppProvider>
      </ConfirmProvider>
    </BrowserRouter>
  );
  return googleClientId ? (
    <GoogleOAuthProvider clientId={googleClientId}>{inner}</GoogleOAuthProvider>
  ) : (
    inner
  );
}
