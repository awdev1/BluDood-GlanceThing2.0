import axios, { AxiosInstance } from 'axios'
import { TOTP } from 'totp-generator'
import { WebSocket } from 'ws'

import { BasePlaybackHandler } from './BasePlaybackHandler.js'
import {
  log,
  LogLevel,
  base32FromBytes,
  cleanBuffer,
  intToRgb
} from '../utils.js'

import {
  Action,
  PlaybackData,
  RepeatMode,
  LyricsResponse,
  PlaybackResponse
} from '../../types/Playback.js'
import {
  SpotifyDevice,
  SpotifyCurrentPlayingResponse,
  SpotifyTrackItem,
  SpotifyEpisodeItem
} from '../../types/spotifyResponse.js'
import { Cache } from '../cache.js'

async function subscribe(connection_id: string, token: string) {
  return await axios.put(
    'https://api.spotify.com/v1/me/notifications/player',
    null,
    {
      params: { connection_id },
      headers: { Authorization: `Bearer ${token}` },
      validateStatus: () => true
    }
  )
}

async function generateTotp(): Promise<{
  otp: string
  timestamp: number
}> {
  const secretSauce = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

  const secretCipherBytes = [
    12, 56, 76, 33, 88, 44, 88, 33, 78, 78, 11, 66, 22, 22, 55, 69, 54
  ].map((e, t) => e ^ ((t % 33) + 9))

  const secretBytes = cleanBuffer(
    new TextEncoder()
      .encode(secretCipherBytes.join(''))
      .reduce((acc, val) => acc + val.toString(16).padStart(2, '0'), '')
  )

  const secret = base32FromBytes(secretBytes, secretSauce)

  const res = await axios.get('https://open.spotify.com/server-time')
  const timestamp = res.data.serverTime * 1000

  const totp = TOTP.generate(secret, { timestamp })

  return {
    otp: totp.otp,
    timestamp
  }
}

export async function getWebToken(sp_dc: string) {
  const totp = await generateTotp()

  const res = await axios.get(
    'https://open.spotify.com/get_access_token',
    {
      headers: {
        cookie: `sp_dc=${sp_dc};`,
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      },
      params: {
        reason: 'init',
        productType: 'web-player',
        totp: totp.otp,
        totpVer: '5',
        ts: totp.timestamp
      },
      validateStatus: () => true
    }
  )

  if (res.status !== 200) throw new Error('Invalid sp_dc')
  if (!res.data.accessToken) throw new Error('Invalid sp_dc')

  return res.data.accessToken
}

export async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
) {
  const res = await axios.post(
    'https://accounts.spotify.com/api/token',
    {},
    {
      params: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      },
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      validateStatus: () => true
    }
  )

  if (res.status !== 200) return null
  return res.data.access_token
}

const defaultSupportedActions: Action[] = [
  'play',
  'pause',
  'next',
  'previous',
  'image'
]

export function filterData(
  data: SpotifyCurrentPlayingResponse
): PlaybackData | null {
  const {
    is_playing,
    item,
    context,
    progress_ms,
    currently_playing_type,
    device,
    repeat_state,
    shuffle_state
  } = data

  if (!item) return null

  const repeatStateMap: Record<string, RepeatMode> = {
    off: 'off',
    context: 'on',
    track: 'one'
  }

  if (currently_playing_type === 'episode') {
    const item = data.item as SpotifyEpisodeItem

    return {
      isPlaying: is_playing,
      repeat: repeatStateMap[repeat_state],
      shuffle: shuffle_state,
      volume: device.volume_percent,
      track: {
        id: item.id,
        album: item.show.name,
        artists: [item.show.publisher],
        duration: {
          current: progress_ms,
          total: item.duration_ms
        },
        name: item.name
      },
      context: {
        uri: context?.uri,
        type: context?.type
      },
      supportedActions: [
        ...defaultSupportedActions,
        ...((device.supports_volume ? ['volume'] : []) as Action[])
      ]
    }
  } else if (currently_playing_type === 'track') {
    const item = data.item as SpotifyTrackItem

    return {
      isPlaying: is_playing,
      repeat: repeatStateMap[repeat_state],
      shuffle: shuffle_state,
      volume: device.volume_percent,
      track: {
        id: item.id,
        album: item.album.name,
        artists: item.artists.map(a => a.name),
        duration: {
          current: progress_ms,
          total: item.duration_ms
        },
        name: item.name
      },
      context: {
        uri: context?.uri,
        type: context?.type
      },
      supportedActions: [
        ...defaultSupportedActions,
        'repeat',
        'shuffle',
        'lyrics',
        'playlists',
        'devices',
        ...((device.supports_volume ? ['volume'] : []) as Action[])
      ]
    }
  }

  return null
}

