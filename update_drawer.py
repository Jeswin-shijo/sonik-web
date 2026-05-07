import re

def main():
    file_path = '/Users/jeswin/Desktop/projects/sonik/sonik-web/src/screens/MusicPlayer.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # 1. Remove the Singers and Lyricists from the main content area
    
    singers_block_start = content.find('{singers?.length ? (')
    if singers_block_start != -1:
        # Find the end of singers block
        singers_block_end = content.find(') : null}', singers_block_start) + len(') : null}')
        singers_block = content[singers_block_start:singers_block_end]
        content = content[:singers_block_start] + content[singers_block_end:]
        
    lyricists_block_start = content.find('{lyricists?.length ? (')
    if lyricists_block_start != -1:
        # Find the end of lyricists block
        lyricists_block_end = content.find(') : null}', lyricists_block_start) + len(') : null}')
        lyricists_block = content[lyricists_block_start:lyricists_block_end]
        content = content[:lyricists_block_start] + content[lyricists_block_end:]

    # Clean up empty lines where blocks used to be
    content = re.sub(r'\n\s*\n\s*\n', '\n\n', content)

    # 2. Add Singers and Lyricists to the left sidebar (control-rail)
    
    sidebar_insert_point = content.find('        <div className="playlist-create">')
    
    sidebar_addition = """        {singers?.length ? (
          <section className="crate-panel">
            <p className="section-kicker">Singers</p>
            {singers.map((singer) => (
              <button
                className={`playlist-link ${
                  selectedPlaylistId === `singer:${singer.id}` ? 'is-active' : ''
                }`}
                key={singer.id}
                onClick={() => onSelectSinger?.(singer.id)}
                type="button"
              >
                {singer.name}
                <span>{singer.trackCount}</span>
              </button>
            ))}
          </section>
        ) : null}

        {lyricists?.length ? (
          <section className="crate-panel">
            <p className="section-kicker">Lyricists</p>
            {lyricists.map((lyricist) => (
              <button
                className={`playlist-link ${
                  selectedPlaylistId === `lyricist:${lyricist.id}` ? 'is-active' : ''
                }`}
                key={lyricist.id}
                onClick={() => onSelectLyricist?.(lyricist.id)}
                type="button"
              >
                {lyricist.name}
                <span>{lyricist.trackCount}</span>
              </button>
            ))}
          </section>
        ) : null}

"""
    
    if sidebar_insert_point != -1 and "section-kicker\">Singers<" not in content:
        content = content[:sidebar_insert_point] + sidebar_addition + content[sidebar_insert_point:]

    with open(file_path, 'w') as f:
        f.write(content)
        
    print("Successfully moved Singers and Lyricists to the left drawer.")

if __name__ == '__main__':
    main()
