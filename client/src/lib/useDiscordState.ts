import { useContext, useEffect, useState } from 'react'

import { SocketContext } from '@/contexts/SocketContext.tsx'

export interface DiscordState {
  connected: boolean
  inCall: boolean
  channel: string | null
  mute: boolean
  deaf: boolean
}

export function useDiscordState() {
  const { ready, socket } = useContext(SocketContext)
  const [state, setState] = useState<DiscordState | null>(null)

  useEffect(() => {
    if (!ready || !socket) return

    const listener = (e: MessageEvent) => {
      const { type, data } = JSON.parse(e.data)
      if (type === 'discord') setState(data)
    }

    socket.addEventListener('message', listener)
    socket.send(JSON.stringify({ type: 'discord' }))

    return () => socket.removeEventListener('message', listener)
  }, [ready, socket])

  return state
}