interface SpotifyConfig {
  sp_dc: string
  clientId: string
  clientSecret: string
  refreshToken: string
}

class SpotifyHandler extends BasePlaybackHandler {
  name: string = 'spotify'

  config: SpotifyConfig | null = null
  accessToken: string | null = null
  webToken: string | null = null
  ws: WebSocket | null = null
  instance: AxiosInstance | null = null
  lastPlayedData: PlaybackData | null = null
  currentTrackId: string | null = null

  lyricsCache: Cache<LyricsResponse>
  playlistImageCache: Cache<string>
  cacheCleanupInterval: NodeJS.Timeout | null = null
<<<<<<< HEAD

  constructor() {
    super()
    // 24 hours expiration for lyrics cache
    this.lyricsCache = new Cache<LyricsResponse>(
      24 * 60 * 60 * 1000,
      'spotify_lyrics_cache',
      'lyrics'
    )

    // 7 days expiration for playlist image cache
    this.playlistImageCache = new Cache<string>(
      7 * 24 * 60 * 60 * 1000,
      'spotify_playlist_image_cache',
      'playlist image'
    )
  }

  // Utility function to fetch and cache images
  private async fetchImage(
    imageUrl: string,
    cacheKey: string
  ): Promise<string> {
    const now = Date.now()
    const cachedImage = this.playlistImageCache.get(cacheKey)

    if (
      cachedImage &&
      now - cachedImage.timestamp < this.playlistImageCache.expirationAt()
    ) {
      return cachedImage.data
    }

    try {
      const imageRes = await axios.get(imageUrl, {
        responseType: 'arraybuffer'
      })
      const imageData = `data:image/jpeg;base64,${Buffer.from(imageRes.data).toString('base64')}`
      this.playlistImageCache.set(cacheKey, imageData)
      return imageData
    } catch (error) {
      log(`Error fetching image: ${error}`, 'Spotify', LogLevel.ERROR)
      return ''
    }
  }
=======
  lyricsCacheStorageKey: string = 'spotify_lyrics_cache'
  lastPlayedStorageKey: string = 'spotify_last_played'
>>>>>>> main

