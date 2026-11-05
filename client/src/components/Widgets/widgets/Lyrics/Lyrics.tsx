import React, {
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
  KeyboardEvent
} from 'react'
import { MediaContext } from '@/contexts/MediaContext.tsx'
import BaseWidget from '../BaseWidget/BaseWidget'
import {
  getInterludeRowState,
  getInterludeTiming,
  isInterlude
} from '@/lib/utils'
import InterludeDots from '@/components/InterludeDots/InterludeDots'
import LyricText from '@/components/LyricText/LyricText'
import CoverBackground from '@/components/CoverBackground/CoverBackground'

import styles from './Lyrics.module.css'

const LINE_PADDING = 8

interface LyricsProps {
  visible: boolean
  sectionActive: boolean
}

const DOUBLE_TAP_DELAY = 300

const Lyrics: React.FC<LyricsProps> = ({ visible, sectionActive }) => {
  const {
    lyricsData,
    lyricsLoading,
    lyricsCurrentLineIndex,
    setLyricsScreenShown,
    lyricsScreenShown,
    playerData,
    image
  } = useContext(MediaContext)

  const [error, setError] = useState<string | null>(null)
  const [hasLyrics, setHasLyrics] = useState<boolean>(false)
  const [syncLyric, setSyncLyric] = useState<boolean>(false)

  const lyricsContentRef = useRef<HTMLDivElement>(null)
  const activeLineRef = useRef<HTMLDivElement | null>(null)
  const tapCount = useRef(0)
  const tapTimer = useRef<NodeJS.Timeout | null>(null)

  const [originalBgColor, setOriginalBgColor] = useState<string | null>(null)
  const [originalInactiveColor, setOriginalInactiveColor] = useState<string | null>(null)
  const [originalTextColor, setOriginalTextColor] = useState<string | null>(null)

  useEffect(() => {
    const style = getComputedStyle(document.documentElement)
    setOriginalBgColor(style.getPropertyValue('--lyrics-color-background'))
    setOriginalInactiveColor(style.getPropertyValue('--lyrics-color-inactive'))
    setOriginalTextColor(style.getPropertyValue('--lyrics-color-messaging'))
  }, [])

  useEffect(() => {
    lyricsContentRef.current?.scrollTo({ top: 0 })
  }, [lyricsData])

  const scrollToActiveLine = useCallback(() => {
    if (!visible || !activeLineRef.current || !lyricsContentRef.current) return
    const container = lyricsContentRef.current
    const line = activeLineRef.current
    const collapsing = Array.from(
      container.querySelectorAll<HTMLElement>(`.${styles.finished}`)
    )
      .filter(row => row.offsetTop < line.offsetTop)
      .reduce((total, row) => total + row.offsetHeight, 0)
    const lineHeight = line.classList.contains(styles.interlude)
      ? line.scrollHeight + LINE_PADDING * 2
      : line.clientHeight
    const top =
      line.offsetTop - collapsing - container.clientHeight / 2 + lineHeight / 2
    container.scrollTo({ top, behavior: 'smooth' })
  }, [visible])

  useEffect(() => {
    if (visible && sectionActive && syncLyric && lyricsCurrentLineIndex >= 0) {
      requestAnimationFrame(scrollToActiveLine)
    }
  }, [lyricsCurrentLineIndex, syncLyric, visible, sectionActive, scrollToActiveLine])

  const setColors = useCallback(
    (bg?: string, txt?: string, inactive?: string) => {
      document.documentElement.style.setProperty('--lyrics-color-background', bg ?? originalBgColor ?? '')
      document.documentElement.style.setProperty('--lyrics-color-active', txt ?? originalTextColor ?? '')
      document.documentElement.style.setProperty('--lyrics-color-inactive', inactive ?? originalInactiveColor ?? '')
      document.documentElement.style.setProperty('--lyrics-color-passed', txt ?? originalTextColor ?? '')
      document.documentElement.style.setProperty('--lyrics-color-messaging', inactive ?? originalTextColor ?? '')
    },
    [originalBgColor, originalInactiveColor, originalTextColor]
  )

  useEffect(() => {
    setSyncLyric(false)
    if (!lyricsData) {
      setHasLyrics(false)
      setError(null)
      setColors()
      return
    }

    const hasLines = !!lyricsData.lyrics?.lines?.length
    setHasLyrics(hasLines)
    setSyncLyric(lyricsData.lyrics?.syncType === 'LINE_SYNCED')
    setError(lyricsData.message || null)

    if (hasLines && lyricsData.colors?.background) {
      const { r = 0, g = 0, b = 0 } = lyricsData.colors.background
      const bg = `rgb(${r},${g},${b})`
      const brightness = (r * 299 + g * 587 + b * 114) / 1000
      const txt = brightness > 128 ? 'rgb(0,0,0)' : 'rgb(255,255,255)'
      const inactive = brightness > 128
        ? 'rgb(255,255,255)'
        : `rgb(${Math.min(255, r + 140)},${Math.min(255, g + 140)},${Math.min(255, b + 140)})`
      setColors(bg, txt, inactive)
    } else {
      setColors()
    }
  }, [lyricsData, setColors])

  const handleInteraction = useCallback(() => {
    tapCount.current += 1

    if (tapCount.current === 1) {
      tapTimer.current = setTimeout(() => {
        tapCount.current = 0
      }, DOUBLE_TAP_DELAY)
    } else if (tapCount.current === 2) {
      if (tapTimer.current) clearTimeout(tapTimer.current)
      tapCount.current = 0
      if (hasLyrics && setLyricsScreenShown) {
        setLyricsScreenShown(true)
      }
    }
  }, [hasLyrics, setLyricsScreenShown])

  useEffect(() => {
    return () => {
      if (tapTimer.current) clearTimeout(tapTimer.current)
    }
  }, [])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (!visible || !sectionActive) return
    if (e.key.toLowerCase() === 'l' && hasLyrics) {
      e.preventDefault()
      setLyricsScreenShown(true)
    }
  }, [visible, sectionActive, hasLyrics, setLyricsScreenShown])

  const renderLyrics = () => {
    if (!visible || !hasLyrics || !lyricsData?.lyrics?.lines) {
      return <div className={styles.emptyLyrics}></div>
    }

    const interlude = getInterludeTiming(
      lyricsData.lyrics.lines,
      lyricsCurrentLineIndex,
      playerData?.track?.duration.current
    )

    return (
      <div
        className={styles.lyricsContent}
        ref={lyricsContentRef}
        onClick={handleInteraction}
        onTouchEnd={handleInteraction}
        style={{ cursor: hasLyrics ? 'pointer' : 'default' }}
      >
        <div
          className={styles.lyricsTopPadding}
          style={{ display: syncLyric ? 'block' : 'none' }}
        />
        {lyricsData.lyrics.lines.map((line, index) => (
          <div
            key={index}
            className={`${styles.line} ${
              index === lyricsCurrentLineIndex ? styles.activeLine : ''
            } ${index < lyricsCurrentLineIndex ? styles.passedLine : ''} ${
              isInterlude(line.words)
                ? `${styles.interlude} ${
                    styles[
                      getInterludeRowState(
                        index,
                        lyricsCurrentLineIndex,
                        interlude.ending
                      )
                    ]
                  }`
                : ''
            }`}
            ref={index === lyricsCurrentLineIndex ? activeLineRef : null}
          >
            <div className={styles.lineContent}>
              {isInterlude(line.words) ? (
                <InterludeDots
                  className={styles.dots}
                  active={index === lyricsCurrentLineIndex}
                  finished={
                    getInterludeRowState(
                      index,
                      lyricsCurrentLineIndex,
                      interlude.ending
                    ) === 'finished'
                  }
                  playing={!!playerData?.isPlaying}
                  progress={interlude.progress}
                />
              ) : (
                <LyricText words={line.words} />
              )}
            </div>
          </div>
        ))}
        <div
          className={styles.lyricsBottomPadding}
          style={{ display: syncLyric ? 'block' : 'none' }}
        />
      </div>
    )
  }

  const renderContent = () => {
    if (!visible) return null

    if (error) {
      return (
        <div className={styles.error}>
          <div className={styles.errorMessage}>{error}</div>
        </div>
      )
    }

    if (lyricsLoading) {
      return <div className={styles.loading}>Loading lyrics...</div>
    }

    if (hasLyrics) {
      return (
        <div className={styles.lyricsContainer}>
          {renderLyrics()}
        </div>
      )
    }

    return <div className={styles.loading}>Waiting for track...</div>
  }

  return (
    <BaseWidget className={styles.lyricsWidget} visible={visible}>
      <div
        className={styles.lyricsWidgetContainer}
        tabIndex={0}
        autoFocus
        onKeyDown={handleKeyDown}
      >
        {visible && (
          <CoverBackground
            image={image}
            running={!lyricsScreenShown && !!playerData?.isPlaying}
          />
        )}
        {renderContent()}
      </div>
    </BaseWidget>
  )
}

export { Lyrics }
export type { LyricsProps }
export default Lyrics