import { Client } from '@xhayper/discord-rpc'

import { getStorageValue } from './storage.js'
import { serverManager } from './server.js'
import { log, LogLevel } from './utils.js'

import { AuthenticatedWebSocket } from '../types/WebSocketServer.js'

export interface DiscordState {
  connected: boolean
  inCall: boolean
  channel: string | null
  mute: boolean
  deaf: boolean
}

const LIVE_RETRY_MS = 5000
const DOWN_RETRY_MS = 30000

let client: Client | null = null
let retryTimeout: NodeJS.Timeout | null = null

let state: DiscordState = {
  connected: false,
  inCall: false,
  channel: null,
  mute: false,
  deaf: false
}

export function getDiscordState() {
  return state
}

function broadcast() {
  const wss = serverManager.getServer()
  if (!wss) return

  wss.clients.forEach((ws: AuthenticatedWebSocket) => {
    if (!ws.authenticated || ws.readyState !== 1) return
    ws.send(JSON.stringify({ type: 'discord', data: state }))
  })
}

function setState(update: Partial<DiscordState>) {
  state = { ...state, ...update }
  broadcast()
}

function scheduleRetry(delay: number) {
  if (retryTimeout) return
  retryTimeout = setTimeout(() => {
    retryTimeout = null
    startDiscord()
  }, delay)
}

async function withClient<T>(
  fn: (c: Client) => Promise<T>
): Promise<T | void> {
  const c = client
  if (!c || !c.isConnected) {
    log('Request while disconnected, reconnecting', 'Discord', LogLevel.WARN)
    setState({ connected: false, inCall: false, channel: null })
    scheduleRetry(LIVE_RETRY_MS)
    return
  }

  try {
    return await fn(c)
  } catch (error) {
    log(`Request failed: ${error}`, 'Discord', LogLevel.ERROR)
    setState({ connected: false, inCall: false, channel: null })
    scheduleRetry(LIVE_RETRY_MS)
  }
}

async function refreshState() {
  await withClient(async c => {
    const [channel, settings] = await Promise.all([
      c.request('GET_SELECTED_VOICE_CHANNEL'),
      c.request('GET_VOICE_SETTINGS')
    ])

    setState({
      inCall: !!channel.data,
      channel: channel.data?.name ?? null,
      mute: !!settings.data?.mute,
      deaf: !!settings.data?.deaf
    })
  })
}

export async function stopDiscord() {
  if (retryTimeout) {
    clearTimeout(retryTimeout)
    retryTimeout = null
  }

  const current = client
  client = null
  setState({ connected: false, inCall: false, channel: null })
  await current?.destroy().catch(() => null)
}

export async function startDiscord() {
  await stopDiscord()

  const clientId = getStorageValue('discordClientId') as string | null
  const clientSecret = getStorageValue('discordClientSecret', true) as
    | string
    | null
  if (!clientId || !clientSecret) return

  const instance = new Client({ clientId, clientSecret })
  client = instance

  instance.on('disconnected', () => {
    if (client !== instance) return
    client = null
    log(`Disconnected, retrying in ${LIVE_RETRY_MS / 1000}s`, 'Discord', LogLevel.WARN)
    setState({ connected: false, inCall: false, channel: null })
    scheduleRetry(LIVE_RETRY_MS)
  })

  instance.on('VOICE_SETTINGS_UPDATE', data => {
    const settings = data as { mute?: boolean; deaf?: boolean }
    setState({ mute: !!settings.mute, deaf: !!settings.deaf })
  })

  instance.on('VOICE_CHANNEL_SELECT', data => {
    const { channel_id } = (data ?? {}) as { channel_id?: string | null }
    log(channel_id ? 'Joined a voice call' : 'Left the voice call', 'Discord')
    setState({
      inCall: !!channel_id,
      channel: channel_id ? state.channel : null
    })
    if (channel_id) setTimeout(() => refreshState(), 1000)
  })

  try {
    await instance.login({
      scopes: ['rpc', 'rpc.voice.read', 'rpc.voice.write'],
      prompt: 'none'
    })

    await instance.subscribe('VOICE_SETTINGS_UPDATE')
    await instance.subscribe('VOICE_CHANNEL_SELECT')

    setState({ connected: true })
    log('Connected', 'Discord')
    await refreshState()
  } catch (error) {
    log(`Failed to connect: ${error}`, 'Discord', LogLevel.ERROR)
    if (client === instance) {
      client = null
      setState({ connected: false, inCall: false, channel: null })
      scheduleRetry(DOWN_RETRY_MS)
    }
  }
}

export async function toggleMute() {
  await withClient(c =>
    c.request('SET_VOICE_SETTINGS', { mute: !state.mute })
  )
}

export async function toggleDeafen() {
  await withClient(c =>
    c.request('SET_VOICE_SETTINGS', { deaf: !state.deaf })
  )
}

export async function leaveCall() {
  await withClient(c =>
    c.request('SELECT_VOICE_CHANNEL', { channel_id: null, force: true })
  )
}