  async setup(config: SpotifyConfig): Promise<void> {
    log('Setting up', 'Spotify')

    this.config = config

<<<<<<< HEAD
    this.lyricsCache.load()
    this.playlistImageCache.load()
    this.cacheCleanupInterval = setInterval(
      () => {
        this.lyricsCache.clean()
        this.lyricsCache.save()
        this.playlistImageCache.clean()
        this.playlistImageCache.save()
      },
      60 * 60 * 1000
    )
=======
    // Load last played data from storage
    try {
      const storedLastPlayed = getStorageValue(this.lastPlayedStorageKey)
      if (storedLastPlayed) {
        this.lastPlayedData = storedLastPlayed
        log('Loaded last played track from storage', 'Spotify', LogLevel.DEBUG)
      }
    } catch (error) {
      log(`Error loading last played data: ${error}`, 'Spotify', LogLevel.WARN)
    }
>>>>>>> main

    // Initialize axios instance first
    this.instance = axios.create({
      baseURL: 'https://api.spotify.com/v1',
      validateStatus: () => true
    })

    this.instance.interceptors.request.use(config => {
      config.headers.Authorization = `Bearer ${this.accessToken}`
      return config
    })

    this.instance.interceptors.response.use(async res => {
      if (res.status === 401) {
        log('Refreshing token...', 'Spotify')
        this.accessToken = await refreshAccessToken(
          this.config!.clientId,
          this.config!.clientSecret,
          this.config!.refreshToken
        ).catch(err => {
          this.emit('error', err)
          return null
        })

        if (!this.accessToken) return res
        return this.instance!(res.config)
      }

      return res
    })

    // Get tokens
    if (this.config!.sp_dc) {
      this.webToken = await getWebToken(this.config!.sp_dc).catch(err => {
        log(`Error getting webToken: ${err}`, 'Spotify', LogLevel.WARN)
        return null
      })
    }

    this.accessToken = await refreshAccessToken(
      this.config!.clientId,
      this.config!.clientSecret,
      this.config!.refreshToken
    ).catch(err => {
      this.emit('error', err)
      return null
    })

    // Load lyrics cache after storage is initialized
    try {
      this.loadLyricsCache()
    } catch (error) {
      log(`Error loading lyrics cache: ${error}`, 'Spotify', LogLevel.WARN)
      this.lyricsCache = new Map()
    }

    // Setup WebSocket if webToken is available
    if (this.webToken) {
      this.ws = new WebSocket(
        `wss://dealer.spotify.com/?access_token=${this.webToken}`
      )
      await this.start()
    } else {
      this.emit('open', this.name)
    }
<<<<<<< HEAD
=======

    // Setup cache cleanup interval
    this.cacheCleanupInterval = setInterval(
      () => {
        this.cleanLyricsCache()
        this.saveLyricsCache()
      },
      60 * 60 * 1000
    )

    // Add app resume handler
    if (process.platform === 'darwin') {
      const { app } = require('electron')
      app.on('activate', () => {
        log('App activated, refreshing lyrics if needed', 'Spotify', LogLevel.DEBUG)
        this.refreshLyricsIfNeeded()
      })
    }
>>>>>>> main
  }

  async start() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const ping = () => this.ws!.send('{"type":"ping"}')

    this.ws.on('open', () => {
      ping()
      const interval = setInterval(() => {
        if (!this.ws) return clearInterval(interval)
        ping()
      }, 15000)
    })

    this.ws.on('message', async d => {
      const msg = JSON.parse(d.toString())
      if (msg.headers?.['Spotify-Connection-Id']) {
        await subscribe(
          msg.headers['Spotify-Connection-Id'],
          this.webToken!
        )
          .then(() => this.emit('open', this.name))
          .catch(err => this.emit('error', err))

        return
      }
      const event = msg.payloads?.[0]?.events?.[0]
      if (!event) return

      if (event.type === 'PLAYER_STATE_CHANGED') {
        const state = event.event.state

        if (state.currently_playing_type === 'track') {
          this.emit('playback', filterData(state))
        } else if (state.currently_playing_type === 'episode') {
          const current = await this.getCurrent()
          if (!current) return

          this.emit('playback', filterData(current))
        }
      } else if (event.type === 'DEVICE_STATE_CHANGED') {
        const devices = event.event.devices
        if (devices.some(d => d.is_active)) return
        this.emit('playback', null)
      }
    })

    this.ws.on('close', () => this.emit('close'))
    this.ws.on('error', err => this.emit('error', err))
  }

  async cleanup(): Promise<void> {
    log('Cleaning up', 'Spotify')

<<<<<<< HEAD
    this.lyricsCache.save()
=======
    // Save last played data before cleanup
    try {
      if (this.lastPlayedData) {
        setStorageValue(this.lastPlayedStorageKey, this.lastPlayedData)
        log('Saved last played track to storage during cleanup', 'Spotify', LogLevel.DEBUG)
      }
    } catch (error) {
      log(`Error saving last played data during cleanup: ${error}`, 'Spotify', LogLevel.WARN)
    }

    this.saveLyricsCache()
>>>>>>> main
    this.lyricsCache.clear()
    this.playlistImageCache.save()
    this.playlistImageCache.clear()

    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval)
      this.cacheCleanupInterval = null
    }

    if (!this.ws) return
    this.ws.removeAllListeners()
    this.ws.close()
    this.ws = null
    this.removeAllListeners()
  }

