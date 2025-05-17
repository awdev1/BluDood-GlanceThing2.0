import axios, { AxiosInstance } from 'axios';
import EventEmitter from 'events';
import { WebSocket } from 'ws';
import { TOTP } from 'totp-generator';

import { BasePlaybackHandler } from './BasePlaybackHandler.js';
import { log, LogLevel, intToRgb } from '../utils.js';
import { Action, PlaybackData, RepeatMode } from '../../types/Playback.js';
import { getStorageValue, setStorageValue } from '../storage.js';

async function getToken(discordToken: string, connectionId: string) {
  const res = await axios.get(
    `https://discord.com/api/v9/users/@me/connections/spotify/${connectionId}/access-token`,
    {
      headers: {
        Authorization: discordToken,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      },
      validateStatus: () => true
    }
  );

  if (res.status !== 200) {
    log(`Failed to get Spotify token from Discord API: ${res.status}`, 'SpotifyFree', LogLevel.ERROR);
    throw new Error('Failed to fetch Spotify token from Discord API');
  }

  if (!res.data.access_token) {
    log('No Spotify access token in Discord API response', 'SpotifyFree', LogLevel.ERROR);
    throw new Error('No Spotify access token returned');
  }

  return res.data.access_token;
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
  );
  return res;
}

function base32FromBytes(bytes: Uint8Array, secretSauce: string): string {
  let t = 0;
  let n = 0;
  let r = '';

  for (let i = 0; i < bytes.length; i++) {
    n = (n << 8) | bytes[i];
    t += 8;
    while (t >= 5) {
      r += secretSauce[(n >>> (t - 5)) & 31];
      t -= 5;
    }
  }

  if (t > 0) {
    r += secretSauce[(n << (5 - t)) & 31];
  }

  return r;
}

function cleanBuffer(e: string): Uint8Array {
  e = e.replace(' ', '');
  const buffer = new Uint8Array(e.length / 2);
  for (let i = 0; i < e.length; i += 2) {
    buffer[i / 2] = parseInt(e.substring(i, i + 2), 16);
  }
  return buffer;
}

async function generateTotp(): Promise<{ otp: string; timestamp: number }> {
  const secretSauce = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const secretCipherBytes = [12, 56, 76, 33, 88, 44, 88, 33, 78, 78, 11, 66, 22, 22, 55, 69, 54].map(
    (e, t) => e ^ ((t % 33) + 9)
  );
  const secretBytes = cleanBuffer(
    new TextEncoder()
      .encode(secretCipherBytes.join(''))
      .reduce((acc, val) => acc + val.toString(16).padStart(2, '0'), '')
  );
  const secret = base32FromBytes(secretBytes, secretSauce);

  const res = await axios.get('https://open.spotify.com/server-time');
  const timestamp = res.data.serverTime * 1000;
  const totp = TOTP.generate(secret, { timestamp });

  return { otp: totp.otp, timestamp };
}

async function getWebToken(sp_dc: string) {
  const totp = await generateTotp();
  const res = await axios.get('https://open.spotify.com/get_access_token', {
    headers: {
      cookie: `sp_dc=${sp_dc};`,
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    },
    params: {
      reason: 'init',
      productType: 'web-player',
      totp: totp.otp,
      totpVer: '5',
      ts: totp.timestamp
    },
    validateStatus: () => true
  });

  if (res.status !== 200) throw new Error('Invalid sp_dc');
  if (!res.data.accessToken) throw new Error('Invalid sp_dc');
  return res.data.accessToken;
}

export async function fetchImage(id: string) {
  const res = await axios.get(`https://i.scdn.co/image/${id}`, { responseType: 'arraybuffer' });
  return `data:image/jpeg;base64,${Buffer.from(res.data).toString('base64')}`;
}

interface SpotifyTrackItem {
  id: string;
  name: string;
  external_urls: { spotify: string };
  artists: { name: string; external_urls: { spotify: string } }[];
  album: { name: string; href: string; images: { url: string; width: number; height: number }[] };
  duration_ms: number;
}

