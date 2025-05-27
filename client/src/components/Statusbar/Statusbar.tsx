import { useContext } from 'react'
import { AppStateContext } from '@/contexts/AppStateContext'
import styles from './Statusbar.module.css'

const Statusbar: React.FC = () => {
  const {
    time,
    date,
    weather,
    weatherDescription,
    weatherEmoji,
    showTempUnit,
    showTimeInStatusBar,
    showWeatherInStatusBar,
    showHighLowTempStatusBar,
    showWeatherDescriptionStatusBar,
    showWeatherIconStatusBar,
    showHumidityStatusBar
  } = useContext(AppStateContext)

  return (
    <div className={styles.statusbar}>
      {showTimeInStatusBar && (
        <div className={styles.timedate}>
          <div className={styles.time}>{time}</div>
          <div className={styles.date}>{date}</div>
        </div>
      )}
      {showWeatherInStatusBar && weather && (
        <div className={styles.weather}>
          {showWeatherDescriptionStatusBar && (
            <div className={styles.weatherDescription}>
              {weatherDescription}
            </div>
          )}
          {showWeatherIconStatusBar && (
            <div className={styles.weatherIcon}>{weatherEmoji}</div>
          )}
          <div className={styles.temperature}>
            {weather.temperature}
            {showTempUnit ? weather.temperatureUnit : '°'}
          </div>
          {showHumidityStatusBar && (
            <div className={styles.humidity}>💧{weather.humidity}%</div>
          )}
          {showHighLowTempStatusBar && (
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
      {!showTimeInStatusBar && !showWeatherInStatusBar && (
        <div className={styles.empty}></div>
      )}
    </div>
  )
}

export default Statusbar
