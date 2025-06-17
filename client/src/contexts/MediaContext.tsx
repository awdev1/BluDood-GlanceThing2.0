import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback
} from 'react'

import { SocketContext } from './SocketContext.tsx'

import {
  PlaybackData,
  RepeatMode,
  Track,
  Album,
  SpotifyPlaylistsItems,
  SpotifyLyricsData
} from '@/types/Playback.js'
import { AppStateContext } from './AppStateContext.tsx'

interface MediaContextProps {
  image: string | null
  playerData: PlaybackData | null
  playerDataRef: React.MutableRefObject<PlaybackData | null>
  lyricsData: SpotifyLyricsData | null
  lyricsLoading?: boolean
  lyricsCurrentLineIndex: number
  playlistsData: SpotifyPlaylistsItems[] | null
  albumsData: Album[] | null
  playlistsOffset: number
  playlistsTotal: number
  playlistsLoading: boolean
  setPlaylistsData?: React.Dispatch<
    React.SetStateAction<SpotifyPlaylistsItems[] | null>
  >
  setAlbumsData?: React.Dispatch<React.SetStateAction<Album[] | null>>
  setPlaylistsOffset?: React.Dispatch<React.SetStateAction<number>>
  setPlaylistsLoading?: React.Dispatch<React.SetStateAction<boolean>>

  likedSongsData: Track[] | null
  likedSongsImage: string
  likedSongsOffset: number
  likedSongsTotal: number
  likedSongsLoading: boolean
  setLikedSongsData?: React.Dispatch<React.SetStateAction<Track[] | null>>
  setLikedSongsOffset?: React.Dispatch<React.SetStateAction<number>>
  setLikedSongsLoading?: React.Dispatch<React.SetStateAction<boolean>>

  actions: {
    playPause: () => void
    skipForward: () => void
    skipBackward: () => void
    setVolume: (volume: number, deviceId?: string) => void
    shuffle: (state: boolean) => void
    repeat: (state: RepeatMode) => void
    playlists: (offset: number) => void
    playPlaylist: (playlistId: string) => void
    albums: (offset: number) => void
    playAlbum: (albumId: string) => void
    likedSongs: (offset: number) => void
    playlistTracks: (playlistId: string, offset: number) => void
    albumTracks: (albumId: string, offset: number) => void
    playTrack: (
      trackID: string,
      contextType?: string,
      contextId?: string,
      shuffle?: boolean
    ) => void
    devices: () => void
    transferPlayback: (deviceId: string) => void
  }
}

const MediaContext = createContext<MediaContextProps>({
  image: null,
  playerData: null,
  playerDataRef: { current: null },
  lyricsData: null,
  lyricsCurrentLineIndex: -1,
  playlistsData: null,
  albumsData: null,
  playlistsOffset: 0,
  playlistsTotal: 0,
  playlistsLoading: false,
  setPlaylistsData: () => {},
  setPlaylistsOffset: () => {},
  setPlaylistsLoading: () => {},
  likedSongsData: null,
  likedSongsImage: '',
  likedSongsOffset: 0,
  likedSongsTotal: 0,
  likedSongsLoading: false,
  setLikedSongsData: () => {},
  setLikedSongsOffset: () => {},
  setLikedSongsLoading: () => {},
  actions: {
    playPause: () => {},
    skipForward: () => {},
    skipBackward: () => {},
    setVolume: () => {},
    shuffle: () => {},
    repeat: () => {},
    playlists: () => {},
    playPlaylist: () => {},
    albums: () => {},
    playAlbum: () => {},
    likedSongs: () => {},
    playlistTracks: () => {},
    albumTracks: () => {},
    playTrack: () => {},
    devices: () => {},
    transferPlayback: () => {}
  }
})

interface MediaContextProviderProps {
  children: React.ReactNode
}