interface SpotifyEpisodeItem {
  name: string;
  external_urls: { spotify: string };
  images: { url: string; width: number; height: number }[];
  show: {
    name: string;
    publisher: string;
    external_urls: { spotify: string };
    href: string;
    images: { url: string; width: number; height: number }[];
  };
  duration_ms: number;
}

export interface SpotifyCurrentPlayingResponse {
  device: {
    id: string;
    is_active: boolean;
    is_private_session: boolean;
    is_restricted: boolean;
    name: string;
    type: string;
    volume_percent: number;
    supports_volume: boolean;
  };
  repeat_state: string;
  shuffle_state: boolean;
  context: { external_urls: { spotify: string }; href: string; type: string; uri: string };
  timestamp: number;
  progress_ms: number;
  currently_playing_type: 'track' | 'episode';
  is_playing: boolean;
  item: SpotifyTrackItem | SpotifyEpisodeItem;
}

export interface LyricsResponse {
  lyrics?: {
    syncType: 'LINE_SYNCED' | 'WORD_SYNCED' | 'UNSYNCED';
    lines: {
      startTimeMs: string;
      endTimeMs?: string;
      words: string;
      syllables: {
        startTimeMs: string;
        endTimeMs: string;
        text: string;
      }[];
    }[];
  };
  colors?: {
    background: number;
    text: number;
    highlightText: number;
  };
  hasVocalRemoval?: boolean;
  message?: string;
  source?: 'lrclib' | 'spotify' | 'none';
}

// Parse LRC format and estimate word-level timings
function parseLrcLyrics(lrc: string): { lines: LyricsResponse['lyrics']['lines'] } {
  const lines: LyricsResponse['lyrics']['lines'] = [];
  const lrcLines = lrc.split('\n').filter(line => line.trim());

  for (const line of lrcLines) {
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
    if (!match) continue;

    const [, minutes, seconds, milliseconds, text] = match;
    const startTimeMs = (parseInt(minutes) * 60 + parseInt(seconds)) * 1000 + parseInt(milliseconds.padEnd(3, '0'));
    const words = text.trim().split(/\s+/).filter(word => word);
    const lineEntry: LyricsResponse['lyrics']['lines'][0] = {
      startTimeMs: startTimeMs.toString(),
      words: text.trim(),
      syllables: []
    };

    // Estimate word timings
    if (words.length > 0) {
      const nextLine = lrcLines[lrcLines.indexOf(line) + 1];
      let endTimeMs = startTimeMs + 2000; // Default 2s duration if no next line
      if (nextLine) {
        const nextMatch = nextLine.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\]/);
        if (nextMatch) {
          const [, nMinutes, nSeconds, nMilliseconds] = nextMatch;
          endTimeMs = (parseInt(nMinutes) * 60 + parseInt(nSeconds)) * 1000 + parseInt(nMilliseconds.padEnd(3, '0'));
        }
      }

      const lineDuration = endTimeMs - startTimeMs;
      const wordDuration = lineDuration / words.length;

      words.forEach((word, index) => {
        const wordStart = startTimeMs + index * wordDuration;
        const wordEnd = wordStart + wordDuration;
        lineEntry.syllables.push({
          startTimeMs: Math.round(wordStart).toString(),
          endTimeMs: Math.round(wordEnd).toString(),
          text: word
        });
      });

      lineEntry.endTimeMs = endTimeMs.toString();
    }

    lines.push(lineEntry);
  }

  // Sort lines by startTimeMs
  lines.sort((a, b) => parseInt(a.startTimeMs) - parseInt(b.startTimeMs));

  return { lines };
}

const defaultSupportedActions: Action[] = ['play', 'pause', 'next', 'previous', 'image'];

