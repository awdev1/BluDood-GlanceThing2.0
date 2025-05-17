import { useContext } from 'react'
import { AppStateContext } from '@/contexts/AppStateContext.tsx'
import BaseWidget from '../BaseWidget/BaseWidget.tsx'

import styles from './Weather.module.css'

interface WeatherProps {
  visible: boolean
}

const Weather: React.FC<WeatherProps> = ({ visible }) => {
  const {
    weather,
    weatherLoading: loading,
    weatherError: error,
    weatherEmoji,
    weatherDescription,
    temperatureUnit
  } = useContext(AppStateContext)

  return (
    <BaseWidget className={styles.weather} visible={visible}>
      {weather ? (
        <div className={styles.container}>
          <div className={styles.location}>{weather.location}</div>
          <div className={styles.row}>
            <div className={styles.temp}>
              {weather.temperature}°{temperatureUnit}
            </div>
            <div className={styles.icon}>{weatherEmoji}</div>
          </div>
          <div className={styles.description}>{weatherDescription}</div>
          <div className={styles.condition}>
            <span>💧{weather.humidity}%</span>
            <span>
              📈{weather.maxTemperature}°{temperatureUnit}
            </span>
            <span>
              📉{weather.minTemperature}°{temperatureUnit}
            </span>
          </div>
        </div>
      ) : error ? (
        <div className={styles.error}>
          <div>Unable to get weather data</div>
          <div className={styles.errorNote}>
            Data will refresh automatically
          </div>
        </div>
      ) : loading ? (
        <div className={styles.loading}>Loading weather data...</div>
      ) : (
        <div className={styles.loading}>Waiting for weather data...</div>
      )}
    </BaseWidget>
  )
}

export default Weather