<<<<<<< HEAD
=======
  cleanLyricsCache(): void {
    const now = Date.now()
    let expiredCount = 0

    for (const [trackId, entry] of Array.from(this.lyricsCache.entries())) {
      if (now - entry.timestamp > this.lyricsCacheExpiration) {
        this.lyricsCache.delete(trackId)
        expiredCount++
      }
    }

    log(
      `Cleaned lyrics cache. Removed ${expiredCount} expired entries. Current size: ${this.lyricsCache.size} entries`,
      'Spotify',
      LogLevel.DEBUG
    )
  }

  saveLyricsCache(): void {
    try {
      const cacheEntries = Array.from(this.lyricsCache.entries())
      setStorageValue(this.lyricsCacheStorageKey, cacheEntries)
      log(
        `Saved lyrics cache with ${cacheEntries.length} entries`,
        'Spotify',
        LogLevel.DEBUG
      )
    } catch (error) {
      log(`Error saving lyrics cache: ${error}`, 'Spotify', LogLevel.ERROR)
    }
  }

  loadLyricsCache(): void {
    try {
      const cachedData = getStorageValue(this.lyricsCacheStorageKey)
      if (cachedData && Array.isArray(cachedData)) {
        this.lyricsCache = new Map(cachedData)
        log(
          `Loaded lyrics cache with ${this.lyricsCache.size} entries`,
          'Spotify',
          LogLevel.DEBUG
        )
        this.cleanLyricsCache()
      } else {
        log(
          `No lyrics cache found or invalid format`,
          'Spotify',
          LogLevel.DEBUG
        )
      }
    } catch (error) {
      log(
        `Error loading lyrics cache: ${error}`,
        'Spotify',
        LogLevel.ERROR
      )
      this.lyricsCache = new Map()
    }
  }

  getLyricsCacheStats(): { size: number; avgAge: number } {
    const now = Date.now()
    let totalAge = 0

    for (const entry of Array.from(this.lyricsCache.values())) {
      totalAge += now - entry.timestamp
    }

    const size = this.lyricsCache.size
    const avgAge = size > 0 ? totalAge / size / 1000 : 0

    return { size, avgAge }
  }

