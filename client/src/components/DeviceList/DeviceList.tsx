import {
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  memo
} from 'react'

import { SocketContext } from '@/contexts/SocketContext.tsx'
import { MediaContext } from '@/contexts/MediaContext.tsx'
import {
  SpotifyDeviceContext,
  SpotifyDevice,
  SpotifyDeviceContextProvider
} from '@/contexts/SpotifyDeviceContext.tsx'

import styles from './DeviceList.module.css'

interface DeviceListProps {
  onClose: () => void
}

// Memoized VolumeControl component to prevent unnecessary re-renders
const VolumeControl = memo(
  ({
    deviceId,
    defaultVolume,
    localVolumes,
    onVolumeChange
  }: {
    deviceId: string
    defaultVolume: number
    localVolumes: Record<string, number>
    onVolumeChange: (deviceId: string, volume: number) => void
  }) => {
    const deviceVolume = localVolumes[deviceId] ?? defaultVolume

    // Use local state for immediate UI updates
    const [displayVolume, setDisplayVolume] = useState(deviceVolume)
    const volumeTimerRef = useRef<NodeJS.Timeout | null>(null)
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
    const intervalRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
      setDisplayVolume(deviceVolume)
    }, [deviceVolume])

    const volumeIcon = useMemo(() => {
      if (displayVolume > 50) return 'volume_up'
      if (displayVolume > 0) return 'volume_down'
      return 'volume_mute'
    }, [displayVolume])

    const updateVolume = useCallback(
      (delta: number) => {
        setDisplayVolume(prev => {
          const newVolume = Math.max(0, Math.min(100, prev + delta))

          // Clear existing timer
          if (volumeTimerRef.current) {
            clearTimeout(volumeTimerRef.current)
          }

          // Debounce the actual volume change
          volumeTimerRef.current = setTimeout(() => {
            onVolumeChange(deviceId, newVolume)
          }, 100)

          return newVolume
        })
      },
      [deviceId, onVolumeChange]
    )

    const startLongPress = useCallback(
      (direction: 'up' | 'down') => {
        const delta = direction === 'up' ? 5 : -5

        // Initial change
        updateVolume(delta)

        // Start continuous updates after a delay
        longPressTimerRef.current = setTimeout(() => {
          intervalRef.current = setInterval(() => {
            updateVolume(delta)
          }, 100)
        }, 300)
      },
      [updateVolume]
    )

    const stopLongPress = useCallback(() => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }, [])

    useEffect(() => {
      return () => {
        if (volumeTimerRef.current) clearTimeout(volumeTimerRef.current)
        if (longPressTimerRef.current)
          clearTimeout(longPressTimerRef.current)
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    }, [])

    return (
      <div className={styles.volumeControls}>
        <button
          className={styles.volumeButton}
          onMouseDown={() => startLongPress('down')}
          onMouseUp={stopLongPress}
          onMouseLeave={stopLongPress}
          onTouchStart={() => startLongPress('down')}
          onTouchEnd={stopLongPress}
          disabled={displayVolume === 0}
        >
          <span className="material-icons">remove</span>
        </button>

        <div className={styles.volumeInfo}>
          <span className={`material-icons ${styles.volumeIcon}`}>
            {volumeIcon}
          </span>
          <div className={styles.volumeDisplay}>{displayVolume}%</div>
        </div>

        <button
          className={styles.volumeButton}
          onMouseDown={() => startLongPress('up')}
          onMouseUp={stopLongPress}
          onMouseLeave={stopLongPress}
          onTouchStart={() => startLongPress('up')}
          onTouchEnd={stopLongPress}
          disabled={displayVolume === 100}
        >
          <span className="material-icons">add</span>
        </button>
      </div>
    )
  }
)

VolumeControl.displayName = 'VolumeControl'

