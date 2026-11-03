import React from 'react'

import styles from './InterludeDots.module.css'

interface InterludeDotsProps {
  active: boolean
  playing: boolean
  progress: number
  className?: string
}

const InterludeDots: React.FC<InterludeDotsProps> = ({
  active,
  playing,
  progress,
  className
}) => (
  <div
    className={`${styles.dots} ${className ?? ''}`}
    data-playing={active && playing}
  >
    {[0, 1, 2].map(d => (
      <span
        key={d}
        style={
          active
            ? {
                opacity:
                  0.3 + 0.7 * Math.min(Math.max(progress * 3 - d, 0), 1)
              }
            : undefined
        }
      />
    ))}
  </div>
)

export default InterludeDots
