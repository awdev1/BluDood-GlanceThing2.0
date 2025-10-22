import axios from 'axios'
import { log, LogLevel } from './utils.js'
import { LyricsResponse, PlaybackData } from '../types/Playback.js'
import { Cache } from './cache.js'

export const lyricsCache = new Cache<LyricsResponse>(
  24 * 60 * 60 * 1000,
  'global_lyrics_cache',
  'lyrics'
)

let cacheCleanupInterval: NodeJS.Timeout | null = null

export function initializeLyricsCache(): void {
  lyricsCache.load()
  if (!cacheCleanupInterval) {
    cacheCleanupInterval = setInterval(
      () => {
        lyricsCache.clean()
        lyricsCache.save()
      },
      60 * 60 * 1000
    )
  }
}

export function cleanupLyricsCache(): void {
  lyricsCache.save()
  lyricsCache.clear()
  if (cacheCleanupInterval) {
    clearInterval(cacheCleanupInterval)
    cacheCleanupInterval = null
  }
}

function parseLrcLyrics(lrc: string): {
  lines: {
    startTimeMs: string
    endTimeMs: string
    words: string
    syllables?: { startTimeMs: string; endTimeMs: string; text: string }[]
  }[]
} {
  const lines: {
    startTimeMs: string
    endTimeMs: string
    words: string
    syllables?: { startTimeMs: string; endTimeMs: string; text: string }[]
  }[] = []

  const lrcLines = lrc.split('\n').filter(line => line.trim())

  for (const line of lrcLines) {
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/)
    if (!match) continue

    const [, minutes, seconds, milliseconds, text] = match
    const startTimeMs =
      (parseInt(minutes) * 60 + parseInt(seconds)) * 1000 +
      parseInt(milliseconds.padEnd(3, '0'))

    lines.push({
      startTimeMs: startTimeMs.toString(),
      endTimeMs: '0',
      words: text.trim(),
      syllables: undefined // satisfy type
    })
  }

  lines.sort((a, b) => parseInt(a.startTimeMs) - parseInt(b.startTimeMs))

  for (let i = 0; i < lines.length - 1; i++) {
    lines[i].endTimeMs = lines[i + 1].startTimeMs
  }

  return { lines }
}

export async function getLyrics(
  current: PlaybackData
): Promise<LyricsResponse | null> {
  if (!current) return null

  const { id: trackId, name: title, artists, album } = current.track
  const artist = artists[0] || ''
  const now = Date.now()

  const cacheKey = trackId || `${artist}-${title}-${album}`
  try {
    const cachedLyrics = lyricsCache.get(cacheKey)
    if (
      cachedLyrics &&
      now - cachedLyrics.timestamp < lyricsCache.expirationAt()
    ) {
      log(
        `Using cached lyrics for track: ${cacheKey}`,
        'Lyrics',
        LogLevel.DEBUG
      )
      return cachedLyrics.data
    }

    log(
      `Fetching lyrics from lrclib for track: ${title} - ${artist}`,
      'Lyrics',
      LogLevel.INFO
    )
    const lrclibRes = await axios.get('https://lrclib.net/api/get', {
      params: {
        artist_name: artist,
        track_name: title,
        album_name: album
      },
      validateStatus: () => true
    })

    if (lrclibRes.status === 200 && lrclibRes.data.syncedLyrics) {
      const { lines } = parseLrcLyrics(lrclibRes.data.syncedLyrics)
      const lyricsResponse: LyricsResponse = {
        lyrics: {
          syncType: 'LINE_SYNCED',
          // @ts-ignore
          lines,
        },
        source: 'lrclib'
      }
      lyricsCache.set(cacheKey, lyricsResponse)
      return lyricsResponse
    }

    throw new Error('Lyrics not found')
  } catch (error) {
    log(`Error fetching lyrics: ${error}`, 'Lyrics', LogLevel.ERROR)
    const noLyricsMsg = 'No lyrics for this track'
    const noLyricsResponse: LyricsResponse = {
      message: noLyricsMsg,
      source: 'none'
    }
    lyricsCache.set(cacheKey, noLyricsResponse)
    return noLyricsResponse
  }
}
