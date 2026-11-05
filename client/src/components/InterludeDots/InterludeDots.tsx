import React from 'react'

import styles from './InterludeDots.module.css'

interface InterludeDotsProps {
  active: boolean
  playing: boolean
  progress: number
  finished?: boolean
  className?: string
}

const InterludeDots: React.FC<InterludeDotsProps> = ({
  active,
  playing,
  progress,
  finished,
  className
}) => (
  <div
    className={`${styles.dots} ${className ?? ''}`}
    data-playing={active && playing}
    data-finished={!!finished}
  >
    {[0, 1, 2].map(d => {
      const fill = finished
        ? 1
        : active
          ? Math.min(Math.max(progress * 3 - d, 0), 1)
          : 0

      return (
        <span
          key={d}
          style={{
            opacity: 0.35 + 0.65 * fill,
            transform: `translateY(${-0.3 * Math.sin(fill * Math.PI)}em) scale(${0.8 + 0.3 * fill})`
          }}
        />
      )
    })}
  </div>
)

export default InterludeDots
