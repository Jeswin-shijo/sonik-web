import re
import sys

def main():
    file_path = '/Users/jeswin/Desktop/projects/sonik/sonik-web/src/App.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # 1. Add state variables for singers and lyricists
    if "const [singers, setSingers]" not in content:
        content = content.replace(
            "const [albums, setAlbums] = useState<AlbumSummary[]>(",
            "const [singers, setSingers] = useState<SingerSummary[]>([]);\n  const [lyricists, setLyricists] = useState<LyricistSummary[]>([]);\n  const [albums, setAlbums] = useState<AlbumSummary[]>("
        )

    # 2. Update loadLibraryTracks to fetch singers and lyricists
    old_fetch = """const [tracksPayload, artistsPayload, albumsPayload] = await Promise.all([
        requestJson<TracksResponse>("/tracks"),
        requestJson<ArtistsResponse>("/tracks/artists").catch(() => null),
        requestJson<AlbumsResponse>("/tracks/albums").catch(() => null),
      ]);"""
      
    new_fetch = """const [tracksPayload, artistsPayload, albumsPayload, singersPayload, lyricistsPayload] = await Promise.all([
        requestJson<TracksResponse>("/tracks"),
        requestJson<ArtistsResponse>("/tracks/artists").catch(() => null),
        requestJson<AlbumsResponse>("/tracks/albums").catch(() => null),
        requestJson<any>("/people/singers").catch(() => null),
        requestJson<any>("/people/lyricists").catch(() => null),
      ]);"""
      
    content = content.replace(old_fetch, new_fetch)

    # 3. Process singers and lyricists in loadLibraryTracks
    old_set_albums = """setAlbums(
        albumsPayload?.albums.length
          ? albumsPayload.albums
          : buildAlbumsFromTracks(tracksPayload.tracks),
      );"""
      
    new_set_albums = """setAlbums(
        albumsPayload?.albums.length
          ? albumsPayload.albums
          : buildAlbumsFromTracks(tracksPayload.tracks),
      );

      if (singersPayload?.singers) {
        setSingers(
          singersPayload.singers.map((s: any) => {
            const sTracks = tracksPayload.tracks.filter((t: any) => t.singerId === String(s.id) || t.artist === s.name);
            return {
              id: String(s.id),
              name: s.name,
              imageName: s.imageName,
              trackCount: sTracks.length,
              tracks: sTracks
            };
          }).filter((s: any) => s.trackCount > 0)
        );
      }

      if (lyricistsPayload?.lyricists) {
        setLyricists(
          lyricistsPayload.lyricists.map((l: any) => {
            const lTracks = tracksPayload.tracks.filter((t: any) => t.lyricistId === String(l.id) || t.artist === l.name);
            return {
              id: String(l.id),
              name: l.name,
              imageName: l.imageName,
              trackCount: lTracks.length,
              tracks: lTracks
            };
          }).filter((l: any) => l.trackCount > 0)
        );
      }"""
      
    content = content.replace(old_set_albums, new_set_albums)

    # 4. Update filtering logic for singer and lyricist
    old_filter = """if (selectedPlaylistId.startsWith("artist:")) {
      const artist = artists.find(
        (candidate) => `artist:${candidate.id}` === selectedPlaylistId,
      );
      return artist ? artist.tracks : [];
    }"""
    
    new_filter = """if (selectedPlaylistId.startsWith("artist:")) {
      const artist = artists.find(
        (candidate) => `artist:${candidate.id}` === selectedPlaylistId,
      );
      return artist ? artist.tracks : [];
    }

    if (selectedPlaylistId.startsWith("singer:")) {
      const singer = singers.find(
        (candidate) => `singer:${candidate.id}` === selectedPlaylistId,
      );
      return singer ? singer.tracks : [];
    }

    if (selectedPlaylistId.startsWith("lyricist:")) {
      const lyricist = lyricists.find(
        (candidate) => `lyricist:${candidate.id}` === selectedPlaylistId,
      );
      return lyricist ? lyricist.tracks : [];
    }"""
    
    content = content.replace(old_filter, new_filter)
    
    # Another filter logic around line 324
    old_filter_2 = """if (selectedPlaylistId.startsWith("artist:")) {
      const artist = artists.find(
        (candidate) => `artist:${candidate.id}` === selectedPlaylistId,
      );
      if (artist) {
        return artist.tracks.length
          ? artist.tracks[
              Math.floor(Math.random() * artist.tracks.length)
            ]
          : null;
      }
    }"""
    
    new_filter_2 = """if (selectedPlaylistId.startsWith("artist:")) {
      const artist = artists.find(
        (candidate) => `artist:${candidate.id}` === selectedPlaylistId,
      );
      if (artist) {
        return artist.tracks.length
          ? artist.tracks[
              Math.floor(Math.random() * artist.tracks.length)
            ]
          : null;
      }
    }

    if (selectedPlaylistId.startsWith("singer:")) {
      const singer = singers.find(
        (candidate) => `singer:${candidate.id}` === selectedPlaylistId,
      );
      if (singer) {
        return singer.tracks.length
          ? singer.tracks[
              Math.floor(Math.random() * singer.tracks.length)
            ]
          : null;
      }
    }

    if (selectedPlaylistId.startsWith("lyricist:")) {
      const lyricist = lyricists.find(
        (candidate) => `lyricist:${candidate.id}` === selectedPlaylistId,
      );
      if (lyricist) {
        return lyricist.tracks.length
          ? lyricist.tracks[
              Math.floor(Math.random() * lyricist.tracks.length)
            ]
          : null;
      }
    }"""
    
    content = content.replace(old_filter_2, new_filter_2)

    # 5. Add selectSinger and selectLyricist handlers
    old_handlers = """function selectArtist(artistId: string) {
    setSelectedPlaylistId(`artist:${artistId}`);
    setSearchQuery("");
  }"""
  
    new_handlers = """function selectArtist(artistId: string) {
    setSelectedPlaylistId(`artist:${artistId}`);
    setSearchQuery("");
  }

  function selectSinger(singerId: string) {
    setSelectedPlaylistId(`singer:${singerId}`);
    setSearchQuery("");
  }

  function selectLyricist(lyricistId: string) {
    setSelectedPlaylistId(`lyricist:${lyricistId}`);
    setSearchQuery("");
  }"""
  
    content = content.replace(old_handlers, new_handlers)
    
    # 6. Pass to MusicPlayer
    old_musicplayer_props = """          artists={artists}
          albums={albums}"""
          
    new_musicplayer_props = """          artists={artists}
          albums={albums}
          singers={singers}
          lyricists={lyricists}
          onSelectSinger={selectSinger}
          onSelectLyricist={selectLyricist}"""
          
    content = content.replace(old_musicplayer_props, new_musicplayer_props)

    with open(file_path, 'w') as f:
        f.write(content)
        
    print("Successfully updated App.tsx")

if __name__ == '__main__':
    main()
