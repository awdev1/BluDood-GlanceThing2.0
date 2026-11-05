import React, { useContext, useEffect, useState } from 'react'

import { SocketContext } from '@/contexts/SocketContext.tsx'
import BaseWidget from '../BaseWidget/BaseWidget.tsx'

import styles from './Stats.module.css'

interface Usage {
  used: number
  total: number
}

interface StatsData {
  cpu: number | null
  memory: Usage
  disk: Usage | null
  network: { down: number; up: number } | null
}

interface StatsProps {
  visible: boolean
}

const RADIUS = 54
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function formatBytes(bytes: number) {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(unit > 0 ? 1 : 0)} ${units[unit]}`
}

const Gauge: React.FC<{
  title: string
  fraction: number | null
  children: React.ReactNode
}> = ({ title, fraction, children }) => (
  <div className={styles.gauge}>
    <p className={styles.title}>{title}</p>
    <div className={styles.ring}>
      <svg viewBox="0 0 128 128">
        <circle className={styles.track} cx="64" cy="64" r={RADIUS} />
        <circle
          className={styles.fill}
          cx="64"
          cy="64"
          r={RADIUS}
          strokeDasharray={`${CIRCUMFERENCE * Math.min(Math.max(fraction ?? 0, 0), 1)} ${CIRCUMFERENCE}`}
        />
      </svg>
      <div className={styles.center}>{children}</div>
    </div>
  </div>
)

const UsageText: React.FC<{ label: string; usage: Usage; total: string }> = ({
  label,
  usage,
  total
}) => (
  <>
    <span className={styles.caption}>{label}</span>
    <span>{formatBytes(usage.used)}</span>
    <span>{formatBytes(usage.total)}</span>
    <span className={styles.caption}>{total}</span>
  </>
)

const Stats: React.FC<StatsProps> = ({ visible }) => {
  const { ready, socket } = useContext(SocketContext)
  const [stats, setStats] = useState<StatsData | null>(null)

  useEffect(() => {
    if (!ready || !socket) return

    const listener = (e: MessageEvent) => {
      const { type, data } = JSON.parse(e.data)
      if (type === 'stats') setStats(data)
    }

    socket.addEventListener('message', listener)
    return () => socket.removeEventListener('message', listener)
  }, [ready, socket])

  return (
    <BaseWidget className={styles.stats} visible={visible}>
      {stats ? (
        <div className={styles.content}>
          <div className={styles.gauges}>
            <Gauge
              title="Memory"
              fraction={stats.memory.used / stats.memory.total}
            >
              <UsageText label="Used" usage={stats.memory} total="Total" />
            </Gauge>
            {stats.disk && (
              <Gauge
                title="Disk"
                fraction={stats.disk.used / stats.disk.total}
              >
                <UsageText
                  label="Used Space"
                  usage={stats.disk}
                  total="Total Space"
                />
              </Gauge>
            )}
            <Gauge title="CPU" fraction={stats.cpu}>
              <span className={styles.value}>
                {stats.cpu === null
                  ? '...'
                  : `${(stats.cpu * 100).toFixed(1)}%`}
              </span>
            </Gauge>
          </div>
          {stats.network && (
            <p className={styles.network}>
              <span className="material-icons">south</span>
              {formatBytes(stats.network.down)}/s
              <span className={`material-icons ${styles.up}`}>north</span>
              {formatBytes(stats.network.up)}/s
            </p>
          )}
        </div>
      ) : (
        <p className={styles.waiting}>Waiting for stats...</p>
      )}
    </BaseWidget>
  )
}

export default Stats