const MediaContextProvider = ({ children }: MediaContextProviderProps) => {
  const { ready, socket } = useContext(SocketContext)
  const { showLyricsWidget } = useContext(AppStateContext)
  const socketRef = useRef<WebSocket | null>(null)

  const [playerData, setPlayerData] = useState<PlaybackData | null>(null)
  const playerDataRef = useRef<PlaybackData | null>(null)
  const [image, setImage] = useState<string | null>(null)
  const [lyricsData, setLyricsData] = useState<SpotifyLyricsData | null>(
    null
  )
  const [lyricsLoading, setLyricsLoading] = useState<boolean>(false)
  const [lyricsCurrentLineIndex, setlyricsCurrentLineIndex] =
    useState<number>(-1)

  const [playlistsData, setPlaylistsData] = useState<
    SpotifyPlaylistsItems[] | null
  >(null)
  const [albumsData, setAlbumsData] = useState<Album[] | null>(null)
  const [playlistsOffset, setPlaylistsOffset] = useState(0)
  const [playlistsTotal, setPlaylistsTotal] = useState(0)
  const [playlistsLoading, setPlaylistsLoading] = useState(false)

  const [likedSongsData, setLikedSongsData] = useState<Track[] | null>(
    null
  )
  const [likedSongsOffset, setLikedSongsOffset] = useState(0)
  const [likedSongsTotal, setLikedSongsTotal] = useState(0)
  const [likedSongsLoading, setLikedSongsLoading] = useState(false)
  const [likedSongsImage, setLikedSongsImage] = useState<string>('')

  useEffect(() => {
    if (
      !playerData?.isPlaying ||
      !lyricsData?.lyrics?.lines ||
      lyricsData.lyrics.lines.length === 0
    )
      return

    const currentTime = playerData.track?.duration.current

    let foundIndex = -1
    const lines = lyricsData.lyrics.lines

    if (currentTime < parseInt(lines[0].startTimeMs)) {
      if (lyricsCurrentLineIndex !== -1) {
        setlyricsCurrentLineIndex(-1)
      }
      return
    }

    if (currentTime > parseInt(lines[lines.length - 1].startTimeMs)) {
      if (lyricsCurrentLineIndex !== lines.length - 1) {
        setlyricsCurrentLineIndex(lines.length - 1)
      }
      return
    }

    for (let i = 0; i < lines.length; i++) {
      const startMs = parseInt(lines[i].startTimeMs)
      const endMs = parseInt(lines[i].endTimeMs) || startMs

      if (currentTime >= startMs && currentTime <= endMs) {
        foundIndex = i
        break
      }

      if (currentTime < startMs && i > 0) {
        foundIndex = i - 1
        break
      }
    }

    if (foundIndex !== lyricsCurrentLineIndex) {
      setlyricsCurrentLineIndex(foundIndex)
    }
  }, [playerData, lyricsData, lyricsCurrentLineIndex])

  const hasTrackChanged = useCallback((newData: PlaybackData) => {
    const currentTrack = playerDataRef.current?.track
    const newTrack = newData.track
    if (!currentTrack) return true
    if (currentTrack.id !== newTrack.id) return true
    for (let i = 0; i < currentTrack.artists.length; i++) {
      if (currentTrack.artists[i] !== newTrack.artists[i]) return true
    }

    return false
  }, [])

  const handleSocketMessage = useCallback(
    (e: MessageEvent) => {
      try {
        const { type, action, data } = JSON.parse(e.data)
        if (type !== 'playback') return
        if (
          action === 'trackPlayed' ||
          action === 'playlistTracks' ||
          action === 'albumTracks'
        ) {
          return
        }

        if (action === 'image') {
          if (!data) return setImage(null)
          setImage(`data:image/png;base64,${data}`)
          return
        }

        if (action === 'lyrics') {
          setLyricsLoading(false)
          setLyricsData(data)
          return
        }

        if (action === 'playlists') {
          const isNewRequest = data.offset === 0

          if (!data.items || !Array.isArray(data.items)) {
            console.error('Invalid playlists data received:', data)
            setPlaylistsLoading(false)
            return
          }

          setPlaylistsData(prevData => {
            if (isNewRequest || prevData === null) {
              return data.items
            }
            const existingIds = new Set(prevData.map(item => item.id))
            const uniqueNewItems = data.items.filter(
              (item: { id: string }) => !existingIds.has(item.id)
            )
            return [...prevData, ...uniqueNewItems]
          })

          setPlaylistsOffset(data.offset + data.items.length)
          setPlaylistsTotal(data.total)
          setPlaylistsLoading(false)
          return
        }

        if (action === 'albums') {
          const isNewRequest = data.offset === 0
          if (!data.items || !Array.isArray(data.items)) {
            console.error('Invalid albums data received:', data)
            setPlaylistsLoading(false)
            return
          }

          setAlbumsData(prevData => {
            if (isNewRequest || prevData === null) {
              return data.items
            }
            const existingIds = new Set(prevData.map(item => item.id))
            const uniqueNewItems = data.items.filter(
              (item: { id: string }) => !existingIds.has(item.id)
            )
            return [...prevData, ...uniqueNewItems]
          })
          setPlaylistsOffset(data.offset + data.items.length)
          setPlaylistsTotal(data.total)
          setPlaylistsLoading(false)
          return
        }

        if (action === 'likedSongs') {
          const isNewRequest = data.offset === 0

          if (!data.items || !Array.isArray(data.items)) {
            console.error('Invalid liked songs data received:', data)
            setLikedSongsLoading(false)
            return
          }

          setLikedSongsData(prevData => {
            if (isNewRequest || prevData === null) {
              return data.items
            }
            const existingIds = new Set(prevData.map(item => item.id))
            const uniqueNewItems = data.items.filter(
              (item: { id: string }) => !existingIds.has(item.id)
            )
            return [...prevData, ...uniqueNewItems]
          })
          setLikedSongsImage(data.image || '')
          setLikedSongsOffset(data.offset + data.items.length)
          setLikedSongsTotal(data.total)
          setLikedSongsLoading(false)
          return
        }

        if (!data) {
          setPlayerData(null)
          setLyricsData(null)
          return
        }

        if (data.track?.id || data.track?.name) {
          if (hasTrackChanged(data)) {
            socket?.send(
              JSON.stringify({ type: 'playback', action: 'image' })
            )
            if (showLyricsWidget) {
              setLyricsLoading(true)
              socket?.send(
                JSON.stringify({ type: 'playback', action: 'lyrics' })
              )
            }
          }

          setPlayerData(prevData => {
            if (!prevData) return data
            const hasChanged =
              hasTrackChanged(data) ||
              prevData.isPlaying !== data.isPlaying ||
              prevData.volume !== data.volume ||
              prevData.shuffle !== data.shuffle ||
              prevData.repeat !== data.repeat ||
              prevData.track.duration.current !==
                data.track.duration.current ||
              prevData.track.duration.total !== data.track.duration.total

            return hasChanged ? data : prevData
          })
        }
      } catch (err) {
        console.error('Error parsing message:', err)
      }
    },
    [hasTrackChanged, showLyricsWidget, socket]
  )

  useEffect(() => {
    if (socketRef.current && socketRef.current !== socket) {
      const prevSocket = socketRef.current
      prevSocket.removeEventListener('message', handleSocketMessage)
    }
    socketRef.current = socket
    if (ready === true && socket) {
      socket.addEventListener('message', handleSocketMessage)
      return () => {
        socket.removeEventListener('message', handleSocketMessage)
      }
    }
    return () => {
      socketRef.current = null
    }
  }, [ready, socket, handleSocketMessage])

  useEffect(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: 'playback'
        })
      )
    }
  }, [socket])

  const updateRef = useRef<{
    startTime: number
    initialProgress: number
  } | null>(null)

  useEffect(() => {
    if (!playerData || !playerData.isPlaying) {
      updateRef.current = null
      return
    }

    const updateInfo = {
      startTime: performance.now(),
      initialProgress: playerData.track.duration.current
    }
    updateRef.current = updateInfo

    let intervalId: number

    const updateProgress = () => {
      // Check if this update is still valid
      if (updateRef.current !== updateInfo) return

      const currentTime = performance.now()
      const elapsedMs = currentTime - updateInfo.startTime
      const newProgress = updateInfo.initialProgress + elapsedMs

      setPlayerData(p => {
        if (!p || newProgress >= p.track.duration.total) {
          return p
        }
        return {
          ...p,
          track: {
            ...p.track,
            duration: {
              ...p.track.duration,
              current: newProgress
            }
          }
        }
      })

      if (updateRef.current === updateInfo) {
        intervalId = window.setTimeout(updateProgress, 1000)
      }
    }

    intervalId = window.setTimeout(updateProgress, 1000)

    return () => {
      if (updateRef.current === updateInfo) {
        updateRef.current = null
      }
      window.clearTimeout(intervalId)
    }
  }, [playerData])

  useEffect(() => {
    playerDataRef.current = playerData
  }, [playerData])

  type CommandData = {
    [key: string]: string | number | boolean
  }

  const sendSocketCommand = useCallback(
    (type: string, action: string, data?: CommandData) => {
      const currentSocket = socket || socketRef.current
      if (!currentSocket || currentSocket.readyState !== WebSocket.OPEN)
        return false
      currentSocket.send(
        JSON.stringify({
          type,
          action,
          data
        })
      )

      return true
    },
    [socket]
  )

  const resetTrackCurrentTime = () => {
    setPlayerData(p => {
      return {
        ...p!,
        track: {
          ...p!.track,
          duration: {
            ...p!.track.duration,
            current: 0
          }
        }
      }
    })
  }

  const actions = {
    playPause: () => {
      if (playerDataRef.current === null) return

      if (
        sendSocketCommand(
          'playback',
          playerDataRef.current?.isPlaying ? 'pause' : 'play'
        )
      ) {
        setPlayerData({
          ...playerDataRef.current!,
          isPlaying: !playerDataRef.current?.isPlaying
        })
      }
    },
    skipForward: () => {
      if (playerDataRef.current === null) return
      resetTrackCurrentTime()
      sendSocketCommand('playback', 'next')
    },
    skipBackward: () => {
      if (playerDataRef.current === null) return
      resetTrackCurrentTime()
      sendSocketCommand('playback', 'previous')
    },
    setVolume: (volume: number, deviceId?: string) => {
      if (playerDataRef.current === null) return
      if (deviceId) {
        sendSocketCommand('playback', 'volume', {
          volume,
          deviceId
        })
      } else {
        sendSocketCommand('playback', 'volume', { volume })
        setPlayerData({
          ...playerDataRef.current!,
          volume: volume
        })
      }
    },
    shuffle: (state: boolean) => {
      if (playerDataRef.current === null) return

      if (sendSocketCommand('playback', 'shuffle', { state })) {
        setPlayerData({
          ...playerDataRef.current!,
          shuffle: state
        })
      }
    },
    repeat: (state: RepeatMode) => {
      if (playerDataRef.current === null) return

      if (sendSocketCommand('playback', 'repeat', { state })) {
        setPlayerData({
          ...playerDataRef.current!,
          repeat: state as RepeatMode
        })
      }
    },
    playlists: (offset: number) =>
      sendSocketCommand('playback', 'playlists', { offset }),
    playPlaylist: (playlistId: string) => {
      sendSocketCommand('playback', 'playPlaylist', { playlistId })
    },
    albums: (offset: number) => {
      setPlaylistsLoading(true)
      sendSocketCommand('playback', 'albums', { offset })
    },
    playAlbum: (albumId: string) => {
      sendSocketCommand('playback', 'playAlbum', { albumId })
    },
    likedSongs: (offset: number) => {
      setLikedSongsLoading(true)
      sendSocketCommand('playback', 'likedSongs', { offset })
    },
    playlistTracks: (playlistId: string, offset: number) =>
      sendSocketCommand('playback', 'playlistTracks', {
        playlistId,
        offset
      }),
    albumTracks: (albumId: string, offset: number) =>
      sendSocketCommand('playback', 'albumTracks', {
        albumId,
        offset
      }),
    playTrack: (
      trackID: string,
      contextType?: string,
      contextId?: string
    ) => {
      if (contextType && contextId) {
        sendSocketCommand('playback', 'playTrack', {
          trackID,
          contextType,
          contextId
        })
      } else {
        sendSocketCommand('playback', 'playTrack', {
          trackID
        })
      }
    },
    devices: () => {
      sendSocketCommand('playback', 'devices')
    },
    transferPlayback: (deviceId: string) => {
      sendSocketCommand('playback', 'transferPlayback', { deviceId })
    }
  }

  return (
    <MediaContext.Provider
      value={{
        image,
        playerData,
        playerDataRef,
        lyricsData,
        lyricsLoading,
        lyricsCurrentLineIndex,
        actions,
        playlistsData,
        albumsData,
        playlistsOffset,
        playlistsTotal,
        playlistsLoading,
        setPlaylistsData,
        setPlaylistsOffset,
        setPlaylistsLoading,
        likedSongsData,
        likedSongsOffset,
        likedSongsTotal,
        likedSongsImage,
        likedSongsLoading,
        setLikedSongsData,
        setLikedSongsOffset,
        setLikedSongsLoading
      }}
    >
      {children}
    </MediaContext.Provider>
  )
}

export { MediaContext, MediaContextProvider }