>>>>>>> main
  async validateConfig(config: unknown): Promise<boolean> {
    const { sp_dc, clientId, clientSecret, refreshToken } =
      config as SpotifyConfig

    if (clientId && clientSecret && refreshToken && !sp_dc) {
      const token = await refreshAccessToken(
        clientId,
        clientSecret,
        refreshToken
      ).catch(() => null)
      if (!token) return false
      return true
    } else if (sp_dc && !clientId && !clientSecret) {
      const token = await getWebToken(sp_dc).catch(() => null)
      if (!token) return false
      return true
    }

    return false
  }

  async getCurrent(): Promise<SpotifyCurrentPlayingResponse | null> {
    const res = await this.instance!.get('/me/player', {
      params: { additional_types: 'episode' }
    })

    if (!res.data || res.status !== 200) return null
    return res.data
  }

  async getPlayback(): Promise<PlaybackData> {
    const current = await this.getCurrent()
<<<<<<< HEAD
    if (!current) return null
    return filterData(current)
=======
    if (!current) {
      // If we have last played data, try to fetch its image and lyrics
      if (this.lastPlayedData) {
        try {
          const image = await this.getImage()
          if (image) {
            this.emit('image', image.toString('base64'))
          }
          
          const lyrics = await this.getLyrics()
          if (lyrics) {
            this.emit('lyrics', lyrics)
          }
        } catch (error) {
          log(`Error fetching last played data: ${error}`, 'Spotify', LogLevel.WARN)
        }
      }
      return this.lastPlayedData
    }

    const playbackData = filterData(current)
    if (playbackData) {
      this.lastPlayedData = playbackData
      // Save last played data to storage
      try {
        setStorageValue(this.lastPlayedStorageKey, playbackData)
        log('Saved last played track to storage', 'Spotify', LogLevel.DEBUG)
      } catch (error) {
        log(`Error saving last played data: ${error}`, 'Spotify', LogLevel.WARN)
      }
    }
    return playbackData
>>>>>>> main
  }

  async play(): Promise<void> {
    await this.instance!.put('/me/player/play')
    
    // Fetch lyrics after play is pressed
    try {
      const current = await this.getCurrent()
      if (current && current.currently_playing_type === 'track') {
        const item = current.item as SpotifyTrackItem
        this.currentTrackId = item.id
        const lyrics = await this.getLyrics()
        if (lyrics) {
          this.emit('lyrics', lyrics)
        }
      }
    } catch (error) {
      log(`Error fetching lyrics after play: ${error}`, 'Spotify', LogLevel.ERROR)
    }
  }

  async pause(): Promise<void> {
    await this.instance!.put('/me/player/pause')
  }

  async setVolume(volume: number, deviceId?: string): Promise<void> {
    await this.instance!.put('/me/player/volume', null, {
      params: {
        volume_percent: volume,
        ...(deviceId ? { device_id: deviceId } : {})
      }
    })
  }

  async next(): Promise<void> {
    await this.instance!.post('/me/player/next')
  }

  async previous(): Promise<void> {
    await this.instance!.post('/me/player/previous')
  }

  async shuffle(state: boolean): Promise<void> {
    await this.instance!.put('/me/player/shuffle', null, {
      params: { state }
    })
  }

  async repeat(state: RepeatMode): Promise<void> {
    const map: Record<RepeatMode, string> = {
      off: 'off',
      on: 'context',
      one: 'track'
    }

    await this.instance!.put('/me/player/repeat', null, {
      params: { state: map[state] }
    })
  }

  async getImage(): Promise<Buffer | null> {
    const current = await this.getCurrent()
    if (!current) return null

    try {
      if (current.currently_playing_type === 'episode') {
        const item = current.item as SpotifyEpisodeItem
        const imageRes = await axios.get(item.images[0].url, {
          responseType: 'arraybuffer'
        })
        return imageRes.data
      } else if (current.currently_playing_type === 'track') {
        const item = current.item as SpotifyTrackItem
        const imageRes = await axios.get(item.album.images[1].url, {
          responseType: 'arraybuffer'
        })
        return imageRes.data
      }
      return null
    } catch (error) {
      log(`Error fetching image: ${error}`, 'Spotify', LogLevel.ERROR)
      return null
    }
  }

  async getLyrics(): Promise<LyricsResponse | null> {
    const current = await this.getCurrent()
    if (!current) return null
    if (current.currently_playing_type === 'episode') {
      return { message: 'No lyrics for podcast' }
    }

    const item = current.item as SpotifyTrackItem
    const trackId = item.id
    this.currentTrackId = trackId
    const now = Date.now()

    const cachedLyrics = this.lyricsCache.get(trackId)
    if (
      cachedLyrics &&
      now - cachedLyrics.timestamp < this.lyricsCache.expirationAt()
    ) {
      return cachedLyrics.data
    }

    try {
      let url = `https://spclient.wg.spotify.com/color-lyrics/v2/track/${trackId}`
      if (item.album.images[0]?.url) {
        url += `/image/${encodeURIComponent(item.album.images[0].url)}`
      }
      const params = new URLSearchParams()
      params.append('format', 'json')
      params.append('vocalRemoval', 'false')
      params.append('market', 'from_token')
      if (params.toString()) {
        url += '?' + params.toString()
      }

      const fetchLyrics = async (): Promise<{
        status: number
        data: LyricsResponse
      }> => {
        return axios.get(url, {
          headers: {
            authorization: `Bearer ${this.webToken}`,
            'app-platform': 'WebPlayer'
          },
          validateStatus: () => true
        })
      }

      let res = await fetchLyrics()

      if (res.status === 401 && this.config?.sp_dc) {
        this.webToken = await getWebToken(this.config.sp_dc)
        log('Successfully refreshed webToken', 'Spotify', LogLevel.DEBUG)
        res = await fetchLyrics()
      }

      if (res.status !== 200) {
        throw new Error(`Failed to fetch lyrics: ${res.status}`)
      }

      if (res.data.colors) {
        res.data.colors = {
          background: intToRgb(res.data.colors?.background) ?? 0,
          text: intToRgb(res.data.colors?.text) ?? 0,
          highlightText: intToRgb(res.data.colors?.highlightText) ?? 0
        }
      }

      this.lyricsCache.set(trackId, res.data)
      return res.data
    } catch (error) {
      log(`Error fetching lyrics: ${error}`, 'Spotify', LogLevel.ERROR)
      const noLyricsMsg = 'No lyrics for this track'
      this.lyricsCache.set(trackId, { message: noLyricsMsg })
      return { message: noLyricsMsg }
    }
  }

