import { HandlerFunction } from '../../types/WebSocketHandler.js'
import { updateWeather } from '../weather.js'

export const name = 'weather'

export const hasActions = false

export const handle: HandlerFunction = async ws => {
  ws.send(
    JSON.stringify({
      type: 'weather',
      data: updateWeather()
    })
  )
}
