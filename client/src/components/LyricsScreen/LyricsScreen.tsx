import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { MediaContext } from '@/contexts/MediaContext.tsx'
import styles from './LyricsScreen.module.css'
import {
    formatTime,
    getInterludeRowState,
    getInterludeTiming,
    isInterlude
} from '@/lib/utils'
import Marquee from '@/components/Marquee/Marquee'
import CoverBackground from '@/components/CoverBackground/CoverBackground'
import SwipeHandle from '@/components/SwipeHandle/SwipeHandle'
import InterludeDots from '@/components/InterludeDots/InterludeDots'
import LyricText from '@/components/LyricText/LyricText'

const LINE_PADDING = 11

interface LyricsScreenProps {
    shown: boolean
    setShown: (shown: boolean) => void
}

const LyricsScreen: React.FC<LyricsScreenProps> = ({ shown, setShown }) => {
    const { lyricsData, lyricsLoading, lyricsCurrentLineIndex, playerData, image, actions } =
        useContext(MediaContext)

    const manualScrollUntil = useRef(0)
    const touchStart = useRef<{ x: number; y: number; time: number } | null>(null)
    const lastTouchTap = useRef(0)
    const canSeek = !!playerData?.supportedActions?.includes('seek')

    const [error, setError] = useState<string | null>(null)
    const [hasLyrics, setHasLyrics] = useState<boolean>(false)
    const [syncLyric, setSyncLyric] = useState<boolean>(false)
    const [closing, setClosing] = useState<boolean>(false)

    const interlude = getInterludeTiming(
        lyricsData?.lyrics?.lines ?? [],
        lyricsCurrentLineIndex,
        playerData?.track?.duration.current
    )

    const containerRef = useRef<HTMLDivElement>(null)
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
        if (Date.now() < manualScrollUntil.current) return
        if (!lyricsContentRef.current || !activeLineRef.current) return
        const container = lyricsContentRef.current
        const line = activeLineRef.current
        const containerHeight = container.clientHeight
        const lineHeight = line.classList.contains(styles.interlude)
            ? line.scrollHeight + LINE_PADDING * 2
            : line.clientHeight
        const collapsing = Array.from(
            container.querySelectorAll<HTMLElement>(`.${styles.finished}`)
        )
            .filter(row => row.offsetTop < line.offsetTop)
            .reduce((total, row) => total + row.offsetHeight, 0)
        const lineTop = line.offsetTop - collapsing
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


    function scrollManually(direction: number) {
        manualScrollUntil.current = Date.now() + 4000
        lyricsContentRef.current?.scrollBy({ top: direction * 80 })
    }

    function onWheel(e: React.WheelEvent<HTMLDivElement>) {
        const delta = e.deltaX || e.deltaY
        if (!delta) return
        e.stopPropagation()
        scrollManually(Math.sign(delta))
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
        e.preventDefault()
        e.stopPropagation()
        scrollManually(e.key === 'ArrowLeft' ? -1 : 1)
    }

    function seekToLine(line: { startTimeMs: string }) {
        if (!canSeek || !syncLyric) return
        manualScrollUntil.current = 0
        actions.seek(parseInt(line.startTimeMs))
    }

    if (!shown && !closing && !hasLyrics) return null

    return (
        <div
            className={`${styles.lyricsScreen} ${shown ? styles.shown : closing ? styles.closing : ''
                }`}
            ref={containerRef}
            tabIndex={0}
            aria-hidden={!shown && !closing}
            onWheel={onWheel}
            onKeyDown={onKeyDown}
        >
            <SwipeHandle onClose={close} enabled={shown} />

            <CoverBackground image={image} running={shown} />

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
                    <div
                        className={styles.lyricsContent}
                        ref={lyricsContentRef}
                        onTouchStart={e => {
                            const t = e.touches[0]
                            touchStart.current = { x: t.clientX, y: t.clientY, time: Date.now() }
                        }}
                        onTouchMove={e => {
                            const start = touchStart.current
                            const t = e.touches[0]
                            if (
                                start &&
                                Math.abs(t.clientX - start.x) + Math.abs(t.clientY - start.y) > 10
                            ) {
                                touchStart.current = null
                                manualScrollUntil.current = Date.now() + 4000
                            }
                        }}
                    >
                        {syncLyric && <div className={styles.spacer} />}

                        {(lyricsData?.lyrics?.lines ?? []).map((line, i) => {
                            return (
                                <div
                                    key={i}
                                    onTouchEnd={() => {
                                        const start = touchStart.current
                                        touchStart.current = null
                                        if (!start || Date.now() - start.time > 500) return
                                        lastTouchTap.current = Date.now()
                                        seekToLine(line)
                                    }}
                                    onClick={() => {
                                        if (Date.now() - lastTouchTap.current < 800) return
                                        seekToLine(line)
                                    }}
                                    className={`${styles.line} ${i === lyricsCurrentLineIndex ? styles.active : ''
                                        } ${i < lyricsCurrentLineIndex ? styles.passed : ''} ${isInterlude(line.words) ? `${styles.interlude} ${styles[getInterludeRowState(i, lyricsCurrentLineIndex, interlude.ending)]}` : ''}`}
                                    ref={el => {
                                        if (i === lyricsCurrentLineIndex) activeLineRef.current = el
                                    }}
                                >
                                    {isInterlude(line.words) ? (
                                        <InterludeDots
                                            active={i === lyricsCurrentLineIndex}
                                            playing={!!playerData?.isPlaying}
                                            progress={interlude.progress}
                                            finished={getInterludeRowState(i, lyricsCurrentLineIndex, interlude.ending) === 'finished'}
                                            className={styles.dots}
                                        />
                                    ) : (
                                        <LyricText words={line.words} />
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