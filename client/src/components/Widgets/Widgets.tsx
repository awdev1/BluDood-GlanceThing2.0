import {
  useContext,
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback
} from 'react'
import { AppStateContext } from '@/contexts/AppStateContext.tsx'
import { MediaContext } from '@/contexts/MediaContext.tsx'

import Controls from './widgets/Controls/Controls.tsx'
import Player from './widgets/Player/Player.tsx'
import Apps from './widgets/Apps/Apps.tsx'
import Time from './widgets/Time/Time.tsx'
import Weather from './widgets/Weather/Weather.tsx'
import Lyrics from './widgets/Lyrics/Lyrics.tsx'

import styles from './Widgets.module.css'

interface SectionContent {
  components: React.ReactNode[]
}

const Widgets: React.FC = () => {
  const {
    showTimeWidget,
    showWeatherWidget,
    showAppsWidget,
    showControlsWidget,
    showLyricsWidget,
    showStatusBar,
    autoSwitchToLyrics
  } = useContext(AppStateContext)
  const { playerData, lyricsData } = useContext(MediaContext)
  const widgetsRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const paginationRef = useRef<HTMLDivElement>(null)
  const [timeVisible, setTimeVisible] = useState(false)
  const [weatherVisible, setWeatherVisible] = useState(false)
  const [appsVisible, setAppsVisible] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(false)
  const [lyricsVisible, setLyricsVisible] = useState(false)
  const [activeSection, setActiveSection] = useState(1)
  const [isUserInteracting, setIsUserInteracting] = useState(false)
  const userInteractionTimer = useRef<ReturnType<
    typeof setTimeout
  > | null>(null)
  const lyricsCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const autoSwitchEnabled = useRef(false)
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null)
  const hasAutoSwitchedForTrack = useRef<string | null>(null)
  const isTrackChanging = useRef(false)

  useEffect(() => {
    autoSwitchEnabled.current = autoSwitchToLyrics
  }, [autoSwitchToLyrics])

  const touchStartX = useRef<number | null>(null)
  const touchMoveX = useRef<number | null>(null)
  const SWIPE_THRESHOLD = 50 // Minimum distance to consider a swipe

  const markUserInteracting = useCallback((duration = 2000) => {
    setIsUserInteracting(true)

    if (userInteractionTimer.current) {
      clearTimeout(userInteractionTimer.current)
    }

    userInteractionTimer.current = setTimeout(() => {
      setIsUserInteracting(false)
      userInteractionTimer.current = null
    }, duration)
  }, [])

  useEffect(() => {
    setTimeVisible(showTimeWidget)
    setWeatherVisible(showWeatherWidget)
    setAppsVisible(showAppsWidget)
    setControlsVisible(showControlsWidget)
    const supportLyrics =
      playerData?.supportedActions.includes('lyrics') ?? false
    setLyricsVisible(showLyricsWidget && supportLyrics)
  }, [
    showTimeWidget,
    showWeatherWidget,
    showAppsWidget,
    showControlsWidget,
    showLyricsWidget,
    playerData?.supportedActions
  ])

  const sectionsList = useMemo(() => {
    const list: SectionContent[] = []

    if (timeVisible || weatherVisible) {
      list.push({
        components: [
          <Time key="time" visible={timeVisible} />,
          <Weather key="weather" visible={weatherVisible} />
        ]
      })
    }

    if (appsVisible || controlsVisible) {
      list.push({
        components: [
          <Apps key="apps" visible={appsVisible} />,
          <Controls key="controls" visible={controlsVisible} />
        ]
      })
    }

    if (lyricsVisible) {
      list.push({
        components: [
          <Lyrics
            key="lyrics"
            visible={lyricsVisible}
            sectionActive={false}
          />
        ]
      })
    }

    return list
  }, [
    timeVisible,
    weatherVisible,
    appsVisible,
    controlsVisible,
    lyricsVisible
  ])

  const lyricsIndex = useMemo(() => {
    if (!lyricsVisible) return -1
    return sectionsList.length - 1
  }, [sectionsList.length, lyricsVisible])

  const handlePaginationClick = useCallback(
    (sectionIndex: number, isAutoSwitch = false) => {
      if (sectionIndex < 0 || sectionIndex >= sectionsList.length) {
        return
      }

      if (!isAutoSwitch) {
        markUserInteracting()
      }

      setActiveSection(sectionIndex + 1)
    },
    [sectionsList.length, markUserInteracting]
  )

  const handlePaginationButtonClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()

      const target = e.target as HTMLElement
      const indexStr = target.getAttribute('data-index')
      if (indexStr) {
        const index = parseInt(indexStr, 10)
        handlePaginationClick(index)
      }
    },
    [handlePaginationClick]
  )

  const shouldAutoSwitchToLyrics = useCallback(() => {
    if (!autoSwitchEnabled.current) return false
    if (!showLyricsWidget) return false
    if (isUserInteracting) return false
    if (lyricsIndex === -1) return false
    if (activeSection === lyricsIndex + 1) return false
    const currentTrack = playerData?.track?.id ?? null
    if (!currentTrack) return false
    if (hasAutoSwitchedForTrack.current === currentTrack) return false
    if (!lyricsData?.lyrics?.lines || lyricsData.lyrics.lines.length === 0)
      return false
    return true
  }, [
    showLyricsWidget,
    isUserInteracting,
    lyricsIndex,
    activeSection,
    playerData,
    lyricsData
  ])

  useEffect(() => {
    const newTrackId = playerData?.track?.id ?? null
    if (currentTrackId === newTrackId) return
    isTrackChanging.current = true
    setCurrentTrackId(newTrackId)
    hasAutoSwitchedForTrack.current = null
    if (!newTrackId) {
      isTrackChanging.current = false
      return
    }
    if (lyricsData?.lyrics?.lines && lyricsData.lyrics.lines.length > 0) {
      const shouldSwitch = shouldAutoSwitchToLyrics()

      if (shouldSwitch && lyricsIndex >= 0) {
        hasAutoSwitchedForTrack.current = newTrackId
        setActiveSection(lyricsIndex + 1)
      }
    }
    const trackChangeTimeout = setTimeout(() => {
      isTrackChanging.current = false
    }, 10000)

    return () => {
      clearTimeout(trackChangeTimeout)
      isTrackChanging.current = false
    }
  }, [
    playerData?.track?.id,
    shouldAutoSwitchToLyrics,
    lyricsData?.lyrics,
    currentTrackId,
    lyricsIndex
  ])

  useEffect(() => {
    if (!isTrackChanging.current || !currentTrackId) return
    if (
      !lyricsData?.lyrics?.lines ||
      lyricsData.lyrics.lines.length === 0
    ) {
      return
    }
    if (hasAutoSwitchedForTrack.current === currentTrackId) return

    const shouldSwitch = shouldAutoSwitchToLyrics()

    if (shouldSwitch) {
      hasAutoSwitchedForTrack.current = currentTrackId

      if (lyricsIndex >= 0) {
        setActiveSection(lyricsIndex + 1)
      }
    }
  }, [lyricsData, currentTrackId, shouldAutoSwitchToLyrics, lyricsIndex])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!widgetsRef.current) return

      markUserInteracting()

      const keyNum = parseInt(e.key)
      if (!isNaN(keyNum) && keyNum > 0 && keyNum <= 4) {
        const allWidgets = widgetsRef.current.querySelectorAll('#widget')
        if (keyNum === 1) {
          const playerWidget = allWidgets[0] as HTMLDivElement
          if (playerWidget) playerWidget.focus()
        } else if (keyNum >= 2 && keyNum <= 4) {
          const sectionIndex = keyNum - 2
          if (sectionIndex < sectionsList.length) {
            handlePaginationClick(sectionIndex)
          }
        }
      }

      if (e.key === 'ArrowLeft') {
        if (activeSection > 1) {
          handlePaginationClick(activeSection - 2)
        }
      } else if (e.key === 'ArrowRight') {
        if (activeSection < sectionsList.length) {
          handlePaginationClick(activeSection - 1)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    sectionsList.length,
    activeSection,
    handlePaginationClick,
    markUserInteracting
  ])

  useEffect(() => {
    if (activeSection > sectionsList.length) {
      setActiveSection(Math.max(1, sectionsList.length))
    }
  }, [sectionsList.length, activeSection])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchMoveX.current = null
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current !== null) {
      touchMoveX.current = e.touches[0].clientX
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (touchStartX.current !== null && touchMoveX.current !== null) {
      const deltaX = touchMoveX.current - touchStartX.current

      if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
        markUserInteracting()

        if (deltaX > 0 && activeSection > 1) {
          handlePaginationClick(activeSection - 2)
        } else if (deltaX < 0 && activeSection < sectionsList.length) {
          handlePaginationClick(activeSection)
        }
      }
    }

    touchStartX.current = null
    touchMoveX.current = null
  }, [
    activeSection,
    sectionsList.length,
    handlePaginationClick,
    markUserInteracting
  ])

  useEffect(() => {
    return () => {
      if (userInteractionTimer.current) {
        clearTimeout(userInteractionTimer.current)
        userInteractionTimer.current = null
      }

      if (lyricsCheckTimer.current) {
        clearTimeout(lyricsCheckTimer.current)
        lyricsCheckTimer.current = null
      }
    }
  }, [])

  return (
    <div
      className={`${styles.widgets} ${showStatusBar ? styles.withStatusBar : ''}`}
      ref={widgetsRef}
    >
      <div
        className={`${styles.player} ${sectionsList.length > 0 ? styles.withWidgetsPanel : ''}`}
      >
        <Player />
      </div>
      {sectionsList.length > 0 && (
        <div
          className={styles.widgetsPanel}
          ref={panelRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className={styles.sectionsContainer}>
            {sectionsList.map((section, index) => (
              <div
                key={`section-${index + 1}`}
                className={`${styles.sectionColumn} ${activeSection === index + 1 ? styles.activeSection : styles.hiddenSection}`}
                id={`section-${index + 1}`}
              >
                {index === sectionsList.length - 1 &&
                lyricsVisible &&
                index === activeSection - 1 ? (
                  <Lyrics
                    key="lyrics-active"
                    visible={lyricsVisible}
                    sectionActive={true}
                  />
                ) : (
                  section.components.map(component => component)
                )}
              </div>
            ))}
          </div>
          {sectionsList.length > 1 && (
            <div
              className={styles.pagination}
              onClick={handlePaginationButtonClick}
              ref={paginationRef}
            >
              {sectionsList.map((_, index) => {
                const isActive = activeSection === index + 1
                return (
                  <div
                    key={`pagination-${index + 1}`}
                    data-index={index.toString()}
                    className={`${styles.pageBtn} ${isActive ? styles.active : ''}`}
                    role="button"
                    aria-label={`Go to section ${index + 1}`}
                    tabIndex={0}
                  ></div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Widgets
