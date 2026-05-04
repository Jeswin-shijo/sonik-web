import { FormEvent, useEffect, useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { ApiRequestError } from '../api/client';
import { apiBaseUrl } from '../config';
import type { MusicTrack, SessionState, ThemeMode } from '../types';
import { ThemeToggle } from '../components/ThemeToggle';
import { TrackArtwork } from '../components/TrackArtwork';
import { useConfirm } from '../components/ConfirmDialog';

type UploadForm = {
  title: string;
  artistId: string;
  singerId: string;
  lyricistId: string;
  album: string;
  genre: string;
  mood: string;
  audioFileName?: string;
  coverImageName?: string;
};

const emptyForm: UploadForm = {
  title: '',
  artistId: '',
  singerId: '',
  lyricistId: '',
  album: '',
  genre: '',
  mood: '',
  audioFileName: '',
  coverImageName: '',
};

type DraftTrack = UploadForm & {
  id: string;
  audioFileName?: string;
  coverImageName?: string;
  _sourceNameSinger?: string;
  _sourceNameArtist?: string;
  _sourceNameLyricist?: string;
};

type PersonType = 'singer' | 'artist' | 'lyricist' | null;

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

  const [singers, setSingers] = useState<any[]>([]);
  const [artists, setArtists] = useState<any[]>([]);
  const [lyricists, setLyricists] = useState<any[]>([]);

  const [personFormType, setPersonFormType] = useState<PersonType>(null);
  const [personName, setPersonName] = useState('');
  const [personImage, setPersonImage] = useState<File | null>(null);

  const [editingTrackId, setEditingTrackId] = useState<string | number | null>(null);
  const [editingPersonId, setEditingPersonId] = useState<string | number | null>(null);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [cameFromTrackForm, setCameFromTrackForm] = useState(false);
  const [draftTracks, setDraftTracks] = useState<DraftTrack[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveAllDrafts = async () => {
    setIsSubmitting(true);
    setErrorMessage('');
    let successCount = 0;
    
    for (const draft of draftTracks) {
      const payload = new FormData();
      payload.append('title', draft.title.trim() || 'Untitled');
      if (draft.artistId) payload.append('artistId', draft.artistId);
      if (draft.singerId) payload.append('singerId', draft.singerId);
      if (draft.lyricistId) payload.append('lyricistId', draft.lyricistId);
      if (draft.album?.trim()) payload.append('album', draft.album.trim());
      if (draft.genre?.trim()) payload.append('genre', draft.genre.trim());
      if (draft.mood?.trim()) payload.append('mood', draft.mood.trim());
      if (draft.audioFileName?.trim()) payload.append('audioFileName', draft.audioFileName.trim());
      if (draft.coverImageName?.trim()) payload.append('coverImageName', draft.coverImageName.trim());
      const artistName = draft._sourceNameArtist?.trim();
      if (artistName) payload.append('artist', artistName);

      try {
        const response = await fetch(`${apiBaseUrl}/tracks/admin/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
          body: payload,
        });
        if (response.ok) {
           successCount++;
        }
      } catch (e) {
        console.error(e);
      }
    }
    
    setIsSubmitting(false);
    if (successCount > 0) {
       setNoticeMessage(`Successfully saved ${successCount} drafts.`);
       setDraftTracks([]);
       fetchGridPage(0, null);
    } else {
       setErrorMessage("Failed to save drafts. Audio files might be required.");
    }
  };

  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  const [gridItems, setGridItems] = useState<any[]>([]);
  const [gridOffset, setGridOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const currentTabRef = useRef<PersonType>(null);
  const fetchingRef = useRef(false);

  const fetchPeople = async () => {
    try {
      const [sRes, aRes, lRes] = await Promise.all([
        fetch(`${apiBaseUrl}/people/singers`).then(r => r.json()),
        fetch(`${apiBaseUrl}/people/artists`).then(r => r.json()),
        fetch(`${apiBaseUrl}/people/lyricists`).then(r => r.json()),
      ]);
      if (sRes.singers) setSingers(sRes.singers);
      if (aRes.artists) setArtists(aRes.artists);
      if (lRes.lyricists) setLyricists(lRes.lyricists);
    } catch (e) {
      console.error('Failed to fetch people', e);
    }
  };

  useEffect(() => {
    fetchPeople();
  }, []);

  const fetchGridPage = useCallback(async (offset: number, type: PersonType, force = false) => {
    if (fetchingRef.current && !force) return;
    fetchingRef.current = true;
    setIsLoadingMore(true);
    try {
      const endpoint = type === null 
        ? `${apiBaseUrl}/tracks?offset=${offset}&limit=25`
        : `${apiBaseUrl}/people/${type}s?offset=${offset}&limit=25`;
      
      const res = await fetch(endpoint).then(r => r.json());
      
      if (currentTabRef.current !== type) return;
      
      const newItems = type === null ? res.tracks : res[`${type}s`];
      
      if (!newItems || newItems.length < 25) setHasMore(false);
      
      if (offset === 0) {
        setGridItems(newItems || []);
      } else {
        setGridItems(prev => {
          const existingIds = new Set(prev.map(i => i.id));
          const filtered = (newItems || []).filter((i: any) => !existingIds.has(i.id));
          return [...prev, ...filtered];
        });
      }
      setGridOffset(offset + (newItems?.length || 0));
    } catch (e) {
      console.error(e);
    } finally {
      if (currentTabRef.current === type) {
        setIsLoadingMore(false);
      }
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    currentTabRef.current = personFormType;
    setGridItems([]);
    setGridOffset(0);
    setHasMore(true);
    setEditingPersonId(null);
    setPersonName('');
    setPersonImage(null);
    setSelectedIds(new Set());
    fetchGridPage(0, personFormType, true);
  }, [personFormType, fetchGridPage]);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: any) => {
    if (isLoadingMore) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchGridPage(gridOffset, personFormType);
      }
    });
    if (node) observerRef.current.observe(node);
  }, [isLoadingMore, hasMore, gridOffset, personFormType, fetchGridPage]);

  useEffect(() => {
    if (!noticeMessage) return;
    const timer = setTimeout(() => setNoticeMessage(''), 4000);
    return () => clearTimeout(timer);
  }, [noticeMessage]);

  function handleEditEntity(item: any) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setErrorMessage('');
    setNoticeMessage('');
    if (personFormType) {
      setEditingPersonId(item.id);
      setPersonName(item.name);
      setPersonImage(null);
    } else {
      setEditingTrackId(item.id);
      setEditingDraftId(null);
      setForm({
        title: item.title,
        album: item.album || '',
        genre: item.genre || '',
        mood: item.mood || '',
        singerId: item.singerId || '',
        artistId: item.artistId || '',
        lyricistId: item.lyricistId || '',
        audioFileName: item.localFileName || '',
        coverImageName: item.coverName || '',
      });
      setAudioFile(null);
      setCoverFile(null);
    }
  }

  async function handleAddPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    if (!personFormType) return;
    if (!personName.trim()) {
      setErrorMessage('Please provide a name.');
      return;
    }

    const payload = new FormData();
    payload.append('name', personName.trim());
    if (personImage) payload.append('image', personImage);

    setIsSubmitting(true);
    try {
      const endpoint = editingPersonId 
        ? `${apiBaseUrl}/people/${personFormType}s/${editingPersonId}`
        : `${apiBaseUrl}/people/${personFormType}s`;
      const response = await fetch(endpoint, {
        method: editingPersonId ? 'PATCH' : 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: payload,
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        const message = Array.isArray(body?.message) ? body?.message.join(', ') : body?.message;
        throw new Error(message || 'Failed to add person');
      }

      await fetchPeople();
      
      if (cameFromTrackForm) {
        const addedEntity = body?.[personFormType as string];
        if (addedEntity?.id && !editingPersonId) {
          setForm(c => ({ ...c, [`${personFormType}Id`]: String(addedEntity.id) }));
        }
        setNoticeMessage(editingPersonId ? `${personFormType} updated.` : `Added ${personFormType}. Returned to track form.`);
        setPersonFormType(null);
        setCameFromTrackForm(false);
      } else {
        setNoticeMessage(editingPersonId ? `${personFormType} updated.` : `Added ${personFormType} successfully.`);
        setGridItems([]);
        setGridOffset(0);
        setHasMore(true);
        fetchGridPage(0, personFormType);
      }
      setEditingPersonId(null);
      setPersonName('');
      setPersonImage(null);
    } catch (error: any) {
      setErrorMessage(`Adding ${personFormType} failed: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleExport = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/tracks?limit=10000`).then(r => r.json());
      const allTracks = res.tracks || [];
      const data = allTracks.map((t: any) => ({
        Title: t.title || '',
        Album: t.album || '',
        Genre: t.genre || '',
        Mood: t.mood || '',
        Singer: singers.find(s => String(s.id) === String(t.singerId))?.name || '',
        Artist: artists.find(a => String(a.id) === String(t.artistId))?.name || '',
        Lyricist: lyricists.find(l => String(l.id) === String(t.lyricistId))?.name || '',
        AudioFile: t.localFileName || '',
        CoverImage: t.coverName || '',
      }));
      
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Tracks");
      XLSX.writeFile(wb, "sonik_tracks_export.xlsx");
      setNoticeMessage('Exported successfully.');
    } catch (e: any) {
      setErrorMessage(`Export failed: ${e.message}`);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        const drafts: DraftTrack[] = data.map((row: any) => {
          const singerName = row.Singer || '';
          const artistName = row.Artist || '';
          const lyricistName = row.Lyricist || '';
          
          return {
            id: Math.random().toString(36).substring(7),
            title: row.Title || '',
            album: row.Album || '',
            genre: row.Genre || '',
            mood: row.Mood || '',
            singerId: singers.find(s => s.name.toLowerCase() === singerName.toLowerCase())?.id?.toString() || '',
            artistId: artists.find(a => a.name.toLowerCase() === artistName.toLowerCase())?.id?.toString() || '',
            lyricistId: lyricists.find(l => l.name.toLowerCase() === lyricistName.toLowerCase())?.id?.toString() || '',
            audioFileName: row.AudioFile || '',
            coverImageName: row.CoverImage || '',
            _sourceNameSinger: singerName,
            _sourceNameArtist: artistName,
            _sourceNameLyricist: lyricistName,
          };
        });
        
        setDraftTracks(prev => [...prev, ...drafts]);
        setNoticeMessage(`Imported ${drafts.length} tracks as drafts.`);
      } catch (err: any) {
        setErrorMessage(`Import failed: ${err.message}`);
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setNoticeMessage('');

    if (!editingTrackId && !audioFile) {
      setErrorMessage('Please choose an audio file.');
      return;
    }
    if (!form.title.trim()) {
      setErrorMessage('Please give the track a title.');
      return;
    }

    const payload = new FormData();
    if (audioFile) payload.append('audio', audioFile);
    if (coverFile) payload.append('cover', coverFile);
    payload.append('title', form.title.trim());
    if (form.artistId) payload.append('artistId', form.artistId);
    if (form.singerId) payload.append('singerId', form.singerId);
    if (form.lyricistId) payload.append('lyricistId', form.lyricistId);
    if (form.album.trim()) payload.append('album', form.album.trim());
    if (form.genre.trim()) payload.append('genre', form.genre.trim());
    if (form.mood.trim()) payload.append('mood', form.mood.trim());
    if (form.audioFileName?.trim()) payload.append('audioFileName', form.audioFileName.trim());
    if (form.coverImageName?.trim()) payload.append('coverImageName', form.coverImageName.trim());

    setIsSubmitting(true);

    try {
      const endpoint = editingTrackId
        ? `${apiBaseUrl}/tracks/admin/${editingTrackId}`
        : `${apiBaseUrl}/tracks/admin/upload`;
      const response = await fetch(endpoint, {
        method: editingTrackId ? 'PATCH' : 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: payload,
      });

      const body = (await response.json().catch(() => null)) as any;

      if (!response.ok) {
        const message = Array.isArray(body?.message) ? body?.message.join(', ') : body?.message;
        throw new ApiRequestError(response.status, message ?? 'Upload failed.');
      }

      setNoticeMessage(editingTrackId ? `"${form.title.trim()}" updated.` : `"${form.title.trim()}" uploaded.`);
      setEditingTrackId(null);
      setForm(emptyForm);
      setAudioFile(null);
      setCoverFile(null);
      const audioInput = document.getElementById('admin-audio-input') as HTMLInputElement | null;
      const coverInput = document.getElementById('admin-cover-input') as HTMLInputElement | null;
      if (audioInput) audioInput.value = '';
      if (coverInput) coverInput.value = '';
      onTrackUploaded();
      
      if (editingDraftId) {
        setDraftTracks(prev => prev.filter(d => d.id !== editingDraftId));
        setEditingDraftId(null);
      }
      
      setGridItems([]);
      setGridOffset(0);
      setHasMore(true);
      fetchGridPage(0, null);
    } catch (error: any) {
      setErrorMessage(error.message || 'Upload failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    const confirmed = await confirm({
      title: `Remove ${selectedIds.size} ${personFormType ? personFormType + 's' : 'tracks'}?`,
      message: `This will remove the selected items from the shared library.`,
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!confirmed) return;

    setIsDeletingBulk(true);
    setErrorMessage('');
    
    try {
      const promises = Array.from(selectedIds).map(id => {
        const endpoint = personFormType
          ? `${apiBaseUrl}/people/${personFormType}s/${id}`
          : `${apiBaseUrl}/tracks/admin/${id}`;
        return fetch(endpoint, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session.accessToken}` },
        }).then(res => {
          if (!res.ok) throw new Error(`Failed to delete ${id}`);
          return id;
        });
      });

      await Promise.all(promises);
      
      setGridItems(prev => prev.filter(item => !selectedIds.has(item.id)));
      if (!personFormType) {
        Array.from(selectedIds).forEach(id => onTrackDeleted(String(id)));
      } else {
        fetchPeople();
      }
      setNoticeMessage(`Removed ${selectedIds.size} items.`);
      setSelectedIds(new Set());
    } catch (err: any) {
      setErrorMessage(err.message || 'Bulk delete failed.');
    } finally {
      setIsDeletingBulk(false);
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
        throw new Error('Delete failed.');
      }

      onTrackDeleted(trackId);
      setNoticeMessage(`"${title}" removed.`);
      setGridItems(prev => prev.filter(t => String(t.id) !== String(trackId)));
    } catch (error: any) {
      setErrorMessage(error.message);
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

      <div className="auth-toolbar" style={{ marginTop: '1rem', justifyContent: 'center' }}>
        <div className="admin-tabs">
          <button
            className={`tab-button ${!personFormType ? 'is-active' : ''}`}
            onClick={() => { setCameFromTrackForm(false); setPersonFormType(null); }}
          >
            Track
          </button>
          <button
            className={`tab-button ${personFormType === 'singer' ? 'is-active' : ''}`}
            onClick={() => { setCameFromTrackForm(false); setPersonFormType('singer'); }}
          >
            Singer
          </button>
          <button
            className={`tab-button ${personFormType === 'artist' ? 'is-active' : ''}`}
            onClick={() => { setCameFromTrackForm(false); setPersonFormType('artist'); }}
          >
            Artist
          </button>
          <button
            className={`tab-button ${personFormType === 'lyricist' ? 'is-active' : ''}`}
            onClick={() => { setCameFromTrackForm(false); setPersonFormType('lyricist'); }}
          >
            Lyricist
          </button>
        </div>
      </div>

      {personFormType ? (
        <section key={personFormType || 'track'} className="admin-panel">
          <div className="auth-copy">
            <p className="section-kicker">Sonik Admin</p>
            <h1>{editingPersonId ? 'Edit' : 'Add'} {personFormType}</h1>
            <p>{editingPersonId ? 'Update details.' : `Add a new ${personFormType} to the database.`}</p>
          </div>
          {errorMessage ? <p className="feedback feedback-error">{errorMessage}</p> : null}
          <form className="auth-form admin-form" onSubmit={handleAddPerson}>
            <label>
              Name
              <input
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder={`e.g. ${personFormType === 'singer' ? 'Arijit Singh' : 'A.R. Rahman'}`}
                required
              />
            </label>
            <label>
              Image (optional)
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPersonImage(e.target.files?.[0] ?? null)}
              />
            </label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              {(editingPersonId || cameFromTrackForm) && (
                <button
                  className="subtle-action"
                  type="button"
                  onClick={() => {
                    if (cameFromTrackForm) {
                      setPersonFormType(null);
                      setCameFromTrackForm(false);
                    } else {
                      setEditingPersonId(null);
                      setPersonName('');
                      setPersonImage(null);
                    }
                  }}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
              )}
              <button
                className="primary-action full-width"
                disabled={isSubmitting}
                type="submit"
                style={{ flex: (editingPersonId || cameFromTrackForm) ? 1 : undefined }}
              >
                {isSubmitting ? 'Saving…' : (editingPersonId ? 'Update' : 'Save')}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section key="track-upload" className="admin-panel">
          <div className="auth-copy">
            <p className="section-kicker">Sonik Admin</p>
            <h1>{editingTrackId ? 'Edit track' : (editingDraftId ? 'Upload draft track' : 'Upload a track')}</h1>
            <p>{editingTrackId ? 'Update track details.' : 'Add audio files to the shared library. Cover image is optional.'}</p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', marginBottom: '1rem' }}>
            <input type="file" accept=".xlsx, .xls, .csv" ref={fileInputRef} onChange={handleImport} style={{ display: 'none' }} />
            <button className="subtle-action" type="button" onClick={() => fileInputRef.current?.click()}>
              Import from Excel
            </button>
            <button className="subtle-action" type="button" onClick={handleExport}>
              Export to Excel
            </button>
          </div>

          {errorMessage ? (
            <p className="feedback feedback-error">{errorMessage}</p>
          ) : null}
          {noticeMessage ? (
            <p className="feedback feedback-notice">{noticeMessage}</p>
          ) : null}

          {draftTracks.length > 0 && !editingDraftId && !editingTrackId && (
            <div style={{ marginTop: '1rem', marginBottom: '2rem', padding: '1.5rem', background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Pending Imports ({draftTracks.length})</h3>
              <ul className="admin-track-grid">
                {draftTracks.map(draft => (
                  <li key={draft.id} className="admin-track-card" style={{ background: 'var(--bg-color)', position: 'relative' }}>
                    <button 
                      className="admin-card-edit-btn center" 
                      onClick={() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        setEditingTrackId(null);
                        setEditingDraftId(draft.id);
                        setErrorMessage('');
                        setNoticeMessage('');
                        setForm({
                          title: draft.title,
                          artistId: draft.artistId,
                          singerId: draft.singerId,
                          lyricistId: draft.lyricistId,
                          album: draft.album,
                          genre: draft.genre,
                          mood: draft.mood,
                          audioFileName: draft.audioFileName,
                          coverImageName: draft.coverImageName,
                        });
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    </button>
                    <button 
                      className="subtle-action danger" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setDraftTracks(prev => prev.filter(d => d.id !== draft.id));
                      }}
                      style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', zIndex: 10, padding: '0.25rem', width: '2rem', height: '2rem', minWidth: 'unset', minHeight: 'unset', background: 'var(--control-bg-strong)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>

                    <div className="admin-track-info" style={{ padding: '1.5rem 1rem 1rem 1rem' }}>
                      <strong title={draft.title}>{draft.title || 'Untitled'}</strong>
                      <small>{draft._sourceNameArtist || draft._sourceNameSinger || 'Unknown Artist'} · {draft.album || 'Unknown Album'}</small>
                    </div>
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button 
                  className="primary-action" 
                  onClick={handleSaveAllDrafts}
                  disabled={isSubmitting || draftTracks.length === 0}
                  style={{ padding: '0 2rem' }}
                >
                  {isSubmitting ? 'Saving...' : `Save All (${draftTracks.length})`}
                </button>
              </div>
            </div>
          )}

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
                Singer
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select
                    value={form.singerId}
                    onChange={(e) => setForm(c => ({ ...c, singerId: e.target.value }))}
                    style={{ flex: 1 }}
                  >
                    <option value="">Select Singer...</option>
                    {singers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <button type="button" className="subtle-action" onClick={() => { setCameFromTrackForm(true); setPersonFormType('singer'); }}>Add</button>
                </div>
              </label>
              <label>
                Artist (Composer)
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select
                    value={form.artistId}
                    onChange={(e) => setForm(c => ({ ...c, artistId: e.target.value }))}
                    style={{ flex: 1 }}
                  >
                    <option value="">Select Artist...</option>
                    {artists.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <button type="button" className="subtle-action" onClick={() => { setCameFromTrackForm(true); setPersonFormType('artist'); }}>Add</button>
                </div>
              </label>
              <label>
                Lyricist
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select
                    value={form.lyricistId}
                    onChange={(e) => setForm(c => ({ ...c, lyricistId: e.target.value }))}
                    style={{ flex: 1 }}
                  >
                    <option value="">Select Lyricist...</option>
                    {lyricists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                  <button type="button" className="subtle-action" onClick={() => { setCameFromTrackForm(true); setPersonFormType('lyricist'); }}>Add</button>
                </div>
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
              Media file (optional)
              <input
                id="admin-audio-input"
                type="file"
                accept="audio/*,video/*"
                onChange={(event) =>
                  setAudioFile(event.target.files?.[0] ?? null)
                }
              />
              {form.audioFileName && !audioFile && <small style={{ color: 'var(--cyan)', marginTop: '-0.5rem' }}>Using mapped file: {form.audioFileName}</small>}
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
              {form.coverImageName && !coverFile && <small style={{ color: 'var(--cyan)', marginTop: '-0.5rem' }}>Using mapped cover: {form.coverImageName}</small>}
            </label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              {(editingTrackId || editingDraftId) && (
                <button
                  className="subtle-action"
                  type="button"
                  onClick={() => {
                    setEditingTrackId(null);
                    setEditingDraftId(null);
                    setForm(emptyForm);
                  }}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
              )}
              <button
                className="primary-action full-width"
                disabled={isSubmitting}
                type="submit"
                style={{ flex: (editingTrackId || editingDraftId) ? 1 : undefined }}
              >
                {isSubmitting ? 'Uploading…' : (editingTrackId ? 'Update track' : (editingDraftId ? 'Upload draft' : 'Upload track'))}
              </button>
            </div>
          </form>
        </section>
      )}

      <section key={`grid-${personFormType || 'track'}`} className="admin-panel">
        <div className="auth-copy">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
            <div>
              <p className="section-kicker">Library</p>
              <h2 style={{ margin: '0.5rem 0' }}>{gridItems.length} {personFormType ? personFormType : 'track'}{gridItems.length === 1 ? '' : 's'}</h2>
              <p>Hover over a card to edit it.</p>
            </div>
            {gridItems.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  className="subtle-action"
                  onClick={() => {
                    if (selectedIds.size === gridItems.length) {
                      setSelectedIds(new Set());
                    } else {
                      setSelectedIds(new Set(gridItems.map(i => i.id)));
                    }
                  }}
                >
                  {selectedIds.size === gridItems.length ? 'Deselect All' : 'Select All'}
                </button>
                {selectedIds.size > 0 && (
                  <button
                    className="subtle-action danger"
                    onClick={handleBulkDelete}
                    disabled={isDeletingBulk}
                  >
                    {isDeletingBulk ? 'Removing...' : `Remove Selected (${selectedIds.size})`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {gridItems.length ? (
          <ul className="admin-track-grid">
            {gridItems.map((item, index) => {
              const isLast = index === gridItems.length - 1;
              return (
                <li key={item.id} className="admin-track-card" ref={isLast ? lastElementRef : null} style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '0.5rem', left: '0.5rem', zIndex: 10 }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={(e) => {
                        const newSet = new Set(selectedIds);
                        if (e.target.checked) newSet.add(item.id);
                        else newSet.delete(item.id);
                        setSelectedIds(newSet);
                      }}
                      style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                    />
                  </div>
                  <button className="admin-card-edit-btn" onClick={() => handleEditEntity(item)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  </button>
                  {personFormType ? (
                    <>
                      {item.imageName ? (
                        <img src={`${apiBaseUrl}/uploads/people/${item.imageName}`} alt={item.name} className="admin-track-cover" style={{ objectFit: 'cover' }} />
                      ) : (
                        <div className="admin-track-cover cover-blue" />
                      )}
                      <div className="admin-track-info">
                        <strong title={item.name}>{item.name}</strong>
                      </div>
                    </>
                  ) : (
                    <>
                      <TrackArtwork track={item} className="admin-track-cover" />
                      <div className="admin-track-info">
                        <strong title={item.title}>{item.title}</strong>
                        <small title={`${item.artist} · ${item.album}`}>
                          {item.artist} · {item.album}
                        </small>
                      </div>
                      <button
                        className="subtle-action danger full-width"
                        onClick={() => handleDelete(item.id, item.title)}
                        disabled={pendingDeleteId === item.id}
                        type="button"
                        style={{ marginTop: 'auto' }}
                      >
                        {pendingDeleteId === item.id ? 'Removing…' : 'Remove'}
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="admin-empty">No entries found.</p>
        )}
        {isLoadingMore && <p className="admin-empty">Loading more...</p>}
      </section>
    </main>
  );
}
