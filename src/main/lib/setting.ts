import { AuthenticatedWebSocket } from '../types/WebSocketServer.js'
import { serverManager } from './server.js'
import { getStorageValue } from './storage.js'

export function getClientSettings() {
  const clientKeys = [
    'timeFormat',
    'dateFormat',
    'showStatusBar',
    'showTimeWidget',
    'showWeatherWidget',
    'showAppsWidget',
    'showControlsWidget',
    'showLyricsWidget',
    'showNothingPlayingNote',
    'showTimeOnScreensaver',
    'screensaverTimePosition',
    'showTempUnit',
    'autoSwitchToLyrics',
    'showTimeInStatusBar',
    'showWeatherInStatusBar',
    'showHighLowTemp',
    'showWeatherDescription',
    'showWeatherIcon',
    'showHumidity',
    'showHighLowTempStatusBar',
    'showWeatherDescriptionStatusBar',
    'showWeatherIconStatusBar',
    'showHumidityStatusBar',
    'lyricsOffset'
  ]
  const clientSettings = {}
  clientKeys.forEach(key => {
    let value = getStorageValue(key)
    if (value === null) {
      value = true
    }
    clientSettings[key] = value
  })
  if (typeof clientSettings['lyricsOffset'] !== 'number')
    clientSettings['lyricsOffset'] = 1.5
  return clientSettings
}

export async function notifyClientsOfSettingChanges(): Promise<void> {
  const wss = serverManager.getServer()
  if (!wss) return

  wss.clients.forEach(async (ws: AuthenticatedWebSocket) => {
    if (!ws.authenticated) return
    if (ws.readyState === 1) {
      ws.send(
        JSON.stringify({
          type: 'setting',
          data: getClientSettings()
        })
      )
    }
  })
}
