import React from 'react'
import { useDrag } from '@use-gesture/react'

import styles from './SwipeHandle.module.css'

interface SwipeHandleProps {
  onClose: () => void
  enabled?: boolean
}

const SwipeHandle: React.FC<SwipeHandleProps> = ({
  onClose,
  enabled = true
}) => {
  const bind = useDrag(
    ({ tap, last, movement: [, my], velocity: [, vy], direction: [, dy] }) => {
      if (!enabled || !last) return
      if (tap || (dy > 0 && (my > 60 || vy > 0.4))) onClose()
    },
    {
      filterTaps: true,
      pointer: { touch: true }
    }
  )

  return (
    <div className={styles.handle} {...bind()}>
      <div className={styles.bar} />
    </div>
  )
}

export default SwipeHandle
