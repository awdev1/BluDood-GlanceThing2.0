import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef
} from 'react'
import { SocketContext } from './SocketContext'
import { getWeatherEmoji, getWeatherDescription } from '@/lib/weatherCodes'
import { formatDateTime } from '@/lib/datetimeFormater'
import { debounce } from '@/lib/utils'

interface WeatherData {
  location: string
  time: string
  temperature: number
  temperatureUnit: string
  weatherCode: number
  humidity: number
  maxTemperature: number
  minTemperature: number
}

interface AppSettings {
  timeFormat: string
  dateFormat: string
  showStatusBar: boolean
  showTimeWidget: boolean
  showWeatherWidget: boolean
  showAppsWidget: boolean
  showControlsWidget: boolean
  showLyricsWidget: boolean
  showNothingPlayingNote: boolean
  showTimeOnScreensaver: boolean
  screensaverTimePosition: string
  showTempUnit: boolean
  autoSwitchToLyrics: boolean
  showTimeInStatusBar: boolean
  showWeatherInStatusBar: boolean
  showHighLowTemp: boolean
  showWeatherDescription: boolean
  showWeatherIcon: boolean
  showHumidity: boolean
  showHighLowTempStatusBar: boolean
  showWeatherDescriptionStatusBar: boolean
  showWeatherIconStatusBar: boolean
  showHumidityStatusBar: boolean
}

interface AppStateContextProps extends AppSettings {
  time: string
  date: string
  weather: WeatherData | null
  weatherLoading: boolean
  weatherError: boolean
  weatherEmoji: string
  weatherDescription: string
  setSettings: (settings: Partial<AppSettings>) => void
  playerShown: boolean
  setPlayerShown: (shown: boolean) => void
  playlistsShown: boolean
  setPlaylistsShown: (shown: boolean) => void
}

const defaultSettings: AppSettings = {
  timeFormat: 'HH:mm',
  dateFormat: 'ddd, D MMM',
  showStatusBar: true,
  showTimeWidget: true,
  showWeatherWidget: true,
  showAppsWidget: true,
  showControlsWidget: true,
  showLyricsWidget: true,
  showNothingPlayingNote: true,
  showTimeOnScreensaver: true,
  screensaverTimePosition: 'bottom-right',
  showTempUnit: true,
  autoSwitchToLyrics: false,
  showTimeInStatusBar: true,
  showWeatherInStatusBar: true,
  showHighLowTemp: true,
  showWeatherDescription: true,
  showWeatherIcon: true,
  showHumidity: true,
  showHighLowTempStatusBar: true,
  showWeatherDescriptionStatusBar: true,
  showWeatherIconStatusBar: true,
  showHumidityStatusBar: true
}

const AppStateContext = createContext<AppStateContextProps>({
  ...defaultSettings,
  setSettings: () => {},
  time: '',
  date: '',
  weather: null,
  weatherLoading: true,
  weatherError: false,
  weatherEmoji: '',
  weatherDescription: '',
  playerShown: false,
  setPlayerShown: () => {},
  playlistsShown: false,
  setPlaylistsShown: () => {}
})

interface AppStateContextProviderProps {
  children: React.ReactNode
}

const AppStateContextProvider = ({
  children
}: AppStateContextProviderProps) => {
  const { ready, socket } = useContext(SocketContext)

  const [settings, setSettingsState] =
    useState<AppSettings>(defaultSettings)

  const [time, setTime] = useState<string>('')
  const [date, setDate] = useState<string>('')
  const lastServerTime = useRef<Date | null>(null)
  const lastConnectionTime = useRef<number>(performance.now())
  const localTimeInterval = useRef<ReturnType<typeof setInterval> | null>(
    null
  )

  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [weatherEmoji, setWeatherEmoji] = useState<string>('')
  const [weatherDescription, setWeatherDescription] = useState<string>('')
  const [weatherLoading, setWeatherLoading] = useState<boolean>(true)
  const [weatherError, setWeatherError] = useState<boolean>(false)

  const [playerShown, setPlayerShown] = useState<boolean>(false)
  const [playlistsShown, setPlaylistsShown] = useState<boolean>(false)

  const setSettings = (newSettings: Partial<AppSettings>) => {
    setSettingsState(prev => ({
      ...prev,
      ...newSettings
    }))

    if (socket?.readyState === 1) {
      debouncedSendSettings(newSettings)
    }
  }

  const debouncedSendSettings = debounce(
    (newSettings: Partial<AppSettings>) => {
      if (socket?.readyState === 1) {
        socket.send(
          JSON.stringify({
            type: 'setting',
            data: newSettings
          })
        )
      }
    },
    300
  )

  const setTimeDate = (time?: string, date?: string) => {
    setTime(time ?? '')
    setDate(date ?? '')
  }

  const updateLocalTime = useCallback(() => {
    if (!lastServerTime.current) {
      setTimeDate()
      return
    }
    try {
      const msElapsed = performance.now() - lastConnectionTime.current
      const updatedTime = new Date(
        lastServerTime.current.getTime() + msElapsed
      )
      const formattedDateTime = formatDateTime(
        updatedTime,
        settings.timeFormat,
        settings.dateFormat
      )
      setTimeDate(formattedDateTime.time, formattedDateTime.date)
    } catch (error) {
      console.error('Error updating local time:', error)
      setTimeDate()
    }
  }, [settings.timeFormat, settings.dateFormat])

  const handleSocketMessage = useCallback((e: MessageEvent) => {
    try {
      const { type, data } = JSON.parse(e.data)

      switch (type) {
        case 'setting':
          if (data) {
            setSettingsState(prev => ({
              ...prev,
              ...data
            }))
          }
          break

        case 'time':
          setTimeDate(data.time, data.date)
          lastServerTime.current = new Date(data.dateTime)
          lastConnectionTime.current = performance.now()
          break

        case 'weather':
          setWeatherLoading(false)
          if (data) {
            setWeather(data)
            setWeatherEmoji(getWeatherEmoji(data.weatherCode))
            setWeatherDescription(getWeatherDescription(data.weatherCode))
            setWeatherError(false)
          }
          break
      }
    } catch (error) {
      console.error('Error processing server message:', error)
    }
  }, [])

  useEffect(() => {
    if (ready && socket) {
      socket.addEventListener('message', handleSocketMessage)

      socket.send(JSON.stringify({ type: 'setting' }))
      socket.send(JSON.stringify({ type: 'time' }))
      socket.send(JSON.stringify({ type: 'weather' }))

      return () => {
        socket.removeEventListener('message', handleSocketMessage)
      }
    }
  }, [ready, socket, handleSocketMessage])

  useEffect(() => {
    const startLocalTimeUpdates = () => {
      updateLocalTime()
      if (localTimeInterval.current) {
        clearInterval(localTimeInterval.current)
      }
      localTimeInterval.current = setInterval(updateLocalTime, 1000)
    }

    if (!ready && lastServerTime.current) {
      startLocalTimeUpdates()
      return () => {
        if (localTimeInterval.current) {
          clearInterval(localTimeInterval.current)
          localTimeInterval.current = null
        }
      }
    }

    if (ready && localTimeInterval.current) {
      clearInterval(localTimeInterval.current)
      localTimeInterval.current = null
    }
  }, [ready, updateLocalTime])

  const value = {
    ...settings,
    setSettings,
    time,
    date,
    weather,
    weatherLoading,
    weatherError,
    weatherEmoji,
    weatherDescription,
    playerShown,
    setPlayerShown,
    playlistsShown,
    setPlaylistsShown
  }

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  )
}

export { AppStateContext, AppStateContextProvider }
