import axios, { AxiosInstance } from 'axios'
import { WebSocket } from 'ws'
import { TOTP } from 'totp-generator'

import { BasePlaybackHandler } from './BasePlaybackHandler.js'
import { log, LogLevel, base32FromBytes, cleanBuffer } from '../utils.js'
import {
  getLyrics,
  initializeLyricsCache,
  cleanupLyricsCache
} from '../lyric.js'

import {
  Action,
  PlaybackData,
  RepeatMode,
  LyricsResponse
} from '../../types/Playback.js'
import {
  SpotifyCurrentPlayingResponse,
  SpotifyTrackItem,
  SpotifyEpisodeItem
} from '../../types/spotifyResponse'

async function getToken(discordToken: string, connectionId: string) {
  const res = await axios.get(
    `https://discord.com/api/v9/users/@me/connections/spotify/${connectionId}/access-token`,
    {
      headers: {
        Authorization: discordToken,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      },
      validateStatus: () => true
    }
  )

  if (res.status !== 200) {
    log(
      `Failed to get Spotify token from Discord API: ${res.status}`,
      'SpotifyFree',
      LogLevel.ERROR
    )
    throw new Error('Failed to fetch Spotify token from Discord API')
  }

  if (!res.data.access_token) {
    log(
      'No Spotify access token in Discord API response',
      'SpotifyFree',
      LogLevel.ERROR
    )
    throw new Error('No Spotify access token returned')
  }

  return res.data.access_token
}

async function subscribe(connectionId: string, token: string) {
  const res = await axios.put(
    'https://api.spotify.com/v1/me/notifications/player',
    null,
    {
      params: { connection_id: connectionId },
      headers: { Authorization: `Bearer ${token}` },
      validateStatus: () => true
    }
  )
  return res
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

  return { otp: totp.otp, timestamp }
}

async function getWebToken(sp_dc: string) {
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

export async function fetchImage(id: string) {
  const res = await axios.get(`https://i.scdn.co/image/${id}`, {
    responseType: 'arraybuffer'
  })
  return `data:image/jpeg;base64,${Buffer.from(res.data).toString('base64')}`
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
    const episode = data.item as SpotifyEpisodeItem
    return {
      isPlaying: is_playing,
      repeat: repeatStateMap[repeat_state],
      shuffle: shuffle_state,
      volume: device.volume_percent,
      track: {
        album: episode.show.name,
        artists: [episode.show.publisher],
        duration: { current: progress_ms, total: episode.duration_ms },
        name: episode.name
      },
      supportedActions: [
        ...defaultSupportedActions,
        ...((device.supports_volume ? ['volume'] : []) as Action[])
      ]
    }
  } else if (currently_playing_type === 'track') {
    const track = data.item as SpotifyTrackItem
    return {
      isPlaying: is_playing,
      repeat: repeatStateMap[repeat_state],
      shuffle: shuffle_state,
      volume: device.volume_percent,
      track: {
        album: track.album.name,
        artists: track.artists.map(a => a.name),
        duration: { current: progress_ms, total: track.duration_ms },
        name: track.name
      },
      supportedActions: [
        ...defaultSupportedActions,
        'repeat',
        'shuffle',
        'lyrics',
        ...((device.supports_volume ? ['volume'] : []) as Action[])
      ]
    }
  }
  return null
}

interface SpotifyConfig {
  discordToken?: string
  connectionId?: string
  sp_dc?: string
}

class SpotifyHandler extends BasePlaybackHandler {
  name: string = 'spotifyfree'
  config: SpotifyConfig | null = null
  accessToken: string | null = null
  webToken: string | null = null
  deviceId: string | null = null
  ws: WebSocket | null = null
  instance: AxiosInstance

  constructor() {
    super()

    this.instance = axios.create({
      baseURL: 'https://api.spotify.com/v1',
      validateStatus: () => true
    })

    this.instance.interceptors.request.use(config => {
      config.headers.Authorization = `Bearer ${this.accessToken}`
      if (this.config?.discordToken) {
        config.headers['X-Discord-Token'] = this.config.discordToken
      }
      if (this.deviceId && config.params) {
        config.params.device_id = this.deviceId
      }
      return config
    })

    this.instance.interceptors.response.use(async res => {
      if (res.status === 401) {
        log('Refreshing token...', 'SpotifyFree', LogLevel.INFO)
        if (this.config?.discordToken && this.config?.connectionId) {
          this.accessToken = await getToken(
            this.config.discordToken,
            this.config.connectionId
          )
        }
        if (!this.accessToken) return res
        return this.instance!(res.config)
      }
      if (res.status === 404) {
        log(
          `404 Not Found: ${res.config.url}`,
          'SpotifyFree',
          LogLevel.INFO
        )
      }
      return res
    })
  }

