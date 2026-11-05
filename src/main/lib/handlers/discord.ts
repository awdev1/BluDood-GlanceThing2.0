import {
  HandlerAction,
  HandlerFunction
} from '../../types/WebSocketHandler.js'
import {
  getDiscordState,
  leaveCall,
  toggleDeafen,
  toggleMute
} from '../discord.js'

export const name = 'discord'

export const hasActions = true

export const handle: HandlerFunction = async ws => {
  ws.send(JSON.stringify({ type: 'discord', data: getDiscordState() }))
}

export const actions: HandlerAction[] = [
  {
    action: 'mute',
    handle: async () => {
      await toggleMute()
    }
  },
  {
    action: 'deafen',
    handle: async () => {
      await toggleDeafen()
    }
  },
  {
    action: 'leave',
    handle: async () => {
      await leaveCall()
    }
  }
]
