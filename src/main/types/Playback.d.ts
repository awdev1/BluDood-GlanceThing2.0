import { rgb } from './utils'

export type RepeatMode = 'off' | 'on' | 'one'

export type Action =
  | 'play'
  | 'pause'
  | 'next'
  | 'previous'
  | 'shuffle'
  | 'repeat'
  | 'volume'
  | 'image'
  | 'lyrics'
  | 'playlists'
  | 'devices'

export type PlaybackData = {
  isPlaying: boolean
  volume: number
  shuffle: boolean
  repeat: RepeatMode
  track: {
    id: string
    name: string
    artists: string[]
    album: string
    duration: {
      current: number
      total: number
    }
  }
  context: {
    type: string
    uri: string
  }
  supportedActions: Action[]
} | null

export type PlaybackHandlerEvents = {
  playback: (data: PlaybackData) => void
  image: (data: string) => void
  open: (handlerName?: string) => void
  close: () => void
  error: (err: Error) => void
}

export interface LyricsResponse {
  lyrics?: {
    syncType: string
    lines: {
      startTimeMs: string
      endTimeMs: string
      words: string
      syllables?: {
        startTimeMs: string
        endTimeMs: string
        text: string
      }[]
    }
  }
  colors?: {
    background: rgb
    text: rgb
    highlightText: rgb
  }
  hasVocalRemoval?: boolean
  message?: string
  source?: string
}

export type PlaybackResponse = {
  success: boolean
  message?: string
  error?: string
  data?: unknown
}
