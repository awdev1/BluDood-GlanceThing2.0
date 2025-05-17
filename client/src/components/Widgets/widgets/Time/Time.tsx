import { useContext } from 'react'
import BaseWidget from '../BaseWidget/BaseWidget.tsx'
import styles from './Time.module.css'
import { AppStateContext } from '@/contexts/AppStateContext.tsx'

interface TimeProps {
  visible: boolean
}

const Time: React.FC<TimeProps> = ({ visible }) => {
  const { time, date } = useContext(AppStateContext)

  return (
    <BaseWidget className={styles.timedate} visible={visible}>
      <div className={styles.time}>{time}</div>
      <div className={styles.date}>{date}</div>
    </BaseWidget>
  )
}

export default Time
