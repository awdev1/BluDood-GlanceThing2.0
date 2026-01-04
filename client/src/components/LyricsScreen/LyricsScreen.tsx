import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { MediaContext } from '@/contexts/MediaContext.tsx'
import styles from './LyricsScreen.module.css'
import { useSwipeGesture } from '@/lib/useGestures'

interface LyricsScreenProps {
    shown: boolean
    setShown: (shown: boolean) => void
}

const LyricsScreen: React.FC<LyricsScreenProps> = ({ shown, setShown }) => {
    const { lyricsData, lyricsLoading, lyricsCurrentLineIndex, playerData } =
        useContext(MediaContext)

    const [error, setError] = useState<string | null>(null)
    const [hasLyrics, setHasLyrics] = useState<boolean>(false)
    const [syncLyric, setSyncLyric] = useState<boolean>(false)
    const [closing, setClosing] = useState<boolean>(false)

    const containerRef = useRef<HTMLDivElement>(null)
    const lyricsContentRef = useRef<HTMLDivElement>(null)
    const activeLineRef = useRef<HTMLDivElement | null>(null)

    const [originalPrimary, setOriginalPrimary] = useState<string | null>(null)
    const [originalBg, setOriginalBg] = useState<string | null>(null)
    const [originalInactive, setOriginalInactive] = useState<string | null>(null)
    const [originalText, setOriginalText] = useState<string | null>(null)
    const hasInitializedColors = useRef(false)

    useEffect(() => {
        if (!hasInitializedColors.current) {
            const root = getComputedStyle(document.documentElement)
            const primary = root.getPropertyValue('--color-primary').trim()
            const bg = root.getPropertyValue('--lyrics-color-background').trim()
            const inactive = root.getPropertyValue('--lyrics-color-inactive').trim()
            const text = root.getPropertyValue('--lyrics-color-messaging').trim()
            
            if (primary) setOriginalPrimary(primary)
            if (bg) setOriginalBg(bg)
            if (inactive) setOriginalInactive(inactive)
            if (text) setOriginalText(text)
            
            hasInitializedColors.current = true
        }
    }, [])

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
                if (originalPrimary) document.documentElement.style.setProperty('--color-primary', originalPrimary)
                if (originalBg) document.documentElement.style.setProperty('--lyrics-color-background', originalBg)
                if (originalText) document.documentElement.style.setProperty('--lyrics-color-active', originalText)
                if (originalInactive) document.documentElement.style.setProperty('--lyrics-color-inactive', originalInactive)
                if (originalText) document.documentElement.style.setProperty('--lyrics-color-passed', originalText)
                if (originalInactive) document.documentElement.style.setProperty('--lyrics-color-messaging', originalInactive)
            } else {
                document.documentElement.style.setProperty('--color-primary', bg ?? originalPrimary ?? '')
                document.documentElement.style.setProperty('--lyrics-color-background', bg ?? originalBg ?? '')
                document.documentElement.style.setProperty('--lyrics-color-active', txt ?? originalText ?? '')
                document.documentElement.style.setProperty('--lyrics-color-inactive', inactive ?? originalInactive ?? '')
                document.documentElement.style.setProperty('--lyrics-color-passed', txt ?? originalText ?? '')
                document.documentElement.style.setProperty('--lyrics-color-messaging', inactive ?? originalText ?? '')
            }
        },
        [originalPrimary, originalBg, originalInactive, originalText]
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
            <button onClick={close} className={styles.closeBtn} aria-label="Close lyrics">
                <span className="material-icons">keyboard_arrow_down</span>
            </button>

            <div className={styles.content}>
                {playerData?.track && (
                    <header className={styles.header}>
                        <h1 className={styles.trackTitle}>{playerData.track.name}</h1>
                        <p className={styles.trackArtist}>
                            {playerData.track.artists?.join(', ') ?? ''}
                        </p>
                    </header>
                )}

                {error ? (
                    <div className={styles.message}>{error}</div>
                ) : lyricsLoading ? (
                    <div className={styles.message}>Loading lyrics…</div>
                ) : !hasLyrics ? (
                    <div className={styles.message}>No lyrics available.</div>
                ) : (
                    <div className={styles.lyricsContainer}>
                        <div className={styles.lyricsContent} ref={lyricsContentRef}>
                            <div
                                className={styles.paddingTop}
                                style={{ display: syncLyric ? 'block' : 'none' }}
                            />

                            {(lyricsData?.lyrics?.lines ?? []).map((line: { words: string }, i: number) => (
                                <div
                                    key={i}
                                    className={`${styles.line} ${i === lyricsCurrentLineIndex ? styles.active : ''
                                        } ${i < lyricsCurrentLineIndex ? styles.passed : ''}`}
                                    ref={el => {
                                        if (i === lyricsCurrentLineIndex) activeLineRef.current = el
                                    }}
                                >
                                    {line.words}
                                </div>
                            ))}

                            <div
                                className={styles.paddingBottom}
                                style={{ display: syncLyric ? 'block' : 'none' }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default LyricsScreen