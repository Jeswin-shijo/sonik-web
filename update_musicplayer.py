import re

def main():
    file_path = '/Users/jeswin/Desktop/projects/sonik/sonik-web/src/screens/MusicPlayer.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # 1. Update destructuring props
    old_props = """  playlists,
  artists,
  albums,"""
    new_props = """  playlists,
  artists,
  singers = [],
  lyricists = [],
  albums,"""
    content = content.replace(old_props, new_props)

    old_handlers = """  onSelectPlaylist,
  onSelectArtist,
  onSelectAlbum,"""
    new_handlers = """  onSelectPlaylist,
  onSelectArtist,
  onSelectSinger,
  onSelectLyricist,
  onSelectAlbum,"""
    content = content.replace(old_handlers, new_handlers)

    # 2. Update type definitions
    old_types = """  playlists: PlaylistSummary[];
  artists: ArtistSummary[];
  albums: AlbumSummary[];"""
    new_types = """  playlists: PlaylistSummary[];
  artists: ArtistSummary[];
  singers?: import('../types').SingerSummary[];
  lyricists?: import('../types').LyricistSummary[];
  albums: AlbumSummary[];"""
    content = content.replace(old_types, new_types)
    
    old_type_handlers = """  onSelectArtist: (id: string) => void;
  onSelectAlbum: (id: string) => void;"""
    new_type_handlers = """  onSelectArtist: (id: string) => void;
  onSelectSinger?: (id: string) => void;
  onSelectLyricist?: (id: string) => void;
  onSelectAlbum: (id: string) => void;"""
    content = content.replace(old_type_handlers, new_type_handlers)

    # 3. Add UI sections for Singers and Lyricists below Artists
    # First find the Artists section
    artists_section_end = """              })}
            </div>
          </section>
        ) : null}"""
        
    singers_lyricists_section = """
        {singers.length ? (
          <section className="content-section" aria-labelledby="singers-heading">
            <div className="section-heading">
              <h2 id="singers-heading">Singers</h2>
              <span className="section-count">
                {singers.length} {singers.length === 1 ? 'singer' : 'singers'}
              </span>
            </div>
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
                      <img src={`http://localhost:4001/uploads/people/${singer.imageName}`} alt={singer.name} className="admin-track-cover" style={{ objectFit: 'cover', width: '100%', aspectRatio: '1/1', borderRadius: '8px', marginBottom: '0.75rem' }} />
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
          </section>
        ) : null}

        {lyricists.length ? (
          <section className="content-section" aria-labelledby="lyricists-heading">
            <div className="section-heading">
              <h2 id="lyricists-heading">Lyricists</h2>
              <span className="section-count">
                {lyricists.length} {lyricists.length === 1 ? 'lyricist' : 'lyricists'}
              </span>
            </div>
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
                      <img src={`http://localhost:4001/uploads/people/${lyricist.imageName}`} alt={lyricist.name} className="admin-track-cover" style={{ objectFit: 'cover', width: '100%', aspectRatio: '1/1', borderRadius: '8px', marginBottom: '0.75rem' }} />
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
          </section>
        ) : null}"""

    # We need to replace the exact artists_section_end to append the new sections.
    # To be safe, let's use regex or just replace the first occurrence of artists_section_end
    
    # Let's find exactly the artists block.
    # Because `artists_section_end` is also used by albums, let's look for `id="artists-heading"`
    
    if "singers-heading" not in content:
        parts = content.split('aria-labelledby="artists-heading"')
        if len(parts) == 2:
            subparts = parts[1].split('</section>\n        ) : null}')
            if len(subparts) >= 2:
                # the first `</section>\n        ) : null}` after `artists-heading`
                modified = parts[0] + 'aria-labelledby="artists-heading"' + subparts[0] + '</section>\n        ) : null}' + singers_lyricists_section + '</section>\n        ) : null}'.join(subparts[1:])
                content = modified

    with open(file_path, 'w') as f:
        f.write(content)
        
    print("Successfully updated MusicPlayer.tsx")

if __name__ == '__main__':
    main()
