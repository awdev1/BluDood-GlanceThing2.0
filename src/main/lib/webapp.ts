import { app, dialog } from 'electron'
import axios from 'axios'
import path from 'path'
import fs from 'fs'

import {
  execAsync,
  getPlatformTar,
  isDev,
  log,
  LogLevel
} from './utils.js'

export async function getWebAppDir() {
  if (isDev() && hasCustomWebApp()) {
    log('Using custom client webapp', 'Client Webapp')
    return path.join(app.getPath('userData'), 'customClient')
  }

  if (isDev() && fs.existsSync(path.join(process.cwd(), 'client/dist'))) {
    log('Using local client webapp', 'Client Webapp')
    return path.join(process.cwd(), 'client/dist')
  }

  log('Downloading...', 'Client Webapp')
  const version = app.getVersion()
  const tempDir = app.getPath('temp')

  const zipPath = path.join(tempDir, `glancething-client-v${version}.zip`)
  const extractPath = path.join(tempDir, `glancething-client-v${version}`)

  if (fs.existsSync(zipPath)) fs.rmSync(zipPath)

  if (fs.existsSync(extractPath))
    fs.rmSync(extractPath, { recursive: true })

  const url = `https://github.com/BluDood/GlanceThing/releases/download/v${version}/glancething-client-v${version}.zip`

  const res = await axios.get(url, {
    responseType: 'stream',
    validateStatus: () => true
  })

  if (res.status !== 200) {
    log(
      'Failed to download client webapp',
      'Client Webapp',
      LogLevel.ERROR
    )
    throw new Error('webapp_download_failed')
  }

  const writeStream = fs.createWriteStream(zipPath)

  res.data.pipe(writeStream)

  await new Promise<void>((resolve, reject) => {
    writeStream.on('finish', resolve)
    writeStream.on('error', reject)
  })

  log(
    'Sucessfully downloaded, extracting...',
    'Client Webapp',
    LogLevel.DEBUG
  )

  if (!fs.existsSync(extractPath)) fs.mkdirSync(extractPath)

  const extract = await execAsync(
    `${getPlatformTar()} -xf ${zipPath} -C ${extractPath}`
  ).catch(() => null)

  if (extract === null) {
    log('Failed to extract client webapp', 'Client Webapp', LogLevel.ERROR)
    throw new Error('webapp_extract_failed')
  }

  log('Downloaded!', 'Client Webapp')

  return extractPath
}

export function hasCustomWebApp() {
  const userData = app.getPath('userData')
  const clientFolder = path.join(userData, 'customClient')

  if (fs.existsSync(clientFolder)) return true

  return false
}

export async function importCustomWebApp() {
  const res = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'GlanceThing Client', extensions: ['zip'] }]
  })

  if (res.canceled) return false

  const imagePath = res.filePaths[0]

  const userData = app.getPath('userData')
  const clientFolder = path.join(userData, 'customClient')
  const target = path.join(clientFolder, `client.zip`)

  if (!fs.existsSync(`${userData}/customClient`))
    fs.mkdirSync(`${userData}/customClient`)

  fs.copyFileSync(imagePath, target)

  log('Extracting custom client', 'Client Webapp')

  const extract = await execAsync(
    `${getPlatformTar()} -xf ${target} -C ${clientFolder}`
  ).catch(() => null)

  fs.rmSync(target)

  if (extract === null) {
    log('Failed to extract custom client', 'Client Webapp', LogLevel.ERROR)
    throw new Error('extract_failed')
  }

  if (!fs.existsSync(path.join(clientFolder, 'index.html'))) {
    fs.rmSync(clientFolder, { recursive: true })
    log('Invalid custom client uploaded', 'Client Webapp', LogLevel.ERROR)
    throw new Error('invalid_custom_client')
  }

  log('Extracted custom client', 'Client Webapp')

  return true
}

export async function removeCustomWebApp() {
  const userData = app.getPath('userData')
  const clientFolder = path.join(userData, 'customClient')

  if (fs.existsSync(clientFolder))
    fs.rmSync(clientFolder, { recursive: true })

  return true
}