  async setup(config: SpotifyConfig): Promise<void> {
    log('Setting up SpotifyFree handler', 'SpotifyFree', LogLevel.INFO)
    this.config = config

    if (!this.config?.discordToken || !this.config?.connectionId) {
      throw new Error('Discord token and connection ID are required')
    }

    initializeLyricsCache()

    this.accessToken = await getToken(
      this.config.discordToken,
      this.config.connectionId
    ).catch(err => {
      log(
        `Token fetch error: ${err.message}`,
        'SpotifyFree',
        LogLevel.ERROR
      )
      this.emit('error', err)
      return null
    })

    if (!this.accessToken) throw new Error('Failed to obtain access token')

    if (this.config.sp_dc) {
      this.webToken = await getWebToken(this.config.sp_dc).catch(err => {
        log(
          `Error getting webToken: ${err.message}`,
          'SpotifyFree',
          LogLevel.WARN
        )
        return null
      })
    }

    this.ws = new WebSocket(
      `wss://dealer.spotify.com/?access_token=${encodeURIComponent(this.webToken || this.accessToken)}`
    )
    await this.start()
  }

  async start() {
    if (!this.ws) return
    const ping = () => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send('{"type":"ping"}')
      }
    }

    this.ws.on('open', () => {
      this.emit('open')
      ping()
      const interval = setInterval(() => {
        if (!this.ws) return clearInterval(interval)
        ping()
      }, 15000)
    })

    this.ws.on('message', async data => {
      const msg = JSON.parse(data.toString())
      if (msg.headers?.['Spotify-Connection-Id']) {
        const subscribeRes = await subscribe(
          msg.headers['Spotify-Connection-Id'],
          this.accessToken!
        )
        if (subscribeRes.status === 200 || subscribeRes.status === 204) {
          this.emit('ready', this.name)
        } else {
          log(
            `Subscription failed: ${subscribeRes.status}`,
            'SpotifyFree',
            LogLevel.ERROR
          )
          this.emit('error', new Error('Subscription failed'))
        }
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

    this.ws.on('close', (code, reason) => {
      log(
        `WebSocket closed: code ${code} ${reason}`,
        'SpotifyFree',
        LogLevel.WARN
      )
      this.emit('close')
    })

    this.ws.on('error', err => {
      log(`WebSocket error: ${err.message}`, 'SpotifyFree', LogLevel.ERROR)
      this.emit('error', err)
    })
  }

  async cleanup(): Promise<void> {
    log('Cleaning up SpotifyFree handler', 'SpotifyFree', LogLevel.INFO)
    cleanupLyricsCache()
    if (!this.ws) return
    this.ws.removeAllListeners()
    this.ws.close()
    this.ws = null
    this.removeAllListeners()
  }

  async validateConfig(config: SpotifyConfig): Promise<boolean> {
    if (config.discordToken && config.connectionId) {
      const token = await getToken(
        config.discordToken,
        config.connectionId
      ).catch(() => null)
      if (!token) return false
      return true
    }
    return false
  }

  async getCurrent(): Promise<SpotifyCurrentPlayingResponse | null> {
    const res = await this.instance.get('/me/player', {
      params: { additional_types: 'episode' }
    })
    if (!res.data || res.status !== 200) return null
    if (res.data.device && res.data.device.id)
      this.deviceId = res.data.device.id
    return res.data
  }

  async getPlayback(): Promise<PlaybackData | null> {
    const current = await this.getCurrent()
    if (!current) return null
    return filterData(current)
  }

  async play(): Promise<void> {
    await this.instance.put('/me/player/play')
  }

  async pause(): Promise<void> {
    await this.instance.put('/me/player/pause')
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
    await this.instance.post('/me/player/next')
  }

  async previous(): Promise<void> {
    await this.instance.post('/me/player/previous')
  }

  async shuffle(state: boolean): Promise<void> {
    await this.instance.put('/me/player/shuffle', null, {
      params: { state }
    })
  }

  async repeat(state: RepeatMode): Promise<void> {
    const map: Record<RepeatMode, string> = {
      off: 'off',
      on: 'context',
      one: 'track'
    }
    await this.instance.put('/me/player/repeat', null, {
      params: { state: map[state] }
    })
  }

  async getImage(): Promise<Buffer | null> {
    const current = await this.getCurrent()
    if (!current) return null

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
  }

  async getLyrics(): Promise<LyricsResponse | null> {
    const playbackData = await this.getPlayback()
    if (!playbackData) return null

    return getLyrics(playbackData)
  }
}

export const spotifyfree = new SpotifyHandler()
export default spotifyfree
