import {
  KeyboardEvent,
  useContext,
  useEffect,
  useRef,
  useState,
  WheelEvent
} from 'react'

import { formatTime } from '@/lib/utils.ts'

import BaseWidget from '../BaseWidget/BaseWidget.tsx'

import styles from './Player.module.css'
import { MediaContext } from '@/contexts/MediaContext.tsx'

const Player: React.FC = () => {
  const { actions, playerData, playerDataRef, image } =
    useContext(MediaContext)

  const playerRef = useRef<HTMLDivElement>(null)
  const imageDivRef = useRef<HTMLDivElement>(null)

  const [volume, setVolume] = useState(0)
  const volumeRef = useRef(volume)
  const lastVolumeChange = useRef(0)
  const [volumeAdjusted, setVolumeAdjusted] = useState(false)

  const coverClicks = useRef(0)
  const coverClickTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )

  const [coverAction, setCoverAction] = useState<
    'play' | 'pause' | 'forward' | 'back' | null
  >(null)

  function volumeUp() {
    if (playerDataRef.current === null) return
    if (!playerDataRef.current.supportedActions.includes('volume')) return

    const volume = volumeRef.current

    if (volume < 100) {
      const newVolume = Math.min(volume + 10, 100)

      actions.setVolume(newVolume)
      setVolume(newVolume)
      volumeRef.current = newVolume
      lastVolumeChange.current = Date.now()
    }
  }

  function volumeDown() {
    if (playerDataRef.current === null) return
    if (!playerDataRef.current.supportedActions.includes('volume')) return

    const volume = volumeRef.current

    if (volume > 0) {
      const newVolume = Math.max(volume - 10, 0)
      actions.setVolume(newVolume)

      setVolume(newVolume)
      volumeRef.current = newVolume
      lastVolumeChange.current = Date.now()
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter') {
      actions.playPause()
    } else if (e.key === 'ArrowLeft') {
      onWheel({ deltaX: -1 } as WheelEvent<HTMLDivElement>)
    } else if (e.key === 'ArrowRight') {
      onWheel({ deltaX: 1 } as WheelEvent<HTMLDivElement>)
    }
  }

  function onWheel(e: WheelEvent<HTMLDivElement>) {
    if (e.deltaX < 0) {
      volumeDown()
    } else if (e.deltaX > 0) {
      volumeUp()
    }
  }

  function handleCoverPress() {
    coverClicks.current++

    if (coverClickTimer.current !== null)
      clearTimeout(coverClickTimer.current)

    coverClickTimer.current = setTimeout(() => {
      if (coverClicks.current === 1) {
        setCoverAction(playerDataRef.current!.isPlaying ? 'pause' : 'play')
        actions.playPause()
      } else if (coverClicks.current === 2) {
        setCoverAction('forward')
        actions.skipForward()
      } else if (coverClicks.current === 3) {
        setCoverAction('back')
        actions.skipBackward()
      }

      coverClicks.current = 0
    }, 200)
  }

  useEffect(() => {
    if (coverAction) {
      const timer = setTimeout(() => {
        setCoverAction(null)
      }, 500)

      return () => {
        clearTimeout(timer)
      }
    }
  }, [coverAction])

  useEffect(() => {
    setVolumeAdjusted(true)
    const timer = setTimeout(() => {
      setVolumeAdjusted(false)
    }, 2000)

    return () => {
      clearTimeout(timer)
    }
  }, [volume])

  useEffect(() => {
    if (playerData) {
      if (lastVolumeChange.current < Date.now() - 1000) {
        setVolume(playerData.volume)
        volumeRef.current = playerData.volume
      }

      const height = imageDivRef.current!.parentElement!.clientHeight

      imageDivRef.current!.style.width = `${height}px`
      imageDivRef.current!.style.height = `${height}px`
    }
  }, [playerData])

  useEffect(() => {
    const listener = (e: globalThis.WheelEvent) => {
      if (playerRef.current!.matches(':focus-within')) {
        e.preventDefault()
        onWheel({
          deltaX: e.deltaX
        } as WheelEvent<HTMLDivElement>)
      }
    }

    document.addEventListener('wheel', listener, {
      passive: false
    })

    return () => {
      document.removeEventListener('wheel', listener)
    }
  })

  return (
    <BaseWidget
      className={styles.player}
      onKeyDown={onKeyDown}
      ref={playerRef}
    >
      {playerData ? (
        <>
          <button onMouseDown={handleCoverPress} className={styles.cover}>
            <div
              className={styles.action}
              data-shown={coverAction !== null}
            >
              <span
                className="material-icons"
                data-shown={coverAction === 'play'}
              >
                play_arrow
              </span>
              <span
                className="material-icons"
                data-shown={coverAction === 'pause'}
              >
                pause
              </span>
              <span
                className="material-icons"
                data-shown={coverAction === 'forward'}
              >
                skip_next
              </span>
              <span
                className="material-icons"
                data-shown={coverAction === 'back'}
              >
                skip_previous
              </span>
            </div>
            <div className={styles.image} ref={imageDivRef}>
              {image ? (
                <img src={image} />
              ) : (
                <span className="material-icons">music_note</span>
              )}
            </div>
          </button>
          <span className={styles.name}>{playerData.track.name}</span>
          <span className={styles.artists}>
            {playerData.track.artists.join(', ')}
          </span>
          <div className={styles.controls}>
            <button onMouseDown={actions.skipBackward}>
              <span className="material-icons">skip_previous</span>
            </button>
            <button onMouseDown={actions.playPause}>
              <span className="material-icons">
                {playerData.isPlaying ? 'pause' : 'play_arrow'}
              </span>
            </button>
            <button onMouseDown={actions.skipForward}>
              <span className="material-icons">skip_next</span>
            </button>
          </div>
          <div className={styles.progress}>
            <p>{formatTime(playerData.track.duration.current)}</p>
            <div className={styles.slider}>
              <div
                className={styles.fill}
                style={{
                  width: `${
                    (playerData.track.duration.current /
                      playerData.track.duration.total) *
                    100
                  }%`
                }}
              ></div>
            </div>
            <p>{formatTime(playerData.track.duration.total)}</p>
          </div>
          {playerData.supportedActions.includes('volume') && (
            <div className={styles.volume} data-shown={volumeAdjusted}>
              <button onMouseDown={volumeDown}>
                <span className="material-icons"> volume_down </span>
              </button>
              <div className={styles.slider}>
                <div
                  className={styles.fill}
                  style={{ width: `${volume}%` }}
                ></div>
              </div>
              <button onMouseDown={volumeUp}>
                <span className="material-icons"> volume_up </span>
              </button>
            </div>
          )}
        </>
      ) : (
        <div className={styles.notPlaying}>
          <span className="material-icons">music_note</span>
          <p className={styles.title}>Nothing playing!</p>
          <p className={styles.note}>
            Start playing something on your computer.
          </p>
        </div>
      )}
    </BaseWidget>
  )
}

export default Player
