import { FormEvent, useEffect, useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { ApiRequestError } from '../api/client';
import { apiBaseUrl } from '../config';
import type { MusicTrack, SessionState, ThemeMode } from '../types';
import { ThemeToggle } from '../components/ThemeToggle';
import { TrackArtwork } from '../components/TrackArtwork';
import { useConfirm } from '../components/ConfirmDialog';
import { trackLanguageOptions } from '../helpers/languages';

const personPalettes = [
  ['#f05a8a', '#6f38d8'],
  ['#53d6c5', '#2767a3'],
  ['#ffb15d', '#f05f57'],
  ['#7ea8ff', '#28715e'],
  ['#b58cff', '#cf5d87'],
  ['#f3cf65', '#1b8f89'],
];

function personGradient(name: string) {
  const idx = Math.abs(
    (name || '?').split('').reduce((t, c) => t + c.charCodeAt(0), 0)
  ) % personPalettes.length;
  const [a, b] = personPalettes[idx];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

type UploadForm = {
  title: string;
  artistId: string;
  singerId: string;
  lyricistId: string;
  album: string;
  genre: string;
  mood: string;
  language: string;
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
  language: '',
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
  const [selectionMode, setSelectionMode] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);
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
          headers: { Authorization: `Bearer ${session.accessToken}` },
          body: payload,
        });
        if (response.ok) successCount++;
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
      setErrorMessage('Failed to save drafts. Audio files might be required.');
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

  useEffect(() => { fetchPeople(); }, []);

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
          return [...prev, ...(newItems || []).filter((i: any) => !existingIds.has(i.id))];
        });
      }
      setGridOffset(offset + (newItems?.length || 0));
    } catch (e) {
      console.error(e);
    } finally {
      if (currentTabRef.current === type) setIsLoadingMore(false);
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
      if (entries[0].isIntersecting && hasMore) fetchGridPage(gridOffset, personFormType);
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
        language: (item as any).language || '',
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
    if (!personName.trim()) { setErrorMessage('Please provide a name.'); return; }

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
        headers: { Authorization: `Bearer ${session.accessToken}` },
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
        if (addedEntity?.id && !editingPersonId) setForm(c => ({ ...c, [`${personFormType}Id`]: String(addedEntity.id) }));
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
        Language: t.language || '',
        Mood: t.mood || '',
        Singer: singers.find(s => String(s.id) === String(t.singerId))?.name || '',
        Artist: artists.find(a => String(a.id) === String(t.artistId))?.name || '',
        Lyricist: lyricists.find(l => String(l.id) === String(t.lyricistId))?.name || '',
        AudioFile: t.localFileName || '',
        CoverImage: t.coverName || '',
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Tracks');
      XLSX.writeFile(wb, 'sonik_tracks_export.xlsx');
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
        const ws = wb.Sheets[wb.SheetNames[0]];
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
            language: row.Language || '',
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
    if (!editingTrackId && !audioFile) { setErrorMessage('Please choose an audio file.'); return; }
    if (!form.title.trim()) { setErrorMessage('Please give the track a title.'); return; }
    if (audioFile && audioFile.size > 50 * 1024 * 1024) { setErrorMessage('Audio file must be under 50 MB.'); return; }
    if (coverFile && coverFile.size > 5 * 1024 * 1024) { setErrorMessage('Cover image must be under 5 MB.'); return; }

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
    if (form.language.trim()) payload.append('language', form.language.trim());
    if (form.audioFileName?.trim()) payload.append('audioFileName', form.audioFileName.trim());
    if (form.coverImageName?.trim()) payload.append('coverImageName', form.coverImageName.trim());

    setIsSubmitting(true);
    try {
      const endpoint = editingTrackId
        ? `${apiBaseUrl}/tracks/admin/${editingTrackId}`
        : `${apiBaseUrl}/tracks/admin/upload`;
      const response = await fetch(endpoint, {
        method: editingTrackId ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${session.accessToken}` },
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
      message: 'This will remove the selected items from the shared library.',
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
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (!response.ok) throw new Error('Delete failed.');
      onTrackDeleted(trackId);
      setNoticeMessage(`"${title}" removed.`);
      setGridItems(prev => prev.filter(t => String(t.id) !== String(trackId)));
    } catch (error: any) {
      setErrorMessage(error.message);
    } finally {
      setPendingDeleteId(null);
    }
  }

  const allSelected = gridItems.length > 0 && selectedIds.size === gridItems.length;

  return (
    <main className="admin-shell">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="admin-header">
        <div className="admin-header-left">
          <button className="admin-back-btn" onClick={onClose} type="button">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </button>
          <div className="admin-header-brand">
            <svg viewBox="0 0 1024 1024" width="28" height="28" fill="none" aria-hidden="true">
              <defs>
                <linearGradient id="ahlg" x1="215" y1="0" x2="809" y2="0" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#f5c15d" />
                  <stop offset="0.5" stopColor="#ff8c69" />
                  <stop offset="1" stopColor="#55d6c2" />
                </linearGradient>
              </defs>
              <rect width="1024" height="1024" rx="236" fill="#120f18" />
              <rect x="215" y="404" width="90" height="216" rx="45" fill="url(#ahlg)" />
              <rect x="341" y="359" width="90" height="306" rx="45" fill="url(#ahlg)" />
              <rect x="467" y="314" width="90" height="396" rx="45" fill="url(#ahlg)" />
              <rect x="593" y="359" width="90" height="306" rx="45" fill="url(#ahlg)" />
              <rect x="719" y="404" width="90" height="216" rx="45" fill="url(#ahlg)" />
            </svg>
            <div>
              <span className="admin-header-title">Admin Panel</span>
              <span className="admin-header-sub">Sonik</span>
            </div>
          </div>
        </div>
        <div className="admin-header-right">
          <span className="admin-pill">{session.user.email}</span>
          <ThemeToggle themeMode={themeMode} onToggle={onThemeToggle} />
        </div>
      </header>

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <div className="admin-tabs-row">
        <div className="admin-tabs">
          <button className={`tab-button ${!personFormType ? 'is-active' : ''}`} onClick={() => { setCameFromTrackForm(false); setPersonFormType(null); }}>Tracks</button>
          <button className={`tab-button ${personFormType === 'singer' ? 'is-active' : ''}`} onClick={() => { setCameFromTrackForm(false); setPersonFormType('singer'); }}>Singers</button>
          <button className={`tab-button ${personFormType === 'artist' ? 'is-active' : ''}`} onClick={() => { setCameFromTrackForm(false); setPersonFormType('artist'); }}>Artists</button>
          <button className={`tab-button ${personFormType === 'lyricist' ? 'is-active' : ''}`} onClick={() => { setCameFromTrackForm(false); setPersonFormType('lyricist'); }}>Lyricists</button>
        </div>
      </div>

      {/* ── Form panel ─────────────────────────────────────────── */}
      {personFormType ? (
        <section key={personFormType} className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <p className="section-kicker">People</p>
              <h2 className="admin-panel-title">{editingPersonId ? 'Edit' : 'Add'} {personFormType}</h2>
            </div>
          </div>

          {errorMessage && <p className="feedback feedback-error">{errorMessage}</p>}

          <form className="auth-form admin-form" onSubmit={handleAddPerson}>
            <label>
              Name
              <input value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder={`e.g. ${personFormType === 'singer' ? 'Arijit Singh' : 'A.R. Rahman'}`} required />
            </label>
            <label>
              Image <span className="admin-label-hint">(optional)</span>
              <input type="file" accept="image/*" onChange={(e) => setPersonImage(e.target.files?.[0] ?? null)} />
            </label>
            <div className="admin-form-actions">
              {(editingPersonId || cameFromTrackForm) && (
                <button className="subtle-action" type="button" onClick={() => {
                  if (cameFromTrackForm) { setPersonFormType(null); setCameFromTrackForm(false); }
                  else { setEditingPersonId(null); setPersonName(''); setPersonImage(null); }
                }}>Cancel</button>
              )}
              <button className="primary-action full-width" disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Saving…' : (editingPersonId ? 'Update' : 'Save')}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section key="track-upload" className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <p className="section-kicker">Library</p>
              <h2 className="admin-panel-title">{editingTrackId ? 'Edit track' : (editingDraftId ? 'Upload draft' : 'Upload a track')}</h2>
            </div>
            <div className="admin-toolbar">
              <input type="file" accept=".xlsx,.xls,.csv" ref={fileInputRef} onChange={handleImport} className="admin-hidden-input" />
              <button className="subtle-action" type="button" onClick={() => fileInputRef.current?.click()}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Import
              </button>
              <button className="subtle-action" type="button" onClick={handleExport}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export
              </button>
            </div>
          </div>

          {errorMessage && <p className="feedback feedback-error">{errorMessage}</p>}
          {noticeMessage && <p className="feedback feedback-notice">{noticeMessage}</p>}

          {/* Pending drafts */}
          {draftTracks.length > 0 && !editingDraftId && !editingTrackId && (
            <div className="admin-drafts">
              <div className="admin-drafts-header">
                <h3>Pending Imports <span className="admin-drafts-count">{draftTracks.length}</span></h3>
                <button className="primary-action" onClick={handleSaveAllDrafts} disabled={isSubmitting || draftTracks.length === 0}>
                  {isSubmitting ? 'Saving…' : `Save All (${draftTracks.length})`}
                </button>
              </div>
              <ul className="admin-track-grid">
                {draftTracks.map(draft => (
                  <li key={draft.id} className="admin-track-card">
                    <button className="admin-card-edit-btn center" onClick={() => {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      setEditingTrackId(null);
                      setEditingDraftId(draft.id);
                      setErrorMessage('');
                      setNoticeMessage('');
                      setForm({ title: draft.title, artistId: draft.artistId, singerId: draft.singerId, lyricistId: draft.lyricistId, album: draft.album, genre: draft.genre, mood: draft.mood, language: draft.language || '', audioFileName: draft.audioFileName, coverImageName: draft.coverImageName });
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    </button>
                    <button className="admin-card-delete-btn" onClick={(e) => { e.stopPropagation(); setDraftTracks(prev => prev.filter(d => d.id !== draft.id)); }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                    <div className="admin-draft-placeholder" />
                    <div className="admin-track-info">
                      <strong title={draft.title}>{draft.title || 'Untitled'}</strong>
                      <small>{draft._sourceNameArtist || draft._sourceNameSinger || 'Unknown'} · {draft.album || 'Unknown Album'}</small>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form className="auth-form admin-form" onSubmit={handleSubmit}>
            <label>
              Title
              <input value={form.title} onChange={(e) => setForm(c => ({ ...c, title: e.target.value }))} placeholder="e.g. Midnight Drive" required />
            </label>
            <div className="admin-grid">
              <label>
                Singer
                <div className="admin-field-row">
                  <select value={form.singerId} onChange={(e) => setForm(c => ({ ...c, singerId: e.target.value }))}>
                    <option value="">Select Singer…</option>
                    {singers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <button type="button" className="subtle-action admin-add-btn" onClick={() => { setCameFromTrackForm(true); setPersonFormType('singer'); }}>+ Add</button>
                </div>
              </label>
              <label>
                Artist (Composer)
                <div className="admin-field-row">
                  <select value={form.artistId} onChange={(e) => setForm(c => ({ ...c, artistId: e.target.value }))}>
                    <option value="">Select Artist…</option>
                    {artists.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <button type="button" className="subtle-action admin-add-btn" onClick={() => { setCameFromTrackForm(true); setPersonFormType('artist'); }}>+ Add</button>
                </div>
              </label>
              <label>
                Lyricist
                <div className="admin-field-row">
                  <select value={form.lyricistId} onChange={(e) => setForm(c => ({ ...c, lyricistId: e.target.value }))}>
                    <option value="">Select Lyricist…</option>
                    {lyricists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                  <button type="button" className="subtle-action admin-add-btn" onClick={() => { setCameFromTrackForm(true); setPersonFormType('lyricist'); }}>+ Add</button>
                </div>
              </label>
              <label>
                Album
                <input value={form.album} onChange={(e) => setForm(c => ({ ...c, album: e.target.value }))} placeholder="Local Library" />
              </label>
              <label>
                Genre
                <input value={form.genre} onChange={(e) => setForm(c => ({ ...c, genre: e.target.value }))} placeholder="Optional" />
              </label>
              <label>
                Mood
                <input value={form.mood} onChange={(e) => setForm(c => ({ ...c, mood: e.target.value }))} placeholder="Local" />
              </label>
              <label>
                Language
                <select value={form.language} onChange={(e) => setForm(c => ({ ...c, language: e.target.value }))}>
                  <option value="">Select Language…</option>
                  {trackLanguageOptions.map(opt => (
                    <option key={opt.code} value={opt.label}>{opt.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="admin-file-fields">
              <label>
                Audio file <span className="admin-label-hint">{editingTrackId ? '(optional — replaces existing)' : '(required)'}</span>
                <input id="admin-audio-input" type="file" accept="audio/*,video/*" onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)} />
                {form.audioFileName && !audioFile && <span className="admin-file-hint">Mapped: {form.audioFileName}</span>}
              </label>
              <label>
                Cover image <span className="admin-label-hint">(optional)</span>
                <input id="admin-cover-input" type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} />
                {form.coverImageName && !coverFile && <span className="admin-file-hint">Mapped: {form.coverImageName}</span>}
              </label>
            </div>

            <div className="admin-form-actions">
              {(editingTrackId || editingDraftId) && (
                <button className="subtle-action" type="button" onClick={() => { setEditingTrackId(null); setEditingDraftId(null); setForm(emptyForm); }}>Cancel</button>
              )}
              <button className="primary-action full-width" disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Uploading…' : (editingTrackId ? 'Update track' : (editingDraftId ? 'Upload draft' : 'Upload track'))}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ── Grid panel ─────────────────────────────────────────── */}
      <section key={`grid-${personFormType || 'track'}`} className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <p className="section-kicker">Library</p>
            <h2 className="admin-panel-title">
              {gridItems.length} {personFormType ?? 'track'}{gridItems.length === 1 ? '' : 's'}
            </h2>
          </div>
          {selectionMode && (
            <div className="admin-bulk-bar">
              <button className="subtle-action" onClick={() => {
                setSelectedIds(allSelected ? new Set() : new Set(gridItems.map(i => i.id)));
              }}>
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
              {selectedIds.size > 0 && (
                <button className="subtle-action danger" onClick={handleBulkDelete} disabled={isDeletingBulk}>
                  {isDeletingBulk ? 'Removing…' : `Remove (${selectedIds.size})`}
                </button>
              )}
              <button className="subtle-action" onClick={() => { setSelectionMode(false); setSelectedIds(new Set()); }}>
                Cancel
              </button>
            </div>
          )}
        </div>

        {gridItems.length > 0 ? (
          <ul className="admin-track-grid">
            {gridItems.map((item, index) => {
              const isLast = index === gridItems.length - 1;
              const isSelected = selectedIds.has(item.id);

              const startLongPress = () => {
                didLongPress.current = false;
                longPressTimer.current = setTimeout(() => {
                  didLongPress.current = true;
                  setSelectionMode(true);
                  setSelectedIds(prev => { const s = new Set(prev); s.add(item.id); return s; });
                }, 500);
              };
              const cancelLongPress = () => {
                if (longPressTimer.current) clearTimeout(longPressTimer.current);
              };
              const handleCardClick = () => {
                if (didLongPress.current) {
                  didLongPress.current = false;
                  return;
                }
                if (selectionMode) {
                  const next = new Set(selectedIds);
                  if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                  setSelectedIds(next);
                  if (next.size === 0) setSelectionMode(false);
                }
              };

              return (
                <li
                  key={item.id}
                  className={`admin-track-card${isSelected ? ' is-selected' : ''}${selectionMode ? ' selection-mode' : ''}`}
                  ref={isLast ? lastElementRef : null}
                  onMouseDown={startLongPress}
                  onMouseUp={cancelLongPress}
                  onMouseLeave={cancelLongPress}
                  onTouchStart={startLongPress}
                  onTouchEnd={cancelLongPress}
                  onClick={handleCardClick}
                >
                  {selectionMode && (
                    <span className={`admin-checkbox-mark${isSelected ? ' is-checked' : ''}`}>
                      <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 6 5 9 10 3"/></svg>
                    </span>
                  )}
                  {!selectionMode && (
                    <>
                      <button className="admin-card-edit-btn" onClick={(e) => { e.stopPropagation(); handleEditEntity(item); }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      </button>
                      {!personFormType && (
                        <button className="admin-card-delete-btn" onClick={(e) => { e.stopPropagation(); handleDelete(item.id, item.title); }} disabled={pendingDeleteId === item.id}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      )}
                    </>
                  )}
                  {personFormType ? (
                    <>
                      {item.imageName
                        ? <img src={`${apiBaseUrl}/uploads/people/${item.imageName}`} alt={item.name} className="admin-track-cover" style={{ objectFit: 'cover' }} />
                        : (
                          <div className="admin-track-cover admin-cover-placeholder" style={{ background: personGradient(item.name) }}>
                            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                          </div>
                        )
                      }
                      <div className="admin-track-info">
                        <strong title={item.name}>{item.name}</strong>
                      </div>
                    </>
                  ) : (
                    <>
                      <TrackArtwork track={item} className="admin-track-cover" />
                      <div className="admin-track-info">
                        <strong title={item.title}>{item.title}</strong>
                        <small title={`${item.artist} · ${item.album}`}>{item.artist} · {item.album}</small>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="admin-empty">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p>No entries found.</p>
          </div>
        )}
        {isLoadingMore && <p className="admin-loading">Loading more…</p>}
      </section>
    </main>
  );
}
