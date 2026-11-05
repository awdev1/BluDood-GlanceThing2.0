import { lyricsCache } from './lyric.js'
import { playbackManager } from './playback/playback.js'
import { serverManager } from './server.js'
import { log } from './utils.js'

import { AuthenticatedWebSocket } from '../types/WebSocketServer.js'

export async function reloadLyrics() {
  lyricsCache.clear()
  log('Lyrics source changed, reloading lyrics', 'Lyrics')

  const lyrics = await playbackManager.getLyrics().catch(() => null)
  const wss = serverManager.getServer()
  if (!lyrics || !wss) return

  wss.clients.forEach((ws: AuthenticatedWebSocket) => {
    if (!ws.authenticated || ws.readyState !== 1) return
    ws.send(JSON.stringify({ type: 'playback', action: 'lyrics', data: lyrics }))
  })
}
