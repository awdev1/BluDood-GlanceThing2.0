import { exec } from 'child_process'
import { app, dialog } from 'electron'
import { platform } from 'os'
import crypto from 'crypto'
import path from 'path'
import net from 'net'
import fs from 'fs'

import { getStorageValue } from './storage.js'

export const isDev = () => getStorageValue('devMode') === true

export const random = (len: number) =>
  crypto.randomBytes(len).toString('hex')

export async function execAsync(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout) => {
      if (error) {
        reject(error)
      } else {
        resolve(stdout)
      }
    })
  })
}

let logPath: string | null = null

export enum LogLevel {
  DEBUG,
  INFO,
  WARN,
  ERROR
}

const logLevelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR']

let logLevel = LogLevel.INFO

export function setLogLevel(level: LogLevel) {
  logLevel = level
}

export function getLogLevel() {
  return logLevel
}

const logs: string[] = []

export function getLogs() {
  return logs
}

export async function downloadLogs() {
  const savePath = await dialog.showSaveDialog({
    title: 'Save logs',
    filters: [{ name: 'Log files', extensions: ['log'] }]
  })

  if (savePath.canceled) return null

  if (savePath) {
    fs.writeFileSync(savePath.filePath, logs.join('\n'), 'utf-8')

    return savePath
  }

  return null
}

export function clearLogs() {
  logs.length = 0
  log('Logs were cleared')
}

export function log(text: string, scope?: string, level = LogLevel.INFO) {
  if (level < logLevel) return

  if (!logPath)
    logPath = path.join(app.getPath('userData'), 'glancething.log')

  const time = new Date().toLocaleTimeString([], {
    hour12: false,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
  })

  const levelName = logLevelNames[level]

  const log = `[${time}] ${levelName}${scope ? ` <${scope}>:` : ''} ${text}`

  console.log(log)
  fs.appendFileSync(logPath, log + '\n')

  logs.push(log)
  if (logs.length > 1000) logs.shift()
}

export function safeParse(json: string) {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

export async function findOpenPort() {
  return new Promise<number>(resolve => {
    const server = net.createServer()

    server.listen(0, () => {
      const port = (server.address() as net.AddressInfo).port
      server.close(() => resolve(port))
    })
  })
}

export function getParsedPlatformCommand(command: string) {
  const os = platform()

  switch (os) {
    case 'darwin':
      return { cmd: command, shell: '/bin/sh' }

    default:
      return { cmd: `& ${command}`, shell: 'powershell.exe' }
  }
}

export function getLockPlatformCommand() {
  const os = platform()

  switch (os) {
    case 'darwin':
      return {
        cmd: 'pmset displaysleepnow',
        shell: '/bin/sh'
      }

    default:
      return {
        cmd: 'rundll32.exe user32.dll,LockWorkStation',
        shell: 'powershell.exe'
      }
  }
}

export function getPlatformADB() {
  const os = platform()

  switch (os) {
    case 'darwin':
      return {
        downloadURL:
          'https://dl.google.com/android/repository/platform-tools-latest-darwin.zip',
        executable: 'adb'
      }

    default:
      return {
        downloadURL:
          'https://dl.google.com/android/repository/platform-tools-latest-windows.zip',
        executable: 'adb.exe'
      }
  }
}

export function getPlatformTar() {
  const os = platform()

  switch (os) {
    case 'win32':
      return `${process.env.SystemRoot}\\System32\\tar.exe`

    default:
      return 'tar'
  }
}

export const isNightly = app.getName().endsWith('-nightly')

export const resourceFolder = path.join(
  process.env.NODE_ENV === 'development'
    ? app.getAppPath()
    : `${path.join(process.resourcesPath, 'app.asar.unpacked')}`,
  'resources',
  isNightly ? 'nightly' : 'stable'
)

export type rgb = {
  r: number
  g: number
  b: number
}

export function intToRgb(colorInt: number): rgb {
  if (colorInt < 0) {
    colorInt = 0xffffffff + colorInt + 1
  }

  const r = (colorInt >> 16) & 0xff
  const g = (colorInt >> 8) & 0xff
  const b = colorInt & 0xff

  return { r, g, b }
}

export function base32FromBytes(
  bytes: Uint8Array,
  secretSauce: string
): string {
  let t = 0
  let n = 0
  let r = ''

  for (let i = 0; i < bytes.length; i++) {
    n = (n << 8) | bytes[i]
    t += 8
    while (t >= 5) {
      r += secretSauce[(n >>> (t - 5)) & 31]
      t -= 5
    }
  }

  if (t > 0) {
    r += secretSauce[(n << (5 - t)) & 31]
  }

  return r
}

export function cleanBuffer(e: string): Uint8Array {
  e = e.replace(' ', '')
  const buffer = new Uint8Array(e.length / 2)
  for (let i = 0; i < e.length; i += 2) {
    buffer[i / 2] = parseInt(e.substring(i, i + 2), 16)
  }
  return buffer
}
