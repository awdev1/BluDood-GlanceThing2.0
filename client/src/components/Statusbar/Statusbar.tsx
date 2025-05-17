import { useContext, useEffect, useState } from 'react'

import { SocketContext } from '@/contexts/SocketContext.tsx'

import styles from './Statusbar.module.css'

const Statusbar: React.FC = () => {
  const { ready, socket } = useContext(SocketContext)

  const [time, setTime] = useState<string | null>(null)
  const [date, setDate] = useState<string | null>(null)

  useEffect(() => {
    if (ready === true && socket) {
      const listener = (e: MessageEvent) => {
        const { type, data } = JSON.parse(e.data)
        if (type !== 'time') return
        setTime(data.time)
        setDate(data.date)
      }

      socket.addEventListener('message', listener)

      socket.send(JSON.stringify({ type: 'time' }))

      return () => {
        socket.removeEventListener('message', listener)
      }
    }
  }, [ready, socket])

  return (
    <div className={styles.statusbar}>
      <div className={styles.timedate}>
        <div className={styles.time}>{time}</div>
        <div className={styles.date}>{date}</div>
      </div>
    </div>
  )
}

export default Statusbar
