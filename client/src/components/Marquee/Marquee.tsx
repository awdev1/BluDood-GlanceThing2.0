import React, { useEffect, useRef } from 'react'

import styles from './Marquee.module.css'

interface MarqueeProps {
  children: React.ReactNode
  className?: string
}

const SPEED = 30
const PAUSE = 1500

const Marquee: React.FC<MarqueeProps> = ({ children, className }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const text = textRef.current
    if (!container || !text) return

    const distance = text.scrollWidth - container.clientWidth
    container.dataset.overflowing = String(distance > 0)
    if (distance <= 0) return

    const travel = (distance / SPEED) * 1000
    const duration = travel + PAUSE * 2
    const hold = PAUSE / duration

    const animation = text.animate(
      [
        { transform: 'translateX(0)', offset: 0 },
        { transform: 'translateX(0)', offset: hold },
        { transform: `translateX(-${distance}px)`, offset: 1 - hold },
        { transform: `translateX(-${distance}px)`, offset: 1 }
      ],
      {
        duration,
        iterations: Infinity,
        direction: 'alternate',
        easing: 'linear'
      }
    )

    return () => animation.cancel()
  }, [children])

  return (
    <div
      ref={containerRef}
      className={`${styles.marquee} ${className ?? ''}`}
    >
      <span ref={textRef}>{children}</span>
    </div>
  )
}

export default Marquee