export function filterData(data: SpotifyCurrentPlayingResponse): PlaybackData | null {
  const { is_playing, item, progress_ms, currently_playing_type, device, repeat_state, shuffle_state } = data;
  if (!item) return null;

  const repeatStateMap: Record<string, RepeatMode> = { off: 'off', context: 'on', track: 'one' };

  if (currently_playing_type === 'episode') {
    const episode = data.item as SpotifyEpisodeItem;
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
      supportedActions: [...defaultSupportedActions, ...(device.supports_volume ? ['volume'] : []) as Action[]]
    };
  } else if (currently_playing_type === 'track') {
    const track = data.item as SpotifyTrackItem;
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
      supportedActions: [...defaultSupportedActions, 'repeat', 'shuffle', ...(device.supports_volume ? ['volume'] : []) as Action[]]
    };
  }
  return null;
}

interface SpotifyConfig {
  discordToken?: string;
  connectionId?: string;
  sp_dc?: string;
}

class SpotifyHandler extends BasePlaybackHandler {
  name: string = 'spotifyfree';
  config: SpotifyConfig | null = null;
  accessToken: string | null = null;
  webToken: string | null = null;
  deviceId: string | null = null;
  ws: WebSocket | null = null;
  instance: AxiosInstance;
  lyricsCache: Map<string, { data: LyricsResponse; timestamp: number }> = new Map();
  lyricsCacheExpiration: number = 24 * 60 * 60 * 1000; // 24 hours
  cacheCleanupInterval: NodeJS.Timeout | null = null;
  lyricsCacheStorageKey: string = 'spotifyfree_lyrics_cache';

  constructor() {
    super();
    this.instance = axios.create({
      baseURL: 'https://api.spotify.com/v1',
      validateStatus: () => true
    });

    this.instance.interceptors.request.use(config => {
      config.headers.Authorization = `Bearer ${this.accessToken}`;
      if (this.config?.discordToken) {
        config.headers['X-Discord-Token'] = this.config.discordToken;
      }
      if (this.deviceId && config.params) {
        config.params.device_id = this.deviceId;
      }
      return config;
    });

    this.instance.interceptors.response.use(async res => {
      if (res.status === 401) {
        log('Refreshing token...', 'SpotifyFree', LogLevel.INFO);
        if (this.config?.discordToken && this.config?.connectionId) {
          this.accessToken = await getToken(this.config.discordToken, this.config.connectionId);
        }
        if (!this.accessToken) return res;
        return this.instance!(res.config);
      }
      if (res.status === 404) {
        log(`404 Not Found: ${res.config.url}`, 'SpotifyFree', LogLevel.INFO);
      }
      return res;
    });

    this.loadLyricsCache();
  }

  async setup(config: SpotifyConfig): Promise<void> {
    log('Setting up SpotifyFree handler', 'SpotifyFree', LogLevel.INFO);
    this.config = config;

    if (!this.config?.discordToken || !this.config?.connectionId) {
      throw new Error('Discord token and connection ID are required');
    }

    this.accessToken = await getToken(this.config.discordToken, this.config.connectionId).catch(err => {
      log(`Token fetch error: ${err.message}`, 'SpotifyFree', LogLevel.ERROR);
      this.emit('error', err);
      return null;
    });

    if (!this.accessToken) throw new Error('Failed to obtain access token');

    if (this.config.sp_dc) {
      this.webToken = await getWebToken(this.config.sp_dc).catch(err => {
        log(`Error getting webToken: ${err.message}`, 'SpotifyFree', LogLevel.WARN);
        return null;
      });
    }

    this.ws = new WebSocket(`wss://dealer.spotify.com/?access_token=${encodeURIComponent(this.webToken || this.accessToken)}`);
    await this.start();

    this.cacheCleanupInterval = setInterval(() => {
      this.cleanLyricsCache();
      this.saveLyricsCache();
    }, 60 * 60 * 1000); // Every hour
  }

