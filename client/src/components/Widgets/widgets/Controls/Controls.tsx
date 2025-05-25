import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react'
import type { KeyboardEvent, WheelEvent } from 'react'

import BaseWidget from '../BaseWidget/BaseWidget.tsx'

import { SocketContext } from '@/contexts/SocketContext.tsx'
import { AppStateContext } from '@/contexts/AppStateContext.tsx'
import { MediaContext } from '@/contexts/MediaContext.tsx'

import DeviceList from '@/components/DeviceList/DeviceList.tsx'

import styles from './Controls.module.css'

interface ControlsProps {
  visible?: boolean
}

const Controls: React.FC<ControlsProps> = ({ visible }) => {
  const { socket } = useContext(SocketContext)
  const { setPlaylistsShown } = useContext(AppStateContext)
  const { playerData } = useContext(MediaContext)
  const [supportPlaylists, setSupportPlaylists] = useState(false)
  const [supportDevices, setSupportDevices] = useState(false)
  const [showDeviceList, setShowDeviceList] = useState(false)

  const controlsRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowLeft') {
      onWheel({ deltaX: -1 } as WheelEvent<HTMLDivElement>)
    } else if (e.key === 'ArrowRight') {
      onWheel({ deltaX: 1 } as WheelEvent<HTMLDivElement>)
    }
  }

  function onWheel(e: WheelEvent<HTMLDivElement>) {
    const focused = document.activeElement as HTMLElement
    if (e.deltaX < 0) {
      const prev = focused.previousElementSibling as HTMLElement
      if (prev) {
        prev.focus()
      } else {
        const last = controlsRef.current?.lastElementChild as HTMLElement
        last.focus()
      }
    } else if (e.deltaX > 0) {
      const next = focused.nextElementSibling as HTMLElement
      if (next) {
        next.focus()
      } else {
        const first = controlsRef.current?.firstElementChild as HTMLElement
        first.focus()
      }
    }
  }

  function onFocus() {
    if (document.activeElement !== controlsRef.current) return
    const first = controlsRef.current?.firstElementChild as HTMLElement
    first.focus()
  }

  function lock() {
    socket?.send(
      JSON.stringify({
        type: 'lock'
      })
    )
  }

  const toggleDeviceList = useCallback(() => {
    setShowDeviceList(!showDeviceList)
  }, [showDeviceList])

  useEffect(() => {
    if (!showDeviceList) return

    const handleModalWheelEvents = (e: Event) => {
      if (showDeviceList && modalRef.current?.contains(e.target as Node)) {
        e.stopPropagation()
      }
    }

    const modalElement = modalRef.current
    if (modalElement) {
      modalElement.addEventListener('wheel', handleModalWheelEvents, {
        passive: false
      })
    }

    return () => {
      if (modalElement) {
        modalElement.removeEventListener('wheel', handleModalWheelEvents)
      }
    }
  }, [showDeviceList])

  useEffect(() => {
    const handleWheelEvent = (e: globalThis.WheelEvent) => {
      if (showDeviceList) return

      if (controlsRef.current?.querySelector(':focus-within')) {
        e.preventDefault()
        onWheel({
          deltaX: e.deltaX
        } as WheelEvent<HTMLDivElement>)
      }
    }

    document.addEventListener('wheel', handleWheelEvent, {
      passive: false
    })

    return () => {
      document.removeEventListener('wheel', handleWheelEvent)
    }
  }, [showDeviceList])

  const handleModalTouchEvent = (e: React.TouchEvent) => {
    if (showDeviceList) {
      e.stopPropagation()
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && showDeviceList) {
        toggleDeviceList()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showDeviceList, toggleDeviceList])

  useEffect(() => {
    const supportDevices =
      playerData?.supportedActions.includes('devices') ?? false
    setSupportDevices(supportDevices)
    const supportPlaylists =
      playerData?.supportedActions.includes('playlists') ?? false
    setSupportPlaylists(supportPlaylists)
  }, [playerData?.supportedActions])

  return (
    <>
      <BaseWidget
        className={styles.controls}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        ref={controlsRef}
        visible={visible}
      >
        <div
          className={styles.control}
          tabIndex={-1}
          data-type="lock"
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.stopPropagation()
              lock()
            }
          }}
          onClick={() => lock()}
        >
          <span className="material-icons">lock</span>
          <p>Lock</p>
        </div>
        {supportPlaylists && (
          <div
            className={styles.control}
            tabIndex={-1}
            data-type="playlists"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.stopPropagation()
                setPlaylistsShown(true)
              }
            }}
            onClick={() => setPlaylistsShown(true)}
          >
            <span className="material-icons">menu</span>
            <p>Playlists</p>
          </div>
        )}
        {supportDevices && (
          <div
            className={styles.control}
            tabIndex={-1}
            data-type="devices"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.stopPropagation()
                toggleDeviceList()
              }
            }}
            onClick={toggleDeviceList}
          >
            <span className="material-icons">speaker</span>
            <p>Devices</p>
          </div>
        )}
      </BaseWidget>

      {supportDevices && showDeviceList && (
        <div
          className={styles.modalOverlay}
          ref={modalRef}
          onTouchStart={handleModalTouchEvent}
          onTouchMove={handleModalTouchEvent}
          onTouchEnd={handleModalTouchEvent}
          onClick={e => {
            if (e.target === modalRef.current) {
              toggleDeviceList()
            }
          }}
        >
          <div className={styles.modalContent}>
            <DeviceList onClose={toggleDeviceList} />
          </div>
        </div>
      )}
    </>
  )
}

export default Controls
