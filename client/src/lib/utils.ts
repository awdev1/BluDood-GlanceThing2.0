import axios from 'axios'

export function getClosestImage(
  covers: { url: string; width: number; height: number }[],
  width: number
) {
  const valid = covers.filter(cover => cover.width >= width)
  if (valid.length === 0) return covers[0]

  valid.sort((a, b) => a.width - b.width)

  return valid[0]
}

export async function getSocketPassword() {
  const res = await axios.get('./ws-password')
  return res.data.replace('\n', '')
}

export function isInterlude(words: string) {
  return !words.replace(/[♩♪♫♬]/g, '').trim()
}

const INTERLUDE_EXIT_MS = 1000

export function getInterludeRowState(
  index: number,
  currentIndex: number,
  ending: boolean
) {
  if (index > currentIndex) return 'upcoming'
  if (index < currentIndex || ending) return 'finished'
  return 'shown'
}

export function getInterludeTiming(
  lines: { words: string; startTimeMs: string }[],
  index: number,
  currentMs: number | undefined,
  offsetMs: number
) {
  const line = lines[index]
  if (!line || !isInterlude(line.words))
    return { progress: 0, ending: false }

  const start = parseInt(line.startTimeMs)
  const next = lines[index + 1]
  const end = next ? parseInt(next.startTimeMs) : start + 3000
  const now = (currentMs ?? start) + offsetMs

  return {
    progress: Math.min(
      Math.max(
        (now - start) / Math.max(end - start - INTERLUDE_EXIT_MS, 1),
        0
      ),
      1
    ),
    ending: end - now <= INTERLUDE_EXIT_MS
  }
}

const INTRO_THRESHOLD = 2000
const GAP_THRESHOLD = 6000
const MS_PER_WORD = 400
const MIN_LINE_MS = 1500
const MAX_LINE_MS = 6000

function estimateLineEnd(
  line: { words: string; startTimeMs: string; endTimeMs: string },
  nextStart: number
) {
  const start = parseInt(line.startTimeMs)
  const end = parseInt(line.endTimeMs)
  if (end > start && end < nextStart) return end

  const words = line.words.trim().split(/\s+/).length
  const sung = Math.min(
    Math.max(words * MS_PER_WORD, MIN_LINE_MS),
    MAX_LINE_MS
  )
  return start + sung
}

export function normalizeLyricLines<
  T extends { words: string; startTimeMs: string; endTimeMs: string }
>(lines: T[], synced: boolean) {
  const withGaps: T[] = []

  lines.forEach((line, i) => {
    withGaps.push(line)

    const next = lines[i + 1]
    if (!synced || !next || isInterlude(line.words)) return

    const nextStart = parseInt(next.startTimeMs)
    const end = estimateLineEnd(line, nextStart)
    if (nextStart - end < GAP_THRESHOLD) return

    withGaps.push({
      ...line,
      startTimeMs: String(end),
      endTimeMs: next.startTimeMs,
      words: ''
    })
  })

  const merged = withGaps.filter(
    (line, i) =>
      i === 0 ||
      !isInterlude(line.words) ||
      !isInterlude(withGaps[i - 1].words)
  )

  const first = merged[0]
  if (
    !synced ||
    !first ||
    isInterlude(first.words) ||
    parseInt(first.startTimeMs) < INTRO_THRESHOLD
  )
    return merged

  return [
    { ...first, startTimeMs: '0', endTimeMs: first.startTimeMs, words: '' },
    ...merged
  ]
}

export function formatTime(ms: number) {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  const remainingSeconds = seconds % 60

  if (hours > 0) {
    return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  return `${remainingMinutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

export const debounce = <
  T extends (...args: Parameters<T>) => ReturnType<T>
>(
  callback: T,
  delay: number
) => {
  let timeoutId: number | null = null

  const debouncedFn = (...args: Parameters<T>) => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId)
    }

    timeoutId = window.setTimeout(() => {
      callback(...args)
      timeoutId = null
    }, delay)
  }

  debouncedFn.cancel = () => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  return debouncedFn
}

export function getAverageColor(
  src: string
): Promise<{ r: number; g: number; b: number } | null> {
  return new Promise(resolve => {
    const img = new Image()

    img.onload = () => {
      const size = 16
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size

      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(null)

      ctx.drawImage(img, 0, 0, size, size)
      const { data } = ctx.getImageData(0, 0, size, size)

      let r = 0
      let g = 0
      let b = 0
      const pixels = data.length / 4

      for (let i = 0; i < data.length; i += 4) {
        r += data[i]
        g += data[i + 1]
        b += data[i + 2]
      }

      r /= pixels
      g /= pixels
      b /= pixels

      const brightest = Math.max(r, g, b)
      const scale = brightest > 0 && brightest < 140 ? 140 / brightest : 1

      resolve({
        r: Math.min(255, Math.round(r * scale)),
        g: Math.min(255, Math.round(g * scale)),
        b: Math.min(255, Math.round(b * scale))
      })
    }

    img.onerror = () => resolve(null)
    img.src = src
  })
}