// Memoized DeviceItem component
const DeviceItem = memo(
  ({
    device,
    transferStatus,
    localVolumes,
    onDeviceClick,
    onTransferClick,
    onVolumeChange
  }: {
    device: SpotifyDevice
    transferStatus: {
      deviceId: string
      status: 'loading' | 'success' | 'error'
      message?: string
    } | null
    localVolumes: Record<string, number>
    onDeviceClick: (device: SpotifyDevice) => void
    onTransferClick: (deviceId: string) => void
    onVolumeChange: (deviceId: string, volume: number) => void
  }) => {
    function getDeviceTypeIcon(type: string) {
      switch (type.toLowerCase()) {
        case 'computer':
          return 'computer'
        case 'smartphone':
          return 'smartphone'
        case 'speaker':
          return 'speaker'
        case 'tv':
          return 'tv'
        default:
          return 'devices_other'
      }
    }

    const deviceTransferStatus = useMemo(() => {
      if (transferStatus?.deviceId === device.id) {
        return {
          status: transferStatus.status,
          message: transferStatus.message || ''
        }
      }
      return null
    }, [device.id, transferStatus])

    const handleClick = useCallback(() => {
      onDeviceClick(device)
    }, [device, onDeviceClick])

    const handleTransfer = useCallback(() => {
      onTransferClick(device.id)
    }, [device.id, onTransferClick])

    return (
      <div
        className={`${styles.deviceItem} ${device.is_active ? styles.active : ''}`}
      >
        <div className={styles.deviceInfo} onClick={handleClick}>
          <div className={styles.deviceInfoItem}>
            <div className={styles.deviceDetails}>
              <span className={`material-icons ${styles.deviceIcon}`}>
                {getDeviceTypeIcon(device.type)}
              </span>
              <span className={styles.deviceName}>{device.name}</span>
            </div>
            <div className={styles.deviceControls}>
              {device.supports_volume && (
                <VolumeControl
                  deviceId={device.id}
                  defaultVolume={device.volume_percent}
                  localVolumes={localVolumes}
                  onVolumeChange={onVolumeChange}
                />
              )}
              {deviceTransferStatus?.status === 'error' && (
                <div className={styles.transferError}>
                  {deviceTransferStatus.message}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={styles.buttonGroup}>
          {!device.is_active && (
            <button
              className={`${styles.transferButton} ${deviceTransferStatus?.status === 'error' ? styles.error : ''}`}
              onClick={handleTransfer}
              disabled={deviceTransferStatus?.status === 'loading'}
            >
              {deviceTransferStatus ? (
                deviceTransferStatus.status === 'error' ? (
                  <>
                    <span className="material-icons">error</span>
                  </>
                ) : (
                  <>
                    <span className="material-icons">sync</span>
                  </>
                )
              ) : (
                <>
                  <span className="material-icons">sync_alt</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    )
  }
)

DeviceItem.displayName = 'DeviceItem'

const DeviceListContent: React.FC<DeviceListProps> = ({ onClose }) => {
  const { ready, socket } = useContext(SocketContext)
  const { actions } = useContext(MediaContext)
  const [devices, setDevices] = useState<SpotifyDevice[]>([])
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [mounted, setMounted] = useState(false)

  const [transferStatus, setTransferStatus] = useState<{
    deviceId: string
    status: 'loading' | 'success' | 'error'
    message?: string
  } | null>(null)

  const lastClickTimeRef = useRef<number>(0)
  const deviceIdRef = useRef<string>('')

  const {
    localVolumes,
    handleVolumeChange,
    handleTransferPlayback,
    updateDeviceVolumes
  } = useContext(SpotifyDeviceContext)

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    actions.devices()
    setTimeout(() => {
      setRefreshing(false)
    }, 1000)
  }, [actions])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  const handleDeviceTransfer = useCallback(
    (deviceId: string) => {
      setTransferStatus({ deviceId, status: 'loading' })
      handleTransferPlayback(deviceId)
    },
    [handleTransferPlayback]
  )

  const handleDeviceClick = useCallback(
    (device: SpotifyDevice) => {
      const currentTime = new Date().getTime()
      const timeSinceLastClick = currentTime - lastClickTimeRef.current
      const sameDevice = deviceIdRef.current === device.id

      if (sameDevice && timeSinceLastClick < 500) {
        handleDeviceTransfer(device.id)
        lastClickTimeRef.current = 0
        deviceIdRef.current = ''
      } else {
        lastClickTimeRef.current = currentTime
        deviceIdRef.current = device.id
      }
    },
    [handleDeviceTransfer]
  )

  useEffect(() => {
    if (devices.length > 0) {
      updateDeviceVolumes(devices)
    }
  }, [devices, updateDeviceVolumes])

  useEffect(() => {
    if (!mounted) {
      actions.devices()
      setMounted(true)
    }
  }, [mounted, actions])

  useEffect(() => {
    if (!ready || !socket) return
    const handleSocketMessage = (e: MessageEvent) => {
      try {
        const { type, action, data } = JSON.parse(e.data)

        if (type === 'playback') {
          if (action === 'devices') {
            if (data.error) {
              setError(
                data.error || 'Failed to load devices. Please try again.'
              )
            } else {
              setDevices(data.devices || [])
            }
            return
          }
          if (action === 'transferPlayback' && transferStatus) {
            const { success, error } = data
            if (success) {
              setTransferStatus({ ...transferStatus, status: 'success' })
              setTimeout(() => {
                actions.devices()
                setTransferStatus(null)
              }, 1500)
            } else {
              setTransferStatus({
                ...transferStatus,
                status: 'error',
                message: error || 'Failed to transfer playback'
              })
            }
            return
          }
        }
      } catch (err) {
        console.error('Error handling socket message:', err)
      }
    }

    socket.addEventListener('message', handleSocketMessage)

    return () => {
      socket.removeEventListener('message', handleSocketMessage)
    }
  }, [ready, socket, actions, transferStatus])

  const stableHandleVolumeChange = useCallback(
    (deviceId: string, volume: number) => {
      handleVolumeChange(deviceId, volume)
    },
    [handleVolumeChange]
  )

  const stableHandleTransferClick = useCallback(
    (deviceId: string) => {
      handleDeviceTransfer(deviceId)
    },
    [handleDeviceTransfer]
  )

  const deviceItems = useMemo(() => {
    return devices.map(device => (
      <DeviceItem
        key={device.id}
        device={device}
        transferStatus={transferStatus}
        localVolumes={localVolumes}
        onDeviceClick={handleDeviceClick}
        onTransferClick={stableHandleTransferClick}
        onVolumeChange={stableHandleVolumeChange}
      />
    ))
  }, [
    devices,
    transferStatus,
    localVolumes,
    handleDeviceClick,
    stableHandleTransferClick,
    stableHandleVolumeChange
  ])

  return (
    <div className={styles.deviceListContainer}>
      <div className={styles.deviceListContent}>
        <div className={styles.listHeader}>
          <button
            className={styles.headerButton}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <span
              className={`material-icons ${refreshing ? styles.rotating : ''}`}
            >
              {refreshing ? 'sync' : 'refresh'}
            </span>
          </button>
          <button className={styles.headerButton} onClick={handleClose}>
            <span className="material-icons">close</span>
          </button>
        </div>
        {error && (
          <div className={styles.errorMessage}>
            <span className="material-icons">error</span>
            {error}
          </div>
        )}
        {!devices.length && !error && (
          <div className={styles.noDevices}>
            <span className="material-icons">speaker</span>
            No devices found
          </div>
        )}
        {refreshing && (
          <div className={styles.refreshing}>
            <span className="material-icons">sync</span>
            Refreshing...
          </div>
        )}
        <div className={styles.deviceList}>{deviceItems}</div>
      </div>
    </div>
  )
}

const DeviceList: React.FC<DeviceListProps> = props => {
  return (
    <SpotifyDeviceContextProvider>
      <DeviceListContent {...props} />
    </SpotifyDeviceContextProvider>
  )
}

export default DeviceList
