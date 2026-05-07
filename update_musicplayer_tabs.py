import re

def main():
    file_path = '/Users/jeswin/Desktop/projects/sonik/sonik-web/src/screens/MusicPlayer.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # 1. Remove from sidebar
    sidebar_singers = r"\{\s*singers\?\.length\s*\?\s*\(\s*<section className=\"crate-panel\">\s*<p className=\"section-kicker\">Singers</p>.*?</section>\s*\)\s*:\s*null\s*\}"
    sidebar_lyricists = r"\{\s*lyricists\?\.length\s*\?\s*\(\s*<section className=\"crate-panel\">\s*<p className=\"section-kicker\">Lyricists</p>.*?</section>\s*\)\s*:\s*null\s*\}"
    
    content = re.sub(sidebar_singers, "", content, flags=re.DOTALL)
    content = re.sub(sidebar_lyricists, "", content, flags=re.DOTALL)

    # 2. Add state for active tab
    if "const [activeGridTab, setActiveGridTab] = useState<'albums' | 'artists' | 'singers' | 'lyricists'>('albums');" not in content:
        state_insert_point = content.find('  const [trackView, setTrackView] = useState')
        if state_insert_point != -1:
            state_code = "  const [activeGridTab, setActiveGridTab] = useState<'albums' | 'artists' | 'singers' | 'lyricists'>('albums');\n"
            content = content[:state_insert_point] + state_code + content[state_insert_point:]

    # 3. Replace the main grid blocks with tabbed UI
    # The existing blocks for Artists and Albums are still in the main section.
    # Wait, earlier I might not have removed Artists and Albums, only Singers and Lyricists.
    
    # Let's dynamically find the block that starts with Artists and ends with Albums.
    artists_start = content.find('{artists.length ? (')
    if artists_start != -1:
        # Find the end of albums block
        albums_end_str = "              })}\n            </div>\n          </section>\n        ) : null}"
        albums_start = content.find('{albums.length ? (')
        if albums_start != -1:
            albums_end = content.find(albums_end_str, albums_start) + len(albums_end_str)
            
            # Remove the whole block from artists_start to albums_end
            if albums_end > artists_start:
                old_sections = content[artists_start:albums_end]
                
                new_tabbed_section = """
        <section className="content-section metadata-tabs-section">
          <div className="metadata-tabs">
            <button
              className={`metadata-tab-btn ${activeGridTab === 'albums' ? 'is-active' : ''}`}
              onClick={() => setActiveGridTab('albums')}
              type="button"
            >
              Albums
              {albums.length > 0 && <span className="tab-count">{albums.length}</span>}
            </button>
            <button
              className={`metadata-tab-btn ${activeGridTab === 'artists' ? 'is-active' : ''}`}
              onClick={() => setActiveGridTab('artists')}
              type="button"
            >
              Artists
              {artists.length > 0 && <span className="tab-count">{artists.length}</span>}
            </button>
            {singers && singers.length > 0 && (
              <button
                className={`metadata-tab-btn ${activeGridTab === 'singers' ? 'is-active' : ''}`}
                onClick={() => setActiveGridTab('singers')}
                type="button"
              >
                Singers
                <span className="tab-count">{singers.length}</span>
              </button>
            )}
            {lyricists && lyricists.length > 0 && (
              <button
                className={`metadata-tab-btn ${activeGridTab === 'lyricists' ? 'is-active' : ''}`}
                onClick={() => setActiveGridTab('lyricists')}
                type="button"
              >
                Lyricists
                <span className="tab-count">{lyricists.length}</span>
              </button>
            )}
          </div>

          <div className="metadata-tab-content fade-in-up" key={activeGridTab}>
            {activeGridTab === 'albums' && albums.length > 0 && (
              <div className="mix-grid">
                {albums.map((album) => {
                  const isActive = selectedPlaylistId === `album:${album.id}`;
                  const sampleTrack = album.tracks[0];
                  return (
                    <button
                      aria-pressed={isActive}
                      className={`mix-card${isActive ? ' is-active' : ''}`}
                      key={album.id}
                      onClick={() => onSelectAlbum(album.id)}
                      type="button"
                    >
                      <TrackArtwork
                        track={{
                          title: album.title,
                          coverClass: sampleTrack?.coverClass ?? 'cover-default',
                          coverUrl: sampleTrack?.coverUrl ?? null,
                        }}
                      />
                      <h3>{album.title}</h3>
                      <p>
                        {album.artist} · {album.trackCount}{' '}
                        {album.trackCount === 1 ? 'track' : 'tracks'}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {activeGridTab === 'artists' && artists.length > 0 && (
              <div className="mix-grid">
                {artists.map((artist) => {
                  const isActive = selectedPlaylistId === `artist:${artist.id}`;
                  const sampleTrack = artist.tracks[0];
                  return (
                    <button
                      aria-pressed={isActive}
                      className={`mix-card${isActive ? ' is-active' : ''}`}
                      key={artist.id}
                      onClick={() => onSelectArtist(artist.id)}
                      type="button"
                    >
                      <TrackArtwork
                        track={{
                          title: artist.name,
                          coverClass: sampleTrack?.coverClass ?? 'cover-velvet',
                          coverUrl: sampleTrack?.coverUrl ?? null,
                        }}
                      />
                      <h3>{artist.name}</h3>
                      <p>
                        {artist.trackCount}{' '}
                        {artist.trackCount === 1 ? 'track' : 'tracks'} ·{' '}
                        {artist.albumCount}{' '}
                        {artist.albumCount === 1 ? 'album' : 'albums'}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {activeGridTab === 'singers' && singers && singers.length > 0 && (
              <div className="mix-grid">
                {singers.map((singer) => {
                  const isActive = selectedPlaylistId === `singer:${singer.id}`;
                  const sampleTrack = singer.tracks[0];
                  return (
                    <button
                      aria-pressed={isActive}
                      className={`mix-card${isActive ? ' is-active' : ''}`}
                      key={singer.id}
                      onClick={() => onSelectSinger?.(singer.id)}
                      type="button"
                    >
                      {singer.imageName ? (
                        <img src={`${apiBaseUrl}/uploads/people/${singer.imageName}`} alt={singer.name} className="admin-track-cover" style={{ objectFit: 'cover', width: '100%', aspectRatio: '1/1', borderRadius: '8px', marginBottom: '0.75rem' }} />
                      ) : (
                        <TrackArtwork
                          track={{
                            title: singer.name,
                            coverClass: sampleTrack?.coverClass ?? 'cover-summer',
                            coverUrl: null,
                          }}
                        />
                      )}
                      <h3>{singer.name}</h3>
                      <p>
                        {singer.trackCount}{' '}
                        {singer.trackCount === 1 ? 'track' : 'tracks'}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {activeGridTab === 'lyricists' && lyricists && lyricists.length > 0 && (
              <div className="mix-grid">
                {lyricists.map((lyricist) => {
                  const isActive = selectedPlaylistId === `lyricist:${lyricist.id}`;
                  const sampleTrack = lyricist.tracks[0];
                  return (
                    <button
                      aria-pressed={isActive}
                      className={`mix-card${isActive ? ' is-active' : ''}`}
                      key={lyricist.id}
                      onClick={() => onSelectLyricist?.(lyricist.id)}
                      type="button"
                    >
                      {lyricist.imageName ? (
                        <img src={`${apiBaseUrl}/uploads/people/${lyricist.imageName}`} alt={lyricist.name} className="admin-track-cover" style={{ objectFit: 'cover', width: '100%', aspectRatio: '1/1', borderRadius: '8px', marginBottom: '0.75rem' }} />
                      ) : (
                        <TrackArtwork
                          track={{
                            title: lyricist.name,
                            coverClass: sampleTrack?.coverClass ?? 'cover-autumn',
                            coverUrl: null,
                          }}
                        />
                      )}
                      <h3>{lyricist.name}</h3>
                      <p>
                        {lyricist.trackCount}{' '}
                        {lyricist.trackCount === 1 ? 'track' : 'tracks'}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>"""
                content = content[:artists_start] + new_tabbed_section + content[albums_end:]

    # Remove extra blank lines
    content = re.sub(r'\n\s*\n\s*\n', '\n\n', content)

    with open(file_path, 'w') as f:
        f.write(content)

    print("Successfully updated MusicPlayer.tsx with tabbed layout.")

if __name__ == '__main__':
    main()
