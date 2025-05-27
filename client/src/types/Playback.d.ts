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

export interface PlaybackData {
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
  supportedActions: Action[]
  context?: {
    type?: string
    uri?: string
  }
}

export interface Track {
  id: string
  name: string
  artists: string[]
  duration_ms: number
  album?: string
  isPlaying?: boolean
  image?: string
}

export interface Playlist {
  id: string
  name: string
  description: string
  image: string
  tracks: {
    total: number
    items?: Track[]
  }
  owner?: {
    display_name: string
  }
  artists?: Array<{ id: string; name: string } | string>
}

export interface Album {
  id: string
  name: string
  image: string
  tracks?: {
    total: number
    items?: Track[]
  }
  owner?: {
    display_name: string
  }
  artists?: Array<{ id: string; name: string } | string>
  images?: Array<{ url: string; height: number; width: number }>
  release_date?: string
  total_tracks?: number
  album_type?: string
  available_markets?: string[]
  href?: string
  uri?: string
  external_urls?: string
  type?: string
}

export interface SpotifyPlaylistsItems {
  owner: {
    id: string
    display_name: string
  }
  id: string
  name: string
  description: string
  image: string
  tracks: {
    total: number
  }
}

export interface LyricsLine {
  startTimeMs: string
  endTimeMs: string
  words: string
  syllables: {
    startTimeMs: string
    endTimeMs: string
    text: string
  }[]
}

export interface rgbColor {
  r: number
  g: number
  b: number
  a?: number
}

export interface SpotifyLyricsData {
  lyrics: {
    syncType: string
    lines: LyricsLine[]
  }
  colors: {
    background: rgbColor
    text: rgbColor
    highlightText: rgbColor
  }
  hasVocalRemoval: boolean
  message: string
}
