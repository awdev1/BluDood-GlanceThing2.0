import React, {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'

import { getSocketPassword } from '@/lib/utils.ts'

interface SocketContextProps {
  ready: boolean
  firstLoad: boolean
  socket: WebSocket | null
}

const SocketContext = createContext<SocketContextProps>({
  ready: false,
  firstLoad: true,
  socket: null
})

interface SocketContextProviderProps {
  children: React.ReactNode
}

const SocketContextProvider = ({ children }: SocketContextProviderProps) => {
  const [ready, setReady] = useState(false)
  const [firstLoad, setFirstLoad] = useState(true)
  const ws = useRef<WebSocket | null>(null)

  const missedPongsRef = useRef(0)
  const lastPingTime = useRef(0)
  const frameId = useRef<number | null>(null)

  const connect = useCallback(() => {
    const socket = new WebSocket('ws://localhost:8000')
    ws.current = socket

    socket.onopen = async () => {
      const pass = await getSocketPassword()
      if (pass) {
        socket.send(JSON.stringify({ type: 'auth', data: pass }))
      }
      setReady(true)
      setFirstLoad(false)
    }

    socket.onclose = () => {
      setReady(false)
      cancelAnimationFrame(frameId.current!)
      setTimeout(connect, 1000)
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      ws.current?.close()
      cancelAnimationFrame(frameId.current!)
    }
  }, [connect])

  useEffect(() => {
    if (!ready || !ws.current) return

    const socket = ws.current

    const handleMessage = (e: MessageEvent) => {
      try {
        const { type } = JSON.parse(e.data)
        if (type === 'pong') {
          missedPongsRef.current = 0
        }
      } catch {
        // Ignore malformed messages
      }
    }

    socket.addEventListener('message', handleMessage)

    const loop = () => {
      const now = Date.now()

      if (socket.readyState === WebSocket.OPEN) {
        if (now - lastPingTime.current > 5000) {
          socket.send(JSON.stringify({ type: 'ping' }))
          lastPingTime.current = now
          missedPongsRef.current += 1

          if (missedPongsRef.current >= 3) {
            socket.close()
            return
          }
        }
      }

      frameId.current = requestAnimationFrame(loop)
    }

    frameId.current = requestAnimationFrame(loop)

    return () => {
      socket.removeEventListener('message', handleMessage)
      cancelAnimationFrame(frameId.current!)
    }
  }, [ready])

  return (
    <SocketContext.Provider
      value={{
        ready,
        firstLoad,
        socket: ws.current
      }}
    >
      {children}
    </SocketContext.Provider>
  )
}

export { SocketContext, SocketContextProvider }
