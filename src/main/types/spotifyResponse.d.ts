// Spotify API response interfaces

export interface SpotifyTrackItem {
  id: string
  name: string
  external_urls: {
    spotify: string
  }
  artists: {
    name: string
    external_urls: {
      spotify: string
    }
  }[]
  album: {
    name: string
    href: string
    images: {
      url: string
      width: number
      height: number
    }[]
  }
  duration_ms: number
}

export interface SpotifyEpisodeItem {
  id: string
  name: string
  external_urls: {
    spotify: string
  }
  images: {
    url: string
    width: number
    height: number
  }[]
  show: {
    name: string
    publisher: string
    external_urls: {
      spotify: string
    }
    href: string
    images: {
      url: string
      width: number
      height: number
    }[]
  }
  duration_ms: number
}

export interface SpotifyCurrentPlayingResponse {
  device: {
    id: string
    is_active: boolean
    is_private_session: boolean
    is_restricted: boolean
    name: string
    type: string
    volume_percent: number
    supports_volume: boolean
  }
  repeat_state: string
  shuffle_state: boolean
  context: {
    external_urls: {
      spotify: string
    }
    href: string
    type: string
    uri: string
  }
  timestamp: number
  progress_ms: number
  currently_playing_type: 'track' | 'episode'
  is_playing: boolean
  item: SpotifyTrackItem | SpotifyEpisodeItem
}

export interface SpotifyConfig {
  sp_dc: string
  clientId: string
  clientSecret: string
  refreshToken: string
}

export interface MusicLibraryItem {
  id: string
  name: string
  type: 'track' | 'album' | 'playlist'
  description?: string
  image?: string
  source: 'playlist' | 'album' | 'liked'
  artists?: string[]
  album?: string
  duration_ms?: number
  uri?: string
  added_at?: string
  owner?: string
}

export interface SpotifyDevice {
  id: string
  is_active: boolean
  is_private_session: boolean
  is_restricted: boolean
  name: string
  type: string
  volume_percent: number
  supports_volume: boolean
}

export interface SpotifyDevicesResponse {
  devices: SpotifyDevice[]
}
