import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react'

import { SocketContext } from './SocketContext.tsx'

import { PlaybackData, RepeatMode } from '@/types/Playback.js'

interface MediaContextProps {
  image: string | null
  playerData: PlaybackData | null
  playerDataRef: React.MutableRefObject<PlaybackData | null>
  actions: {
    playPause: () => void
    skipForward: () => void
    skipBackward: () => void
    setVolume: (volume: number) => void
    shuffle: (state: boolean) => void
    repeat: (state: RepeatMode) => void
  }
}

const MediaContext = createContext<MediaContextProps>({
  image: null,
  playerData: null,
  playerDataRef: { current: null },
  actions: {
    playPause: () => {},
    skipForward: () => {},
    skipBackward: () => {},
    setVolume: () => {},
    shuffle: () => {},
    repeat: () => {}
  }
})

interface MediaContextProviderProps {
  children: React.ReactNode
}

const MediaContextProvider = ({ children }: MediaContextProviderProps) => {
  const { ready, socket } = useContext(SocketContext)

  const [playerData, setPlayerData] = useState<PlaybackData | null>(null)
  const playerDataRef = useRef<PlaybackData | null>(null)
  const [image, setImage] = useState<string | null>(null)

  useEffect(() => {
    if (ready === true && socket) {
      const listener = (e: MessageEvent) => {
        const { type, action, data } = JSON.parse(e.data)
        if (type !== 'playback') return
        const playbackData = data as PlaybackData

        if (action === 'image') {
          if (!data) return setImage(null)
          setImage(`data:image/png;base64,${data}`)
        } else {
          if (!data) return setPlayerData(null)
          setPlayerData(playbackData)

          if (
            playerDataRef.current?.track.name !== playbackData.track.name
          ) {
            socket.send(
              JSON.stringify({ type: 'playback', action: 'image' })
            )
          }
        }
      }

      socket.addEventListener('message', listener)

      socket.send(JSON.stringify({ type: 'playback' }))

      return () => {
        socket.removeEventListener('message', listener)
      }
    }
  }, [ready, socket])

  useEffect(() => {
    if (!playerData?.isPlaying) return

    const interval = setInterval(() => {
      setPlayerData(p => ({
        ...p!,
        track: {
          ...p!.track,
          duration: {
            ...p!.track.duration,
            current: p!.track.duration.current + 200
          }
        }
      }))
    }, 200)

    return () => {
      clearInterval(interval)
    }
  }, [playerData])

  useEffect(() => {
    playerDataRef.current = playerData
  }, [playerData])

  const actions = {
    playPause: () => {
      if (playerDataRef.current === null) return

      socket?.send(
        JSON.stringify({
          type: 'playback',
          action: playerDataRef.current?.isPlaying ? 'pause' : 'play'
        })
      )
      setPlayerData({
        ...playerDataRef.current!,
        isPlaying: !playerDataRef.current?.isPlaying
      })
    },
    skipForward: () => {
      if (playerDataRef.current === null) return

      socket?.send(
        JSON.stringify({
          type: 'playback',
          action: 'next'
        })
      )
    },
    skipBackward: () => {
      if (playerDataRef.current === null) return

      socket?.send(
        JSON.stringify({
          type: 'playback',
          action: 'previous'
        })
      )
    },
    setVolume: (volume: number) => {
      if (playerDataRef.current === null) return

      socket?.send(
        JSON.stringify({
          type: 'playback',
          action: 'volume',
          data: {
            volume
          }
        })
      )

      setPlayerData({
        ...playerDataRef.current!,
        volume: volume
      })
    },
    shuffle: (state: boolean) => {
      if (playerDataRef.current === null) return
      socket?.send(
        JSON.stringify({
          type: 'playback',
          action: 'shuffle',
          data: {
            state
          }
        })
      )

      setPlayerData({
        ...playerDataRef.current!,
        shuffle: state
      })
    },
    repeat: (state: RepeatMode) => {
      if (playerDataRef.current === null) return

      socket?.send(
        JSON.stringify({
          type: 'playback',
          action: 'repeat',
          data: {
            state
          }
        })
      )

      setPlayerData({
        ...playerDataRef.current!,
        repeat: state as RepeatMode
      })
    }
  }

  return (
    <MediaContext.Provider
      value={{
        image,
        playerData,
        playerDataRef,
        actions
      }}
    >
      {children}
    </MediaContext.Provider>
  )
}

export { MediaContext, MediaContextProvider }
