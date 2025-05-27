import {
  useContext,
  useEffect,
  useRef,
  useCallback,
  useState,
  KeyboardEvent,
  WheelEvent
} from 'react'
import { SocketContext } from '@/contexts/SocketContext.tsx'
import styles from './PlaylistsScreen.module.css'
import { MediaContext } from '@/contexts/MediaContext'
import { debounce } from '@/lib/utils'
import { Track, Playlist, Album } from '@/types/Playback.d'
import likedSongsImage from '@/assets/likedSongs.jpg'

interface PlaylistsScreenProps {
  shown: boolean
  setShown: (shown: boolean) => void
}

const formatDuration = (ms: number): string => {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
}

const PlaylistsScreen: React.FC<PlaylistsScreenProps> = ({
  shown,
  setShown
}) => {
  const { ready, socket } = useContext(SocketContext)
  const {
    playerData,
    actions,
    playlistsData,
    albumsData,
    playlistsLoading,
    playlistsOffset,
    playlistsTotal,
    setPlaylistsData = () => {},
    setPlaylistsOffset = () => {},
    setPlaylistsLoading = () => {},
    likedSongsData,
    likedSongsOffset,
    likedSongsTotal
  } = useContext(MediaContext)

  const [selectedPlaylist, setSelectedPlaylist] = useState<
    Playlist | Album | null
  >(null)
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([])
  const [playlistsLoaded, setPlaylistsLoaded] = useState<boolean>(false)

  const [selectedLikedSongs, setSelectedLikedSongs] =
    useState<boolean>(false)
  const [tracksLoading, setTracksLoading] = useState(false)

  const [libraryType, setLibraryType] = useState<'playlist' | 'album'>(
    'playlist'
  )
  const [tracksListType, setTracksListType] = useState<
    'playlists' | 'likedSongs' | 'albums'
  >('playlists')

  const [tracksPagination, setTracksPagination] = useState({
    offset: 0,
    limit: 50,
    total: 0,
    hasMore: false
  })

  const [clickTimer, setClickTimer] = useState<NodeJS.Timeout | null>(null)
  const [clickCount, setClickCount] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const playlistsListRef = useRef<HTMLDivElement>(null)
  const trackListRef = useRef<HTMLDivElement>(null)

  const [newlyLoadedIds, setNewlyLoadedIds] = useState<string[]>([])

  const prevPlaylistsLengthRef = useRef<number>(0)

  const loadMoreTracks = debounce(() => {
    if (
      (!tracksLoading && selectedPlaylist && tracksPagination.hasMore) ||
      (selectedLikedSongs && tracksPagination.hasMore)
    ) {
      const nextOffset = tracksPagination.offset + tracksPagination.limit
      setTracksLoading(true)
      if (tracksListType === 'likedSongs') {
        actions.likedSongs(nextOffset)
      }
      if (tracksListType === 'playlists' && selectedPlaylist) {
        actions.playlistTracks(selectedPlaylist.id, nextOffset)
      }
      if (tracksListType === 'albums' && selectedPlaylist) {
        actions.albumTracks(selectedPlaylist.id, nextOffset)
      }
    }
  }, 200)

  const handleTrackListScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
      if (scrollHeight - scrollTop - clientHeight < 50) {
        loadMoreTracks()
      }
    },
    [loadMoreTracks]
  )

  useEffect(() => {
    if (playlistsData && !playlistsLoading) {
      const currentLength = playlistsData.length
      const prevLength = prevPlaylistsLengthRef.current

      if (currentLength > prevLength) {
        const newIds = playlistsData
          .slice(prevLength)
          .map(playlist => playlist.id)

        setNewlyLoadedIds(newIds)
        prevPlaylistsLengthRef.current = currentLength
      } else if (currentLength === 0) {
        prevPlaylistsLengthRef.current = 0
      }
    }
  }, [playlistsData, playlistsLoading])

  useEffect(() => {
    if (newlyLoadedIds.length > 0) {
      const timer = setTimeout(() => {
        setNewlyLoadedIds([])
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [newlyLoadedIds])

  const loadMorePlaylists = useCallback(() => {
    if (!playlistsLoading && playlistsOffset < playlistsTotal) {
      setPlaylistsLoading(true)
      if (libraryType === 'playlist') {
        actions.playlists(playlistsOffset)
      }
      if (libraryType === 'album') {
        actions.albums(playlistsOffset)
      }
    }
  }, [
    playlistsLoading,
    playlistsOffset,
    playlistsTotal,
    actions,
    libraryType,
    setPlaylistsLoading
  ])

  const switchLibraryType = useCallback(
    (type: 'playlist' | 'album') => {
      setLibraryType(type)
      setPlaylistTracks([])
      if (type === 'playlist') {
        actions.playlists(0)
      }
      if (type === 'album') {
        actions.albums(0)
      }
    },
    [setLibraryType, actions]
  )

  useEffect(() => {
    if (ready && socket && shown && !playlistsLoaded) {
      setPlaylistsOffset(0)
      setSelectedPlaylist(null)
      setSelectedLikedSongs(true)
      setPlaylistsLoading(true)
      setTracksListType('likedSongs')
      actions.likedSongs(0)
      setPlaylistsLoaded(true)
      switchLibraryType('playlist')
    }
  }, [
    ready,
    socket,
    shown,
    playlistsLoaded,
    playlistsData,
    playlistsLoading,
    actions,
    setPlaylistsOffset,
    setPlaylistsLoading,
    switchLibraryType
  ])

  const resetPlaylists = useCallback(() => {
    setPlaylistsData(null)
    setPlaylistsOffset(0)
    setPlaylistsLoading(false)
    setPlaylistsLoaded(false)
    setTracksPagination({
      offset: 0,
      limit: 50,
      total: 0,
      hasMore: false
    })
  }, [setPlaylistsData, setPlaylistsOffset, setPlaylistsLoading])

  useEffect(() => {
    if (shown) {
      containerRef.current?.focus()
    } else {
      containerRef.current?.blur()
      if (containerRef.current) {
        containerRef.current.scrollTop = 0
      }
      resetPlaylists()
    }
  }, [shown, resetPlaylists])

  const loadTrackList = useCallback(
    (
      tracksListType: 'playlists' | 'albums',
      trackList: Playlist | Album
    ) => {
      setSelectedLikedSongs(false)
      setSelectedPlaylist(trackList)
      setTracksLoading(true)

      setTracksPagination({
        offset: 0,
        limit: 50,
        total: 0,
        hasMore: false
      })
      if (tracksListType === 'playlists') {
        actions.playlistTracks(trackList.id, 0)
      }
      if (tracksListType === 'albums') {
        actions.albumTracks(trackList.id, 0)
      }
    },
    [setSelectedLikedSongs, setSelectedPlaylist, actions]
  )

  const handlePlaylistClick = useCallback(
    (playlist: Playlist) => {
      setTracksListType('playlists')
      loadTrackList('playlists', playlist)
      setClickCount(prevCount => prevCount + 1)

      if (clickTimer) {
        clearTimeout(clickTimer)
        setClickTimer(null)
      }

      const timer = setTimeout(() => {
        setClickCount(0)
        setClickTimer(null)
      }, 300)

      setClickTimer(timer as unknown as NodeJS.Timeout)

      if (clickCount === 1) {
        actions.playPlaylist(playlist.id)
        setClickCount(0)
        if (clickTimer) {
          clearTimeout(clickTimer)
          setClickTimer(null)
        }
      }
    },
    [clickCount, clickTimer, setTracksListType, loadTrackList, actions]
  )

  const handleAlbumClick = useCallback(
    (album: Album) => {
      setTracksListType('albums')
      loadTrackList('albums', album)
      setClickCount(prevCount => prevCount + 1)

      if (clickTimer) {
        clearTimeout(clickTimer)
        setClickTimer(null)
      }

      const timer = setTimeout(() => {
        setClickCount(0)
        setClickTimer(null)
      }, 300)

      setClickTimer(timer as unknown as NodeJS.Timeout)

      if (clickCount === 1) {
        actions.playAlbum(album.id)
        setClickCount(0)
        if (clickTimer) {
          clearTimeout(clickTimer)
          setClickTimer(null)
        }
      }
    },
    [clickCount, clickTimer, setTracksListType, loadTrackList, actions]
  )

  const handleLikedSongClick = useCallback(() => {
    setTracksListType('likedSongs')
    setTracksLoading(true)
    setSelectedPlaylist(null)
    setSelectedLikedSongs(true)
    setPlaylistTracks(likedSongsData || [])
    setTracksPagination({
      offset: likedSongsOffset,
      limit: 50,
      total: likedSongsTotal,
      hasMore: likedSongsTotal > likedSongsOffset + 50
    })
    setTracksLoading(false)
  }, [likedSongsData, likedSongsOffset, likedSongsTotal])

  const handleTrackClick = useCallback(
    (
      track: Track,
      libraryType: 'playlist' | 'album',
      playlist?: Playlist | Album | null
    ) => {
      setPlaylistTracks(prevTracks => {
        return prevTracks.map(t => ({
          ...t,
          isPlaying: t.id === track.id
        }))
      })

      if (socket) {
        if (playlist) {
          actions.playTrack(track.id, libraryType, playlist?.id)
        } else {
          actions.playTrack(track.id)
        }
      }
    },
    [socket, actions]
  )

  useEffect(() => {
    if (!socket || !ready) return

    const handleSocketMessage = (e: MessageEvent) => {
      try {
        const { type, action, data } = JSON.parse(e.data)
        if (type === 'playback' && action === 'likedSongs') {
          if (libraryType === 'playlist') {
            setTracksPagination({
              offset: data.offset || 0,
              limit: data.limit || 50,
              total: data.total || 0,
              hasMore: data.total > data.offset + data.limit
            })

            const tracks = data.items || []

            const currentTrackID =
              data.currentlyPlayingID || playerData?.track?.id || null
            if (currentTrackID) {
              tracks.forEach((track: Track) => {
                track.isPlaying = track.id === currentTrackID
              })
            }

            if (data.offset === 0) {
              setPlaylistTracks(tracks)
            } else {
              setPlaylistTracks(prevTracks => [...prevTracks, ...tracks])
            }
            setTracksLoading(false)
          }
        }

        if (
          type === 'playback' &&
          (action === 'playlistTracks' || action === 'albumTracks')
        ) {
          setTracksPagination({
            offset: data.offset || 0,
            limit: data.limit || 50,
            total: data.total || 0,
            hasMore: data.total > data.offset + data.limit
          })

          const tracks = data.items || []

          const currentTrackID =
            data.currentlyPlayingID || playerData?.track?.id || null
          if (currentTrackID) {
            tracks.forEach((track: Track) => {
              track.isPlaying = track.id === currentTrackID
            })
          }

          if (data.offset === 0) {
            setPlaylistTracks(tracks)
          } else {
            setPlaylistTracks(prevTracks => [...prevTracks, ...tracks])
          }
          setTracksLoading(false)
          setPlaylistsLoaded(true)
        }

        if (type === 'playback' && action === 'trackPlayed') {
          if (
            selectedPlaylist &&
            data.playlistId === selectedPlaylist.id
          ) {
            setPlaylistTracks(prev =>
              prev.map(track => ({
                ...track,
                isPlaying: track.id === data.trackID
              }))
            )
          }
        }

        if (type === 'playback' && !action && data?.track?.id) {
          setPlaylistTracks(prev =>
            prev.map(track => ({
              ...track,
              isPlaying: track.id === data.track.id
            }))
          )
        }
      } catch (err) {
        console.error('Error parsing message:', err)
      }
    }

    socket.addEventListener('message', handleSocketMessage)

    return () => {
      socket.removeEventListener('message', handleSocketMessage)
    }
  }, [socket, ready, libraryType, selectedPlaylist, playerData])

  const close = useCallback(() => {
    setShown(false)
    setNewlyLoadedIds([])
  }, [setShown, setNewlyLoadedIds])

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    e.stopPropagation()
    e.preventDefault()

    if (e.key === 'Enter') {
      actions.playPause()
    } else if (e.key === 'ArrowLeft') {
      onWheel({ deltaX: -1 } as WheelEvent<HTMLDivElement>)
    } else if (e.key === 'ArrowRight') {
      onWheel({ deltaX: 1 } as WheelEvent<HTMLDivElement>)
    } else if (e.key === 'Escape') {
      close()
    }
  }
  function onWheel(e: WheelEvent<HTMLDivElement>) {
    if (e.deltaX < 0) {
      trackListRef.current?.scrollBy({ top: -200, behavior: 'smooth' })
    } else if (e.deltaX > 0) {
      trackListRef.current?.scrollBy({ top: 200, behavior: 'smooth' })
    }
  }

  const showTrackList =
    (playlistsData || albumsData) &&
    playlistTracks.length > 0 &&
    playlistsLoaded

  return (
    <div
      className={styles.playlistsContainer}
      data-shown={shown}
      ref={containerRef}
      tabIndex={0}
      autoFocus={true}
      onKeyDown={onKeyDown}
      onWheel={onWheel}
    >
      <button onClick={() => close()} className={styles.close}>
        <span className="material-icons">keyboard_arrow_down</span>
      </button>

      <div className={styles.splitView}>
        <div
          className={`${styles.playlistsPanel} ${selectedPlaylist ? styles.withSidebar : ''}`}
        >
          <div className={styles.playlists}>
            <div className={styles.tabNav}>
              <button
                className={`${styles.tabButton} ${libraryType === 'playlist' ? styles.active : ''}`}
                onClick={() => switchLibraryType('playlist')}
              >
                {' '}
                Playlists
              </button>
              <button
                className={`${styles.tabButton} ${libraryType === 'album' ? styles.active : ''}`}
                onClick={() => switchLibraryType('album')}
              >
                {' '}
                Albums
              </button>
            </div>
            <div className={styles.playlistsList} ref={playlistsListRef}>
              {libraryType === 'playlist' && (
                <div
                  className={`${styles.playlistItem} && ${selectedLikedSongs ? styles.active : ''}`}
                  onClick={() => handleLikedSongClick()}
                >
                  <div className={styles.playlistImage}>
                    {likedSongsImage && (
                      <img src={likedSongsImage} alt="Liked Songs" />
                    )}
                  </div>
                  <div className={styles.playlistInfo}>
                    <div className={styles.playlistTitle}>Liked Songs</div>
                  </div>
                </div>
              )}
              {(libraryType === 'playlist' &&
                playlistsData === null &&
                playlistsLoading) ||
                (libraryType === 'album' &&
                  albumsData === null &&
                  playlistsLoading && (
                    <p className={styles.loading}>
                      Loading {libraryType}...
                    </p>
                  ))}
              {libraryType === 'playlist' && playlistsData && (
                <>
                  {playlistsData.length === 0 ? (
                    <p className={styles.noPlaylists}>
                      No playlists found
                    </p>
                  ) : (
                    playlistsData.map(playlist => (
                      <div
                        key={playlist.id}
                        className={`${styles.playlistItem} 
                          ${newlyLoadedIds.includes(playlist.id) ? styles.newlyLoaded : ''} 
                          ${selectedPlaylist?.id === playlist.id ? styles.active : ''}`}
                        onClick={() => handlePlaylistClick(playlist)}
                      >
                        <div className={styles.playlistImage}>
                          {playlist.image && (
                            <img
                              src={playlist.image}
                              alt={playlist.name}
                            />
                          )}
                        </div>
                        <div className={styles.playlistInfo}>
                          <div className={styles.playlistTitle}>
                            {playlist.name}
                          </div>
                          <div className={styles.playlistOwner}>
                            {playlist.owner?.display_name || ''}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  {playlistsData &&
                    playlistsLoading &&
                    playlistsOffset < playlistsTotal && (
                      <div className={styles.loadingMore}>
                        <p>Loading more playlists...</p>
                      </div>
                    )}
                  {playlistsData &&
                    !playlistsLoading &&
                    playlistsOffset < playlistsTotal && (
                      <div className={styles.loadMoreContainer}>
                        <button
                          className={styles.loadMoreButton}
                          onClick={loadMorePlaylists}
                        >
                          Load More
                        </button>
                      </div>
                    )}
                  {playlistsData &&
                    playlistsOffset >= playlistsTotal &&
                    playlistsTotal > 0 && (
                      <div className={styles.endOfList}>
                        <p>No more playlists</p>
                      </div>
                    )}
                </>
              )}
              {libraryType === 'album' && albumsData && (
                <>
                  {albumsData.length === 0 ? (
                    <p className={styles.noPlaylists}>
                      No playlists found
                    </p>
                  ) : (
                    albumsData.map(album => (
                      <div
                        key={album.id}
                        className={`${styles.playlistItem} 
                          ${newlyLoadedIds.includes(album.id) ? styles.newlyLoaded : ''} 
                          ${selectedPlaylist?.id === album.id ? styles.active : ''}`}
                        onClick={() => handleAlbumClick(album)}
                      >
                        <div className={styles.playlistImage}>
                          {album.image && (
                            <img src={album.image} alt={album.name} />
                          )}
                        </div>
                        <div className={styles.playlistInfo}>
                          <div className={styles.playlistTitle}>
                            {album.name}
                          </div>
                          <div className={styles.playlistOwner}>
                            {album.artists
                              ?.map(artist => artist)
                              .join(', ') || ''}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  {playlistsData &&
                    playlistsLoading &&
                    playlistsOffset < playlistsTotal && (
                      <div className={styles.loadingMore}>
                        <p>Loading more playlists...</p>
                      </div>
                    )}
                  {playlistsData &&
                    !playlistsLoading &&
                    playlistsOffset < playlistsTotal && (
                      <div className={styles.loadMoreContainer}>
                        <button
                          className={styles.loadMoreButton}
                          onClick={loadMorePlaylists}
                        >
                          Load More
                        </button>
                      </div>
                    )}
                  {playlistsData &&
                    playlistsOffset >= playlistsTotal &&
                    playlistsTotal > 0 && (
                      <div className={styles.endOfList}>
                        <p>No more playlists</p>
                      </div>
                    )}
                </>
              )}
            </div>
          </div>
        </div>

        <div
          className={`${styles.tracksSidebar} ${showTrackList ? styles.visible : ''}`}
        >
          <>
            <div className={styles.sidebarHeader}>
              {selectedPlaylist && (
                <>
                  <div className={styles.sidebarTitle}>
                    <h2>{selectedPlaylist.name}</h2>
                  </div>
                  <p className={styles.sidebarSubtitle}>
                    {tracksPagination.total ||
                      selectedPlaylist.tracks?.total}{' '}
                    tracks • {selectedPlaylist.owner?.display_name || ''}
                    {selectedPlaylist.artists
                      ?.map(artist => artist)
                      .join(', ') || ''}
                  </p>
                </>
              )}
              {selectedLikedSongs && (
                <>
                  <div className={styles.sidebarTitle}>
                    <h2>Liked Songs</h2>
                  </div>
                  <p className={styles.sidebarSubtitle}>
                    {likedSongsTotal} tracks
                  </p>
                </>
              )}
            </div>

            <div
              className={styles.trackList}
              ref={trackListRef}
              onScroll={handleTrackListScroll}
            >
              {playlistTracks.length === 0 && tracksLoading ? (
                <div className={styles.sidebarLoading}>
                  <p>Loading tracks...</p>
                </div>
              ) : playlistTracks.length === 0 ? (
                <p>No tracks found in this playlist</p>
              ) : (
                <>
                  {playlistTracks.map((track, index) => (
                    <div
                      key={`${track.id}-${index}`}
                      className={`${styles.trackItem} ${track.isPlaying ? styles.playing : ''}`}
                      onClick={() =>
                        handleTrackClick(
                          track,
                          libraryType,
                          selectedPlaylist ?? null
                        )
                      }
                    >
                      <div className={styles.trackNumber}>
                        {track.isPlaying ? (
                          <span className="material-icons">equalizer</span>
                        ) : (
                          index + 1
                        )}
                      </div>
                      {track.image && (
                        <div className={styles.trackImage}>
                          <img src={track.image} alt={track.name} />
                        </div>
                      )}
                      <div className={styles.trackInfo}>
                        <h4 className={styles.trackName}>{track.name}</h4>
                        <p className={styles.trackArtist}>
                          {track.artists.join(', ')}
                        </p>
                      </div>
                      <div className={styles.trackDuration}>
                        {formatDuration(track.duration_ms)}
                      </div>
                    </div>
                  ))}
                  {tracksLoading && (
                    <div className={styles.tracksLoadingMore}>
                      <p>Loading more tracks...</p>
                    </div>
                  )}
                  {!tracksLoading &&
                    !tracksPagination.hasMore &&
                    playlistTracks.length > 0 && (
                      <div className={styles.tracksEndOfList}>
                        <p>End of playlist</p>
                      </div>
                    )}
                </>
              )}
            </div>
          </>
        </div>
      </div>
    </div>
  )
}

export default PlaylistsScreen
