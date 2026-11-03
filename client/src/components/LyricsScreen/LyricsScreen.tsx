import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { MediaContext } from '@/contexts/MediaContext.tsx'
import styles from './LyricsScreen.module.css'
import { useSwipeGesture } from '@/lib/useGestures'
import { formatTime, isInterlude } from '@/lib/utils'
import Marquee from '@/components/Marquee/Marquee'

interface LyricsScreenProps {
    shown: boolean
    setShown: (shown: boolean) => void
}

const LyricsScreen: React.FC<LyricsScreenProps> = ({ shown, setShown }) => {
    const { lyricsData, lyricsLoading, lyricsCurrentLineIndex, playerData, image } =
        useContext(MediaContext)

    const [error, setError] = useState<string | null>(null)
    const [hasLyrics, setHasLyrics] = useState<boolean>(false)
    const [syncLyric, setSyncLyric] = useState<boolean>(false)
    const [closing, setClosing] = useState<boolean>(false)

    const interludeProgress = (() => {
        const lines = lyricsData?.lyrics?.lines ?? []
        const line = lines[lyricsCurrentLineIndex]
        if (!line || !isInterlude(line.words)) return 0

        const start = parseInt(line.startTimeMs)
        const next = lines[lyricsCurrentLineIndex + 1]
        const end = next ? parseInt(next.startTimeMs) : start + 3000
        const now = (playerData?.track?.duration.current ?? start) + 1500

        return Math.min(Math.max((now - start) / Math.max(end - start, 1), 0), 1)
    })()

    const containerRef = useRef<HTMLDivElement>(null)
    const backCanvasRef = useRef<HTMLCanvasElement>(null)
    const frontCanvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvases = [backCanvasRef.current, frontCanvasRef.current]
        if (!image) {
            canvases.forEach(c => c?.getContext('2d')?.clearRect(0, 0, c.width, c.height))
            return
        }

        const img = new Image()
        img.onload = () => {
            canvases.forEach((canvas, layer) => {
                if (!canvas) return
                const size = 64
                canvas.width = size
                canvas.height = size
                const ctx = canvas.getContext('2d')
                if (!ctx) return

                ctx.clearRect(0, 0, size, size)
                ctx.filter = 'blur(6px) saturate(1.6)'

                const copies =
                    layer === 0
                        ? [
                            { x: 0.5, y: 0.5, scale: 1.4, angle: 0 },
                            { x: 0.2, y: 0.8, scale: 0.8, angle: 120 },
                            { x: 0.8, y: 0.2, scale: 0.7, angle: 240 }
                        ]
                        : [
                            { x: 0.25, y: 0.3, scale: 0.7, angle: 60 },
                            { x: 0.75, y: 0.75, scale: 0.8, angle: 180 }
                        ]

                copies.forEach(({ x, y, scale, angle }) => {
                    const w = size * scale
                    ctx.save()
                    ctx.translate(size * x, size * y)
                    ctx.rotate((angle * Math.PI) / 180)
                    ctx.drawImage(img, -w / 2, -w / 2, w, w)
                    ctx.restore()
                })
            })
        }
        img.src = image
    }, [image])
    const lyricsContentRef = useRef<HTMLDivElement>(null)
    const activeLineRef = useRef<HTMLDivElement | null>(null)

    const [originalBg, setOriginalBg] = useState<string | null>(null)
    const [originalInactive, setOriginalInactive] = useState<string | null>(null)
    const [originalText, setOriginalText] = useState<string | null>(null)
    const hasInitializedColors = useRef(false)

    useEffect(() => {
        if (!hasInitializedColors.current) {
            const root = getComputedStyle(document.documentElement)
            const bg = root.getPropertyValue('--lyrics-color-background').trim()
            const inactive = root.getPropertyValue('--lyrics-color-inactive').trim()
            const text = root.getPropertyValue('--lyrics-color-messaging').trim()
            
            if (bg) setOriginalBg(bg)
            if (inactive) setOriginalInactive(inactive)
            if (text) setOriginalText(text)
            
            hasInitializedColors.current = true
        }
    }, [])

    useEffect(() => {
        lyricsContentRef.current?.scrollTo({ top: 0 })
    }, [lyricsData])

    const scrollToActiveLine = useCallback(() => {
        if (!lyricsContentRef.current || !activeLineRef.current) return
        const container = lyricsContentRef.current
        const line = activeLineRef.current
        const containerHeight = container.clientHeight
        const lineHeight = line.clientHeight
        const lineTop = line.offsetTop
        const scrollTop = Math.max(0, lineTop - (containerHeight - lineHeight) / 2)
        container.scrollTo({ top: scrollTop, behavior: 'smooth' })
    }, [])

    useEffect(() => {
        if ((shown || closing) && syncLyric && lyricsCurrentLineIndex >= 0) {
            requestAnimationFrame(scrollToActiveLine)
        } else if (lyricsCurrentLineIndex === -1 && lyricsContentRef.current) {
            lyricsContentRef.current.scrollTo({ top: 0, behavior: 'smooth' })
        }
    }, [lyricsCurrentLineIndex, syncLyric, shown, closing, scrollToActiveLine])

    const setColors = useCallback(
        (bg?: string, txt?: string, inactive?: string) => {
            if (bg === undefined && txt === undefined && inactive === undefined) {
                if (originalBg) document.documentElement.style.setProperty('--lyrics-color-background', originalBg)
                if (originalText) document.documentElement.style.setProperty('--lyrics-color-active', originalText)
                if (originalInactive) document.documentElement.style.setProperty('--lyrics-color-inactive', originalInactive)
                if (originalText) document.documentElement.style.setProperty('--lyrics-color-passed', originalText)
                if (originalInactive) document.documentElement.style.setProperty('--lyrics-color-messaging', originalInactive)
            } else {
                document.documentElement.style.setProperty('--lyrics-color-background', bg ?? originalBg ?? '')
                document.documentElement.style.setProperty('--lyrics-color-active', txt ?? originalText ?? '')
                document.documentElement.style.setProperty('--lyrics-color-inactive', inactive ?? originalInactive ?? '')
                document.documentElement.style.setProperty('--lyrics-color-passed', txt ?? originalText ?? '')
                document.documentElement.style.setProperty('--lyrics-color-messaging', inactive ?? originalText ?? '')
            }
        },
        [originalBg, originalInactive, originalText]
    )

    useEffect(() => {
        if (!lyricsData) {
            setHasLyrics(false)
            setSyncLyric(false)
            setError(null)
            setColors()
            return
        }

        const lines = lyricsData.lyrics?.lines
        const hasLines = Array.isArray(lines) && lines.length > 0
        setHasLyrics(hasLines)
        setSyncLyric(lyricsData.lyrics?.syncType === 'LINE_SYNCED')
        setError(lyricsData.message ?? null)

        if (hasLines && lyricsData.colors?.background) {
            try {
                const { r = 0, g = 0, b = 0 } = lyricsData.colors.background
                const bg = `rgb(${r},${g},${b})`
                const brightness = (r * 299 + g * 587 + b * 114) / 1000
                const txt = brightness > 128 ? 'rgb(0,0,0)' : 'rgb(255,255,255)'
                const inactive =
                    brightness > 128
                        ? 'rgb(255,255,255)'
                        : `rgb(${Math.min(255, r + 140)},${Math.min(255, g + 140)},${Math.min(255, b + 140)})`
                setColors(bg, txt, inactive)
            } catch (e) {
                console.error('Lyrics colour error:', e)
            }
        } else {
            setColors()
        }
    }, [lyricsData, setColors])

    useEffect(() => {
        if (!shown && !closing) {
            setClosing(true)
            const timeout = setTimeout(() => {
                setClosing(false)
                // Only restore colors after closing animation completes
                setColors()
            }, 300)
            return () => clearTimeout(timeout)
        }
    }, [shown, closing, setColors])

    useEffect(() => {
        if (shown && containerRef.current) {
            containerRef.current.focus()
        }
    }, [shown])

    const close = useCallback(() => {
        setShown(false)
    }, [setShown])

    const bind = useSwipeGesture({
        onSwipeDown: () => {
            close()
        }
    }, {
        threshold: 60,
        velocity: 0.4,
        enabled: shown
    })

    if (!shown && !closing && !hasLyrics) return null

    return (
        <div
            className={`${styles.lyricsScreen} ${shown ? styles.shown : closing ? styles.closing : ''
                }`}
            ref={containerRef}
            tabIndex={0}
            aria-hidden={!shown && !closing}
            {...bind()}
        >
            <button onClick={close} className={styles.close} aria-label="Close lyrics">
                <span className="material-icons">keyboard_arrow_down</span>
            </button>

            <div className={styles.background}>
                <canvas ref={backCanvasRef} className={styles.back} />
                <canvas ref={frontCanvasRef} className={styles.front} />
            </div>

            <div className={styles.content}>
                {playerData?.track && (
                    <div className={styles.side}>
                        <div className={styles.cover}>
                            {image ? (
                                <img src={image} alt="" />
                            ) : (
                                <span className="material-icons">music_note</span>
                            )}
                        </div>
                        <div className={styles.progress}>
                            <span>{formatTime(playerData.track.duration.current)}</span>
                            <div className={styles.bar}>
                                <div
                                    style={{
                                        width: `${(playerData.track.duration.current /
                                            playerData.track.duration.total) *
                                            100
                                            }%`
                                    }}
                                />
                            </div>
                            <span>{formatTime(playerData.track.duration.total)}</span>
                        </div>
                        <Marquee className={styles.trackTitle}>
                            {playerData.track.name}
                        </Marquee>
                        <Marquee className={styles.trackArtist}>
                            {playerData.track.artists?.join(', ') ?? ''}
                        </Marquee>
                    </div>
                )}

                {error ? (
                    <div className={styles.message}>{error}</div>
                ) : lyricsLoading ? (
                    <div className={styles.message}>Loading lyrics…</div>
                ) : !hasLyrics ? (
                    <div className={styles.message}>No lyrics available.</div>
                ) : (
                    <div className={styles.lyricsContent} ref={lyricsContentRef}>
                        {syncLyric && <div className={styles.spacer} />}

                        {(lyricsData?.lyrics?.lines ?? []).map((line: { words: string }, i: number) => {
                            return (
                                <div
                                    key={i}
                                    className={`${styles.line} ${i === lyricsCurrentLineIndex ? styles.active : ''
                                        } ${i < lyricsCurrentLineIndex ? styles.passed : ''}`}
                                    ref={el => {
                                        if (i === lyricsCurrentLineIndex) activeLineRef.current = el
                                    }}
                                >
                                    {isInterlude(line.words) ? (
                                        <div
                                            className={styles.dots}
                                            data-playing={
                                                i === lyricsCurrentLineIndex &&
                                                !!playerData?.isPlaying
                                            }
                                        >
                                            {[0, 1, 2].map(d => (
                                                <span
                                                    key={d}
                                                    style={
                                                        i === lyricsCurrentLineIndex
                                                            ? {
                                                                opacity:
                                                                    0.3 +
                                                                    0.7 *
                                                                    Math.min(
                                                                        Math.max(interludeProgress * 3 - d, 0),
                                                                        1
                                                                    )
                                                            }
                                                            : undefined
                                                    }
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        line.words
                                    )}
                                </div>
                            )
                        })}

                        {syncLyric && <div className={styles.spacer} />}
                    </div>
                )}
            </div>
        </div>
    )
}

export default LyricsScreen