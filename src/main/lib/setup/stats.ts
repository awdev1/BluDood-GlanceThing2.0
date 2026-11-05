import { SetupFunction } from '../../types/WebSocketSetup.js'
import { updateStats } from '../stats.js'

export const name = 'stats'

export const setup: SetupFunction = async () => {
  const interval = setInterval(updateStats, 3000)

  return async () => {
    clearInterval(interval)
  }
}
