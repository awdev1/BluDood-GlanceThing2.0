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
    showTempUnit,
    showHighLowTemp,
    showWeatherDescription,
    showWeatherIcon,
    showHumidity
  } = useContext(AppStateContext)

  return (
    <BaseWidget className={styles.weather} visible={visible}>
      {weather ? (
        <div className={styles.container}>
          <div className={styles.location}>{weather.location}</div>
          <div className={styles.row}>
            <div className={styles.temp}>
              {weather.temperature}
              {showTempUnit ? weather.temperatureUnit : '°'}
            </div>
            {showWeatherIcon && (
              <div className={styles.icon}>{weatherEmoji}</div>
            )}
          </div>
          {showWeatherDescription && (
            <div className={styles.description}>{weatherDescription}</div>
          )}
          {(showHumidity || showHighLowTemp) && (
            <div className={styles.condition}>
              {showHumidity && <span>💧{weather.humidity}%</span>}
              {showHighLowTemp && (
                <div className={styles.tempMinMax}>
                  <span className={styles.tempMax}>
                    ↑{weather.maxTemperature}°
                  </span>
                  <span className={styles.tempMin}>
                    ↓{weather.minTemperature}°
                  </span>
                </div>
              )}
            </div>
          )}
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
