import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useMemo
} from 'react'
import { MediaContext } from './MediaContext'

export interface SpotifyDevice {
  id: string
  is_active: boolean
  is_private_session: boolean
  is_restricted: boolean
  name: string
  type: string
  volume_percent: number
  supports_volume: boolean
}

interface SpotifyDeviceContextType {
  localVolumes: Record<string, number>
  handleVolumeChange: (deviceId: string, volume: number) => void
  handleTransferPlayback: (deviceId: string) => void
  updateDeviceVolumes: (devices: SpotifyDevice[]) => void
}

const defaultContextValue: SpotifyDeviceContextType = {
  localVolumes: {},
  handleVolumeChange: () => {},
  handleTransferPlayback: () => {},
  updateDeviceVolumes: () => {}
}

const SpotifyDeviceContext = createContext<SpotifyDeviceContextType>(
  defaultContextValue
)

const SpotifyDeviceContextProvider: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  const [localVolumes, setLocalVolumes] = useState<Record<string, number>>(
    {}
  )
  const volumeTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({})
  const { actions } = useContext(MediaContext)

  const handleVolumeChange = useCallback(
    (deviceId: string, volume: number) => {
      // Only update if the volume actually changed
      setLocalVolumes(prev => {
        if (prev[deviceId] === volume) return prev
        return { ...prev, [deviceId]: volume }
      })

      if (volumeTimeoutRef.current[deviceId]) {
        clearTimeout(volumeTimeoutRef.current[deviceId])
      }

      volumeTimeoutRef.current[deviceId] = setTimeout(() => {
        actions.setVolume(volume, deviceId)
      }, 300)
    },
    [actions]
  )

  const handleTransferPlayback = useCallback(
    (deviceId: string) => {
      actions.transferPlayback(deviceId)
    },
    [actions]
  )

  const updateDeviceVolumes = useCallback((devices: SpotifyDevice[]) => {
    setLocalVolumes(prevVolumes => {
      const newVolumes = { ...prevVolumes }
      let hasChanges = false

      devices.forEach(device => {
        if (newVolumes[device.id] !== device.volume_percent) {
          newVolumes[device.id] = device.volume_percent
          hasChanges = true
        }
      })

      // Only return new object if there were actual changes
      return hasChanges ? newVolumes : prevVolumes
    })
  }, [])

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      localVolumes,
      handleVolumeChange,
      handleTransferPlayback,
      updateDeviceVolumes
    }),
    [
      localVolumes,
      handleVolumeChange,
      handleTransferPlayback,
      updateDeviceVolumes
    ]
  )

  return (
    <SpotifyDeviceContext.Provider value={contextValue}>
      {children}
    </SpotifyDeviceContext.Provider>
  )
}

export { SpotifyDeviceContext, SpotifyDeviceContextProvider }
