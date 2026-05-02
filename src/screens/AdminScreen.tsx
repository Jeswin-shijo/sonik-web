import { FormEvent, useEffect, useState } from 'react';
import { ApiRequestError } from '../api/client';
import { apiBaseUrl } from '../config';
import type { MusicTrack, SessionState, ThemeMode } from '../types';
import { ThemeToggle } from '../components/ThemeToggle';
import { TrackArtwork } from '../components/TrackArtwork';
import { useConfirm } from '../components/ConfirmDialog';

type UploadForm = {
  title: string;
  artist: string;
  album: string;
  genre: string;
  mood: string;
};

const emptyForm: UploadForm = {
  title: '',
  artist: '',
  album: '',
  genre: '',
  mood: '',
};

export function AdminScreen({
  session,
  tracks,
  onClose,
  onTrackUploaded,
  onTrackDeleted,
  themeMode,
  onThemeToggle,
}: {
  session: SessionState;
  tracks: MusicTrack[];
  onClose: () => void;
  onTrackUploaded: () => void;
  onTrackDeleted: (trackId: string) => void;
  themeMode: ThemeMode;
  onThemeToggle: () => void;
}) {
  const [form, setForm] = useState<UploadForm>(emptyForm);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const confirm = useConfirm();

  useEffect(() => {
    if (!noticeMessage) return;
    const timer = setTimeout(() => setNoticeMessage(''), 4000);
    return () => clearTimeout(timer);
  }, [noticeMessage]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setNoticeMessage('');

    if (!audioFile) {
      setErrorMessage('Please choose an audio file.');
      return;
    }

    if (!form.title.trim()) {
      setErrorMessage('Please give the track a title.');
      return;
    }

    const payload = new FormData();
    payload.append('audio', audioFile);
    if (coverFile) payload.append('cover', coverFile);
    payload.append('title', form.title.trim());
    if (form.artist.trim()) payload.append('artist', form.artist.trim());
    if (form.album.trim()) payload.append('album', form.album.trim());
    if (form.genre.trim()) payload.append('genre', form.genre.trim());
    if (form.mood.trim()) payload.append('mood', form.mood.trim());

    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiBaseUrl}/tracks/admin/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: payload,
      });

      const body = (await response.json().catch(() => null)) as
        | { message?: string | string[] }
        | null;

      if (!response.ok) {
        const message = Array.isArray(body?.message)
          ? body?.message.join(', ')
          : body?.message;
        throw new ApiRequestError(response.status, message ?? 'Upload failed.');
      }

      setNoticeMessage(`"${form.title.trim()}" uploaded successfully.`);
      setForm(emptyForm);
      setAudioFile(null);
      setCoverFile(null);
      const audioInput = document.getElementById(
        'admin-audio-input',
      ) as HTMLInputElement | null;
      const coverInput = document.getElementById(
        'admin-cover-input',
      ) as HTMLInputElement | null;
      if (audioInput) audioInput.value = '';
      if (coverInput) coverInput.value = '';
      onTrackUploaded();
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Upload failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(trackId: string, title: string) {
    const confirmed = await confirm({
      title: 'Remove track?',
      message: `"${title}" will be removed from the shared library for everyone.`,
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!confirmed) return;

    setPendingDeleteId(trackId);
    setErrorMessage('');

    try {
      const response = await fetch(`${apiBaseUrl}/tracks/admin/${trackId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { message?: string | string[] }
          | null;
        const message = Array.isArray(body?.message)
          ? body?.message.join(', ')
          : body?.message;
        throw new ApiRequestError(response.status, message ?? 'Delete failed.');
      }

      onTrackDeleted(trackId);
      setNoticeMessage(`"${title}" removed.`);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Delete failed.');
      }
    } finally {
      setPendingDeleteId(null);
    }
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <button className="text-action" onClick={onClose} type="button">
          ← Back to player
        </button>
        <div className="admin-header-meta">
          <ThemeToggle themeMode={themeMode} onToggle={onThemeToggle} />
          <span className="admin-pill">Signed in as {session.user.email}</span>
        </div>
      </header>

      <section className="admin-panel">
        <div className="auth-copy">
          <p className="section-kicker">Sonik Admin</p>
          <h1>Upload a track</h1>
          <p>Add audio files to the shared library. Cover image is optional.</p>
        </div>

        {errorMessage ? (
          <p className="feedback feedback-error">{errorMessage}</p>
        ) : null}
        {noticeMessage ? (
          <p className="feedback feedback-notice">{noticeMessage}</p>
        ) : null}

        <form className="auth-form admin-form" onSubmit={handleSubmit}>
          <label>
            Title
            <input
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="e.g. Midnight Drive"
              required
            />
          </label>
          <div className="admin-grid">
            <label>
              Artist
              <input
                value={form.artist}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    artist: event.target.value,
                  }))
                }
                placeholder="Unknown Artist"
              />
            </label>
            <label>
              Album
              <input
                value={form.album}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    album: event.target.value,
                  }))
                }
                placeholder="Local Library"
              />
            </label>
            <label>
              Genre
              <input
                value={form.genre}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    genre: event.target.value,
                  }))
                }
                placeholder="Optional"
              />
            </label>
            <label>
              Mood
              <input
                value={form.mood}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    mood: event.target.value,
                  }))
                }
                placeholder="Local"
              />
            </label>
          </div>
          <label>
            Audio file
            <input
              id="admin-audio-input"
              type="file"
              accept="audio/*"
              onChange={(event) =>
                setAudioFile(event.target.files?.[0] ?? null)
              }
              required
            />
          </label>
          <label>
            Cover image (optional)
            <input
              id="admin-cover-input"
              type="file"
              accept="image/*"
              onChange={(event) =>
                setCoverFile(event.target.files?.[0] ?? null)
              }
            />
          </label>
          <button
            className="primary-action full-width"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Uploading…' : 'Upload track'}
          </button>
        </form>
      </section>

      <section className="admin-panel">
        <div className="auth-copy">
          <p className="section-kicker">Library</p>
          <h2>{tracks.length} track{tracks.length === 1 ? '' : 's'}</h2>
          <p>Remove a track to take it out of the library for everyone.</p>
        </div>

        {tracks.length ? (
          <ul className="admin-track-grid">
            {tracks.map((track) => (
              <li key={track.id} className="admin-track-card">
                <TrackArtwork track={track} className="admin-track-cover" />
                <div className="admin-track-info">
                  <strong title={track.title}>{track.title}</strong>
                  <small title={`${track.artist} · ${track.album}`}>
                    {track.artist} · {track.album}
                  </small>
                </div>
                <button
                  className="subtle-action danger full-width"
                  onClick={() => handleDelete(track.id, track.title)}
                  disabled={pendingDeleteId === track.id}
                  type="button"
                >
                  {pendingDeleteId === track.id ? 'Removing…' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="admin-empty">No tracks yet. Upload one above.</p>
        )}
      </section>
    </main>
  );
}
