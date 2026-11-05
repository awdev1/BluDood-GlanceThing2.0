import React, { useEffect, useRef } from 'react'

import styles from './CoverBackground.module.css'

interface CoverBackgroundProps {
  image: string | null
  running: boolean
  className?: string
}

const SIZE = 16

const layers = [
  [
    { x: 0.5, y: 0.5, scale: 1.4, angle: 0 },
    { x: 0.2, y: 0.8, scale: 0.8, angle: 120 },
    { x: 0.8, y: 0.2, scale: 0.7, angle: 240 }
  ],
  [
    { x: 0.25, y: 0.3, scale: 0.7, angle: 60 },
    { x: 0.75, y: 0.75, scale: 0.8, angle: 180 }
  ]
]

const CoverBackground: React.FC<CoverBackgroundProps> = ({
  image,
  running,
  className
}) => {
  const backRef = useRef<HTMLCanvasElement>(null)
  const frontRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvases = [backRef.current, frontRef.current]

    if (!image) {
      canvases.forEach(c =>
        c?.getContext('2d')?.clearRect(0, 0, c.width, c.height)
      )
      return
    }

    const img = new Image()
    img.onload = () => {
      canvases.forEach((canvas, layer) => {
        if (!canvas) return
        canvas.width = SIZE
        canvas.height = SIZE

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.clearRect(0, 0, SIZE, SIZE)
        ctx.filter = 'blur(1.5px) saturate(1.6)'

        layers[layer].forEach(({ x, y, scale, angle }) => {
          const w = SIZE * scale
          ctx.save()
          ctx.translate(SIZE * x, SIZE * y)
          ctx.rotate((angle * Math.PI) / 180)
          ctx.beginPath()
          ctx.arc(0, 0, w / 2, 0, Math.PI * 2)
          ctx.clip()
          ctx.drawImage(img, -w / 2, -w / 2, w, w)
          ctx.restore()
        })
      })
    }
    img.src = image
  }, [image])

  return (
    <div
      className={`${styles.background} ${className ?? ''}`}
      data-running={running}
    >
      <canvas ref={backRef} />
      <canvas ref={frontRef} className={styles.front} />
    </div>
  )
}

export default CoverBackground