  async start() {
    if (!this.ws) return;
    const ping = () => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send('{"type":"ping"}');
      }
    };

    this.ws.on('open', () => {
      this.emit('open');
      ping();
      const interval = setInterval(() => {
        if (!this.ws) return clearInterval(interval);
        ping();
      }, 15000);
    });

    this.ws.on('message', async (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.headers?.['Spotify-Connection-Id']) {
        const subscribeRes = await subscribe(msg.headers['Spotify-Connection-Id'], this.accessToken!);
        if (subscribeRes.status === 200 || subscribeRes.status === 204) {
          this.emit('ready', this.name);
        } else {
          log(`Subscription failed: ${subscribeRes.status}`, 'SpotifyFree', LogLevel.ERROR);
          this.emit('error', new Error('Subscription failed'));
        }
        return;
      }
      const event = msg.payloads?.[0]?.events?.[0];
      if (!event) return;

      if (event.type === 'PLAYER_STATE_CHANGED') {
        const state = event.event.state;
        if (state.currently_playing_type === 'track') {
          this.emit('playback', filterData(state));
        } else if (state.currently_playing_type === 'episode') {
          const current = await this.getCurrent();
          if (!current) return;
          this.emit('playback', filterData(current));
        }
      } else if (event.type === 'DEVICE_STATE_CHANGED') {
        const devices = event.event.devices;
        if (devices.some(d => d.is_active)) return;
        this.emit('playback', null);
      }
    });

    this.ws.on('close', (code, reason) => {
      log(`WebSocket closed: code ${code}`, 'SpotifyFree', LogLevel.WARN);
      this.emit('close');
    });

    this.ws.on('error', (err) => {
      log(`WebSocket error: ${err.message}`, 'SpotifyFree', LogLevel.ERROR);
      this.emit('error', err);
    });
  }

  async cleanup(): Promise<void> {
    log('Cleaning up SpotifyFree handler', 'SpotifyFree', LogLevel.INFO);
    this.saveLyricsCache();
    this.lyricsCache.clear();
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      this.cacheCleanupInterval = null;
    }
    if (!this.ws) return;
    this.ws.removeAllListeners();
    this.ws.close();
    this.ws = null;
    this.removeAllListeners();
  }

  cleanLyricsCache(): void {
    const now = Date.now();
    let expiredCount = 0;
    for (const [trackId, entry] of this.lyricsCache.entries()) {
      if (now - entry.timestamp > this.lyricsCacheExpiration) {
        this.lyricsCache.delete(trackId);
        expiredCount++;
      }
    }
    log(
      `Cleaned lyrics cache. Removed ${expiredCount} expired entries. Current size: ${this.lyricsCache.size} entries`,
      'SpotifyFree',
      LogLevel.DEBUG
    );
  }

  saveLyricsCache(): void {
    try {
      const cacheEntries = Array.from(this.lyricsCache.entries());
      setStorageValue(this.lyricsCacheStorageKey, cacheEntries);
      log(`Saved lyrics cache with ${cacheEntries.length} entries`, 'SpotifyFree', LogLevel.DEBUG);
    } catch (error) {
      log(`Error saving lyrics cache: ${error}`, 'SpotifyFree', LogLevel.ERROR);
    }
  }

  loadLyricsCache(): void {
    try {
      const cachedData = getStorageValue(this.lyricsCacheStorageKey);
      if (cachedData && Array.isArray(cachedData)) {
        this.lyricsCache = new Map(cachedData);
        log(`Loaded lyrics cache with ${this.lyricsCache.size} entries`, 'SpotifyFree', LogLevel.DEBUG);
        this.cleanLyricsCache();
      } else {
        log(`No lyrics cache found or invalid format`, 'SpotifyFree', LogLevel.DEBUG);
      }
    } catch (error) {
      log(`Error loading lyrics cache: ${error}`, 'SpotifyFree', LogLevel.ERROR);
      this.lyricsCache = new Map();
    }
  }

  getLyricsCacheStats(): { size: number; avgAge: number } {
    const now = Date.now();
    let totalAge = 0;
    for (const entry of this.lyricsCache.values()) {
      totalAge += now - entry.timestamp;
    }
    const size = this.lyricsCache.size;
    const avgAge = size > 0 ? totalAge / size / 1000 : 0;
    return { size, avgAge };
  }

  async validateConfig(config: SpotifyConfig): Promise<boolean> {
    if (config.discordToken && config.connectionId) {
      const token = await getToken(config.discordToken, config.connectionId).catch(() => null);
      if (!token) return false;
      return true;
    }
    return false;
  }

  async getCurrent(): Promise<SpotifyCurrentPlayingResponse | null> {
    const res = await this.instance.get('/me/player', { params: { additional_types: 'episode' } });
    if (!res.data || res.status !== 200) return null;
    if (res.data.device && res.data.device.id) this.deviceId = res.data.device.id;
    return res.data;
  }

  async getPlayback(): Promise<PlaybackData | null> {
    const current = await this.getCurrent();
    if (!current) return null;
    return filterData(current);
  }

  async play(): Promise<void> {
    await this.instance.put('/me/player/play');
  }

  async pause(): Promise<void> {
    await this.instance.put('/me/player/pause');
  }

  async setVolume(volume: number): Promise<void> {
    await this.instance.put('/me/player/volume', null, { params: { volume_percent: volume } });
  }

  async next(): Promise<void> {
    await this.instance.post('/me/player/next');
  }

  async previous(): Promise<void> {
    await this.instance.post('/me/player/previous');
  }

  async shuffle(state: boolean): Promise<void> {
    await this.instance.put('/me/player/shuffle', null, { params: { state } });
  }

  async repeat(state: RepeatMode): Promise<void> {
    const map: Record<RepeatMode, string> = { off: 'off', on: 'context', one: 'track' };
    await this.instance.put('/me/player/repeat', null, { params: { state: map[state] } });
  }

  async getImage(): Promise<Buffer | null> {
    const current = await this.getCurrent();
    if (!current) return null;

    if (current.currently_playing_type === 'episode') {
      const item = current.item as SpotifyEpisodeItem;
      const imageRes = await axios.get(item.images[0].url, { responseType: 'arraybuffer' });
      return imageRes.data;
    } else if (current.currently_playing_type === 'track') {
      const item = current.item as SpotifyTrackItem;
      const imageRes = await axios.get(item.album.images[1].url, { responseType: 'arraybuffer' });
      return imageRes.data;
    }
    return null;
  }

  async getLyrics(): Promise<LyricsResponse | null> {
    const current = await this.getCurrent();
    if (!current) return null;
    if (current.currently_playing_type === 'episode') {
      return { message: 'Noclaiming lyrics for podcast', source: 'none' };
    }

    const item = current.item as SpotifyTrackItem;
    const trackId = item.id;
    const artist = item.artists[0]?.name || '';
    const title = item.name;
    const album = item.album.name;
    const now = Date.now();

    // Use trackId as cache key for consistency
    const cacheKey = trackId;
    try {
      const cachedLyrics = this.lyricsCache.get(cacheKey);
      if (cachedLyrics && now - cachedLyrics.timestamp < this.lyricsCacheExpiration) {
        log(`Using cached lyrics for track: ${trackId}`, 'SpotifyFree', LogLevel.DEBUG);
        return cachedLyrics.data;
      }

      // Try Spotify color-lyrics first if sp_dc is available
      if (this.config?.sp_dc) {
        log(`Fetching lyrics from Spotify for track: ${trackId}`, 'SpotifyFree', LogLevel.INFO);
        let url = `https://spclient.wg.spotify.com/color-lyrics/v2/track/${trackId}`;
        if (item.album.images[0]?.url) {
          url += `/image/${encodeURIComponent(item.album.images[0].url)}`;
        }
        url += '?format=json&vocalRemoval=false&market=from_token';

        const fetchSpotifyLyrics = async (): Promise<any> => {
          return await axios.get(url, {
            headers: {
              Authorization: `Bearer ${this.webToken || this.accessToken}`,
              'app-platform': 'WebPlayer'
            },
            validateStatus: () => true
          });
        };

        let res = await fetchSpotifyLyrics();

        if (res.status === 401 && this.config.sp_dc) {
          log('Received 401 error, refreshing webToken and retrying', 'SpotifyFree', LogLevel.WARN);
          try {
            this.webToken = await getWebToken(this.config.sp_dc);
            log('Successfully refreshed webToken', 'SpotifyFree', LogLevel.DEBUG);
            res = await fetchSpotifyLyrics();
          } catch (refreshError) {
            log(`Failed to refresh webToken: ${refreshError}`, 'SpotifyFree', LogLevel.ERROR);
            // Continue to LRCLIB instead of throwing
          }
        }

        if (res.status === 200 && res.data.lyrics) {
          const lines = res.data.lyrics.lines.map((line: any) => ({
            startTimeMs: line.startTimeMs,
            endTimeMs: line.endTimeMs,
            words: line.words,
            syllables: line.syllables?.map((s: any) => ({
              startTimeMs: s.startTimeMs,
              endTimeMs: s.endTimeMs,
              text: s.text
            })) || line.words.split(/\s+/).map((word: string, index: number, words: string[]) => {
              const wordDuration = (parseInt(line.endTimeMs || line.startTimeMs + 2000) - parseInt(line.startTimeMs)) / words.length;
              return {
                startTimeMs: (parseInt(line.startTimeMs) + index * wordDuration).toString(),
                endTimeMs: (parseInt(line.startTimeMs) + (index + 1) * wordDuration).toString(),
                text: word
              };
            })
          }));
          const lyricsResponse: LyricsResponse = {
            lyrics: {
              syncType: res.data.lyrics.syllables?.length ? 'WORD_SYNCED' : 'LINE_SYNCED',
              lines
            },
            colors: res.data.colors ? {
              background: intToRgb(res.data.colors.background) ?? 0,
              text: intToRgb(res.data.colors.text) ?? 0,
              highlightText: intToRgb(res.data.colors.highlightText) ?? 0
            } : undefined,
            hasVocalRemoval: res.data.hasVocalRemoval,
            source: 'spotify'
          };
          this.lyricsCache.set(cacheKey, { data: lyricsResponse, timestamp: now });
          this.saveLyricsCache();
          return lyricsResponse;
        }
      }

      // Fallback to LRCLIB
      log(`Fetching lyrics from LRCLIB for track: ${title} by ${artist}`, 'SpotifyFree', LogLevel.INFO);
      const lrclibRes = await axios.get('https://lrclib.net/api/get', {
        params: {
          artist_name: artist,
          track_name: title,
          album_name: album
        },
        validateStatus: () => true
      });

      if (lrclibRes.status === 200 && lrclibRes.data.syncedLyrics) {
        const { lines } = parseLrcLyrics(lrclibRes.data.syncedLyrics);
        const lyricsResponse: LyricsResponse = {
          lyrics: {
            syncType: 'WORD_SYNCED',
            lines
          },
          source: 'lrclib'
        };
        this.lyricsCache.set(cacheKey, { data: lyricsResponse, timestamp: now });
        this.saveLyricsCache();
        return lyricsResponse;
      }

      throw new Error('Lyrics not found');
    } catch (error) {
      log(`Error fetching lyrics: ${error}`, 'SpotifyFree', LogLevel.ERROR);
      const noLyricsMsg = 'No lyrics for this track';
      const noLyricsResponse: LyricsResponse = { message: noLyricsMsg, source: 'none' };
      this.lyricsCache.set(cacheKey, { data: noLyricsResponse, timestamp: now });
      this.saveLyricsCache();
      return noLyricsResponse;
    }
  }
}

export const spotifyfree = new SpotifyHandler();
export default spotifyfree;