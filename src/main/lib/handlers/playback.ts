import { RepeatMode } from '../../types/Playback.js'
import {
  HandlerAction,
  HandlerFunction
} from '../../types/WebSocketHandler.js'
import { playbackManager } from '../playback/playback.js'
import { log, LogLevel } from '../utils.js'

export const name = 'playback'

export const hasActions = true

export const actions: HandlerAction[] = [
  {
    action: 'pause',
    handle: async () => {
      await playbackManager.pause()
    }
  },
  {
    action: 'play',
    handle: async () => {
      await playbackManager.play()
    }
  },
  {
    action: 'volume',
    handle: async (_ws, data) => {
      await playbackManager.setVolume(
        (data as { volume: number }).volume,
        (data as { deviceId?: string }).deviceId
      )
    }
  },
  {
    action: 'image',
    handle: async ws => {
      const image = await playbackManager.getImage()
      ws.send(
        JSON.stringify({
          type: 'playback',
          action: 'image',
          data: image ? image.toString('base64') : null
        })
      )
    }
  },
  {
    action: 'previous',
    handle: async () => {
      await playbackManager.previous()
    }
  },
  {
    action: 'next',
    handle: async () => {
      await playbackManager.next()
    }
  },
  {
    action: 'shuffle',
    handle: async (_, data) => {
      await playbackManager.shuffle((data as { state: boolean }).state)
    }
  },
  {
    action: 'repeat',
    handle: async (_, data) => {
      await playbackManager.repeat((data as { state: RepeatMode }).state)
    }
  },
  {
    action: 'lyrics',
    handle: async ws => {
      const lyrics = await playbackManager.getLyrics()
      if (!lyrics) return
      ws.send(
        JSON.stringify({
          type: 'playback',
          action: 'lyrics',
          data: lyrics
        })
      )
    }
  },
  {
    action: 'playlists',
    handle: async (ws, data) => {
      const offset = (data as { offset: number }).offset
      const playlists = await playbackManager.playlists(offset)
      if (!playlists) return
      ws.send(
        JSON.stringify({
          type: 'playback',
          action: 'playlists',
          data: playlists
        })
      )
    }
  },
  {
    action: 'playlistTracks',
    handle: async (ws, data) => {
      const {
        playlistId,
        offset = 0,
        limit = 50
      } = data as {
        playlistId: string
        offset?: number
        limit?: number
      }

      log(
        `Fetching tracks for playlist ${playlistId} (offset: ${offset}, limit: ${limit})`,
        'Playback',
        LogLevel.DEBUG
      )

      const tracks = await playbackManager.playlistTracks(
        playlistId,
        offset,
        limit
      )
      if (!tracks) return

      ws.send(
        JSON.stringify({
          type: 'playback',
          action: 'playlistTracks',
          data: tracks
        })
      )
    }
  },
  {
    action: 'playPlaylist',
    handle: async (_, data) => {
      await playbackManager.playPlaylist(
        (data as { playlistId: string }).playlistId
      )
    }
  },
  {
    action: 'playTrack',
    handle: async (ws, data) => {
      const { trackID, contextType, contextId, shuffle } = data as {
        trackID: string
        contextType?: string
        contextId?: string
        shuffle?: boolean
      }
      log(
        `Handling playTrack request for track ${trackID}${contextType && contextId ? ` in ${contextType} ${contextId}` : ''}`,
        'Playback',
        LogLevel.DEBUG
      )

      const result = await playbackManager.playTrack(
        trackID,
        contextType,
        contextId,
        shuffle
      )

      // Send a response back to the client to confirm track is playing
      ws.send(
        JSON.stringify({
          type: 'playback',
          action: 'trackPlayed',
          data: {
            success: result?.success || true,
            trackID,
            contextType,
            contextId,
            error: result?.error || null
          }
        })
      )
    }
  },
  {
    action: 'albums',
    handle: async (ws, data) => {
      const offset = (data as { offset: number }).offset || 0
      const limit = (data as { limit: number }).limit || 50
      log(
        `Fetching albums (offset: ${offset}, limit: ${limit})`,
        'Playback',
        LogLevel.DEBUG
      )
      const albums = await playbackManager.albums(offset, limit)
      if (!albums) return
      ws.send(
        JSON.stringify({
          type: 'playback',
          action: 'albums',
          data: albums
        })
      )
    }
  },
  {
    action: 'albumTracks',
    handle: async (ws, data) => {
      log(
        `Fetching album tracks ${JSON.stringify(data)}`,
        'Playback',
        LogLevel.DEBUG
      )
      const albumId = data?.albumId
      const offset = data?.offset || 0
      const limit = data?.limit || 50

      log(
        `Fetching tracks for album ${albumId} (offset: ${offset}, limit: ${limit})`,
        'Playback',
        LogLevel.DEBUG
      )

      const tracks = await playbackManager.albumTracks(albumId, offset)
      if (!tracks) return

      ws.send(
        JSON.stringify({
          type: 'playback',
          action: 'albumTracks',
          data: tracks
        })
      )
    }
  },
  {
    action: 'playAlbum',
    handle: async (_, data) => {
      await playbackManager.playAlbum(
        (data as { albumId: string }).albumId
      )
    }
  },
  {
    action: 'likedSongs',
    handle: async (ws, data) => {
      const offset = (data as { offset: number }).offset || 0
      const limit = (data as { limit: number }).limit || 50
      log(
        `Fetching liked songs (offset: ${offset}, limit: ${limit})`,
        'Playback',
        LogLevel.DEBUG
      )
      const likedSongs = await playbackManager.likedSongs(offset, limit)
      if (!likedSongs) return
      ws.send(
        JSON.stringify({
          type: 'playback',
          action: 'likedSongs',
          data: likedSongs
        })
      )
    }
  },
  {
    action: 'devices',
    handle: async ws => {
      const devices = await playbackManager.devices()
      ws.send(
        JSON.stringify({
          type: 'playback',
          action: 'devices',
          data: { devices }
        })
      )
    }
  },
  {
    action: 'transferPlayback',
    handle: async (ws, data) => {
      const { deviceId, play } = data as {
        deviceId: string
        play: boolean
      }
      const result = await playbackManager.transferPlayback(deviceId, play)
      ws.send(
        JSON.stringify({
          type: 'playback',
          action: 'transferPlayback',
          data: result
        })
      )
    }
  }
]

export const handle: HandlerFunction = async ws => {
  const res = await playbackManager.getPlayback()
  ws.send(
    JSON.stringify({
      type: 'playback',
      data: res
    })
  )
}
