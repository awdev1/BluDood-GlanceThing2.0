import os from 'os'
import fs from 'fs'
import { exec } from 'child_process'

import { getStorageValue } from './storage.js'
import { serverManager } from './server.js'

import { AuthenticatedWebSocket } from '../types/WebSocketServer.js'

let lastCpu: { idle: number; total: number } | null = null
let lastNet: { rx: number; tx: number; time: number } | null = null

function readCpu() {
  return os.cpus().reduce(
    (acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0)
      return { idle: acc.idle + cpu.times.idle, total: acc.total + total }
    },
    { idle: 0, total: 0 }
  )
}

function cpuUsage() {
  const now = readCpu()
  const prev = lastCpu
  lastCpu = now
  if (!prev || now.total === prev.total) return null
  return 1 - (now.idle - prev.idle) / (now.total - prev.total)
}

function diskUsage() {
  try {
    const root =
      process.platform === 'win32'
        ? `${process.env.SystemDrive ?? 'C:'}\\`
        : '/'
    const { blocks, bavail, bsize } = fs.statfsSync(root)
    return { used: (blocks - bavail) * bsize, total: blocks * bsize }
  } catch {
    return null
  }
}

async function readNetwork(): Promise<{ rx: number; tx: number } | null> {
  if (process.platform === 'linux') {
    const lines = fs.readFileSync('/proc/net/dev', 'utf8').split('\n').slice(2)
    return lines.reduce(
      (acc, line) => {
        const [name, data] = line.trim().split(':')
        if (!data || name === 'lo') return acc
        const fields = data.trim().split(/\s+/).map(Number)
        return { rx: acc.rx + fields[0], tx: acc.tx + fields[8] }
      },
      { rx: 0, tx: 0 }
    )
  }

  const command =
    process.platform === 'win32'
      ? {
          cmd: '(Get-NetAdapterStatistics | Measure-Object -Property ReceivedBytes,SentBytes -Sum).Sum -join " "',
          shell: 'powershell.exe'
        }
      : {
          cmd: "netstat -ibn | awk '$1 !~ /^lo/ && $3 ~ /Link/ {rx+=$7; tx+=$10} END {print rx, tx}'",
          shell: '/bin/sh'
        }

  const output = await new Promise<string | null>(resolve =>
    exec(command.cmd, { shell: command.shell }, (error, stdout) =>
      resolve(error ? null : stdout)
    )
  )
  if (!output) return null

  const [rx, tx] = String(output).trim().split(/\s+/).map(Number)
  if (isNaN(rx) || isNaN(tx)) return null
  return { rx, tx }
}

async function networkSpeed() {
  const now = await readNetwork()
  if (!now) return null

  const time = Date.now()
  const prev = lastNet
  lastNet = { ...now, time }
  if (!prev) return null

  const seconds = (time - prev.time) / 1000
  return {
    down: Math.max(0, (now.rx - prev.rx) / seconds),
    up: Math.max(0, (now.tx - prev.tx) / seconds)
  }
}

export async function updateStats() {
  if (getStorageValue('showStatsWidget') !== true) return

  const wss = serverManager.getServer()
  if (!wss) return

  const data = {
    cpu: cpuUsage(),
    memory: {
      used: os.totalmem() - os.freemem(),
      total: os.totalmem()
    },
    disk: diskUsage(),
    network: await networkSpeed()
  }

  wss.clients.forEach((ws: AuthenticatedWebSocket) => {
    if (!ws.authenticated || ws.readyState !== 1) return
    ws.send(JSON.stringify({ type: 'stats', data }))
  })
}