<<<<<<< HEAD
  async playlists(offset: number = 0) {
    try {
      const res = await this.instance!.get('/me/playlists', {
        params: { offset, limit: 50 }
      })

      if (res.status !== 200 || !res.data?.items) {
        return { items: [], offset, total: 0 }
      }

      const processedPlaylists: unknown[] = []

      for (const item of res.data.items) {
        try {
          const processedItem = {
            ...item,
            source: 'playlist',
            type: 'playlist'
          }

          if (item.images && item.images.length > 0) {
            processedItem.image = await this.fetchImage(
              item.images[0].url,
              item.id
            )
          } else {
            processedItem.image = ''
          }

          processedPlaylists.push(processedItem)
        } catch (itemErr) {
          log(
            `Error processing playlist item: ${itemErr}`,
            'Spotify',
            LogLevel.ERROR
          )
          processedPlaylists.push({
            ...item,
            source: 'playlist',
            type: 'playlist'
          })
        }
      }

      return {
        items: processedPlaylists,
        offset,
        total: res.data.total,
        limit: res.data.limit,
        next: res.data.next,
        previous: res.data.previous
      }
    } catch (error) {
      log(`Error in playlists: ${error}`, 'Spotify', LogLevel.ERROR)
      return { items: [], offset, total: 0 }
    }
  }

  async likedSongsImage() {
    return this.fetchImage(
      'https://misc.scdn.co/liked-songs/liked-songs-300.jpg',
      'liked-songs'
    )
  }

  async likedSongs(offset: number = 0, limit: number = 50) {
    try {
      const res = await this.instance!.get('/me/tracks', {
        params: { offset, limit }
      })

      if (res.status !== 200 || !res.data?.items) {
        return { items: [], offset, total: 0 }
      }

      const processedLikedSongs: unknown[] = []

      for (const item of res.data.items) {
        try {
          const track = { ...item.track }

          if (track.artists && Array.isArray(track.artists)) {
            track.artists = track.artists.map(
              (artist: { name: string }) => artist.name
            )
          }

          if (track.album?.images && track.album.images.length > 0) {
            track.image = await this.fetchImage(
              track.album.images[2].url,
              track.id
            )
          } else {
            track.image = ''
          }

          track.source = 'liked'
          track.type = 'track'

          processedLikedSongs.push(track)
        } catch (itemErr) {
          log(
            `Error processing liked song item: ${itemErr}`,
            'Spotify',
            LogLevel.ERROR
          )
          const fallbackTrack = item.track
          fallbackTrack.source = 'liked'
          fallbackTrack.type = 'track'
          processedLikedSongs.push(fallbackTrack)
        }
      }

      return {
        items: processedLikedSongs,
        offset,
        total: res.data.total,
        limit: res.data.limit,
        next: res.data.next,
        previous: res.data.previous,
        image: await this.likedSongsImage()
      }
    } catch (error) {
      log(`Error in likedSongs: ${error}`, 'Spotify', LogLevel.ERROR)
      return { items: [], offset, total: 0, image: null }
    }
  }

  async getUserID() {
    const res = await this.instance!.get('/me')
    return res.data.id
  }

  async playPlaylist(playlistId: string) {
    await this.instance!.put('/me/player/play', {
      context_uri: `spotify:playlist:${playlistId}`
    })
  }

  async playTrack(
    trackID: string,
    contextType?: string,
    contextId?: string,
    shuffle?: boolean
  ) {
    try {
      let requestBody = {}
      const userId = await this.getUserID()

      if (contextType && contextId) {
        requestBody = {
          context_uri: `spotify:${contextType}:${contextId}`,
          offset: { uri: `spotify:track:${trackID}` },
          position_ms: 0
        }
      } else {
        requestBody = {
          context_uri: `spotify:user:${userId}:collection`,
          offset: { uri: `spotify:track:${trackID}` },
          position_ms: 0
        }
      }

      const res = await this.instance!.put('/me/player/play', requestBody)

      if (!contextType) {
        await this.shuffle(shuffle ?? false)
      }

      if (res.status >= 200 && res.status < 300) {
        return { success: true, trackID, contextType, contextId }
      }

      return { success: false, error: `${res.data}` }
    } catch (error) {
      log(`Error playing track: ${error}`, 'Spotify', LogLevel.ERROR)
      return { success: false, error: `${error}` }
    }
  }

  async albums(offset: number = 0, limit: number = 50) {
    try {
      const res = await this.instance!.get('/me/albums', {
        params: { offset, limit }
      })

      if (res.status !== 200 || !res.data?.items) {
        return { items: [], offset, total: 0 }
      }

      const processedAlbums: unknown[] = []

      for (const item of res.data.items) {
        try {
          const album = {
            ...item.album,
            source: 'album',
            type: 'album',
            added_at: item.added_at
          }

          if (album.artists && Array.isArray(album.artists)) {
            album.artists = album.artists.map(
              (artist: { name: string }) => artist.name
            )
          }

          if (album.images && album.images.length > 0) {
            album.image = await this.fetchImage(
              album.images[1].url,
              album.id
            )
          } else {
            album.image = ''
          }

          processedAlbums.push(album)
        } catch (itemErr) {
          log(
            `Error processing album item: ${itemErr}`,
            'Spotify',
            LogLevel.ERROR
          )
          const fallbackAlbum = item.album
          fallbackAlbum.source = 'album'
          fallbackAlbum.type = 'album'
          fallbackAlbum.added_at = item.added_at
          processedAlbums.push(fallbackAlbum)
        }
      }

      return {
        items: processedAlbums,
        offset,
        total: res.data.total,
        limit: res.data.limit,
        next: res.data.next,
        previous: res.data.previous
      }
    } catch (error) {
      log(`Error in albums: ${error}`, 'Spotify', LogLevel.ERROR)
      return { items: [], offset, total: 0 }
    }
  }

  async albumTracks(
    albumId: string,
    offset: number = 0,
    limit: number = 50
  ) {
    try {
      const res = await this.instance!.get(`/albums/${albumId}/tracks`, {
        params: { offset, limit }
      })

      if (res.status !== 200 || !res.data) {
        return null
      }

      const processedTracks: unknown[] = []

      for (const item of res.data.items) {
        try {
          const track = { ...item, album_id: albumId }
          if (track.artists && Array.isArray(track.artists)) {
            track.artists = track.artists.map(
              (artist: { name: string }) => artist.name
            )
          }

          processedTracks.push(track)
        } catch (itemErr) {
          log(
            `Error processing album track item: ${itemErr}`,
            'Spotify',
            LogLevel.ERROR
          )
          processedTracks.push({ ...item, album_id: albumId })
        }
      }

      res.data.items = processedTracks
      return res.data
    } catch (error) {
      log(`Error in albumTracks: ${error}`, 'Spotify', LogLevel.ERROR)
      return null
    }
  }

  async playAlbum(albumId: string) {
    try {
      const res = await this.instance!.put('/me/player/play', {
        context_uri: `spotify:album:${albumId}`
      })

      if (res.status >= 200 && res.status < 300) {
        return { success: true, albumId }
      }
      return { success: false, error: `${res.data}` }
    } catch (error) {
      log(`Error playing album: ${error}`, 'Spotify', LogLevel.ERROR)
      return { success: false, error: `${error}` }
    }
  }

  async playlistTracks(
    playlistId: string,
    offset: number = 0,
    limit: number = 50
  ) {
    try {
      const res = await this.instance!.get(
        `/playlists/${playlistId}/tracks`,
        { params: { offset, limit } }
      )

      if (res.status !== 200 || !res.data) {
        return null
      }

      const processedPlaylistTracks: unknown[] = []

      for (const item of res.data.items) {
        try {
          const track = { ...item.track }

          track.artists = track.artists.map(
            (artist: { name: string }) => artist.name
          )
          track.source = 'playlist'
          track.type = 'track'
          track.playlist_id = playlistId

          if (track.album?.images && track.album.images.length > 0) {
            track.image = await this.fetchImage(
              track.album.images[2].url,
              track.id
            )
          } else {
            track.image = ''
          }

          processedPlaylistTracks.push(track)
        } catch (itemErr) {
          log(
            `Error processing playlist track item: ${itemErr}`,
            'Spotify',
            LogLevel.ERROR
          )
          const fallbackTrack = item.track
          fallbackTrack.source = 'playlist'
          fallbackTrack.type = 'track'
          fallbackTrack.playlist_id = playlistId
          processedPlaylistTracks.push(fallbackTrack)
        }
      }
      res.data.items = processedPlaylistTracks
      return res.data
    } catch (error) {
      log(`Error in playlistTracks: ${error}`, 'Spotify', LogLevel.ERROR)
      return null
    }
  }

  async devices(): Promise<SpotifyDevice[]> {
    try {
      const res = await this.instance!.get('/me/player/devices')
      if (res.status !== 200 || !res.data?.devices) {
        return []
      }
      return res.data.devices
    } catch (error) {
      log(`Error in devices: ${error}`, 'Spotify', LogLevel.ERROR)
      return []
    }
  }

  async transferPlayback(
    deviceId: string,
    play: boolean = true
  ): Promise<PlaybackResponse> {
    try {
      const res = await this.instance!.put('/me/player', {
        device_ids: [deviceId],
        play
      })

      if (res.status >= 200 && res.status < 300) {
        return { success: true }
      }

      return { success: false, error: res.data.message }
    } catch (error) {
      log(
        `Error transferring playback: ${error}`,
        'Spotify',
        LogLevel.ERROR
      )
      return { success: false, error: `${error}` }
    }
  }

  async getActiveDevice(): Promise<SpotifyDevice | null> {
    const devices = await this.devices()
    return devices.find(device => device.is_active) || null
  }
=======
  async refreshLyricsIfNeeded(): Promise<void> {
    const current = await this.getCurrent()
    if (!current || current.currently_playing_type !== 'track') return

    const item = current.item as SpotifyTrackItem
    const trackId = item.id

    // If it's a new track or the current track's lyrics are expired
    if (trackId !== this.currentTrackId) {
      this.currentTrackId = trackId
      const cachedLyrics = this.lyricsCache.get(trackId)
      const now = Date.now()

      if (!cachedLyrics || (now - cachedLyrics.timestamp > this.lyricsCacheExpiration)) {
        log(`Refreshing lyrics for track: ${trackId}`, 'Spotify', LogLevel.DEBUG)
        try {
          const lyrics = await this.getLyrics()
          if (lyrics) {
            this.emit('lyrics', lyrics)
          }
        } catch (error) {
          log(`Error refreshing lyrics: ${error}`, 'Spotify', LogLevel.ERROR)
        }
      }
    }
  }
>>>>>>> main
}

export default new SpotifyHandler()
