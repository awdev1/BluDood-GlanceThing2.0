import { playbackManager } from '../playback/playback.js'
import { getStorageValue } from '../storage.js'
import { serverManager } from '../server.js'
import { log } from '../utils.js'

import { AuthenticatedWebSocket } from '../../types/WebSocketServer.js'
import { SetupFunction } from '../../types/WebSocketSetup.js'

export const name = 'playback'

export const setup: SetupFunction = async () => {
  playbackManager.on('playback', data => {
    const wss = serverManager.getServer()
    if (!wss) return
    wss.clients.forEach(async (ws: AuthenticatedWebSocket) => {
      if (!ws.authenticated) return

      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'playback', data }))
      }
    })
  })

  playbackManager.on('close', async () => {
    log('Closed, attempting to reopen in 5 seconds...', 'PlaybackManager')
    await playbackManager.cleanup()

    setTimeout(async () => {
      await playbackManager.setup(playbackHandler)
    }, 5000)
  })

  playbackManager.on('open', (handlerName?: string) => {
    log(`Opened with handler ${handlerName}`, 'PlaybackManager')
  })

  playbackManager.on('error', err => {
    log(`An error occurred: ${err}`, 'PlaybackManager')
  })

  const playbackHandler = getStorageValue('playbackHandler')

  if (!playbackHandler || playbackHandler === 'none') {
    log('No handler set', 'Playback')
  } else {
    await playbackManager.setup(playbackHandler)
  }

  return async () => {
    await playbackManager.cleanup()
  }
}
