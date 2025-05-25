import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import styles from './Developer.module.css'

enum CarThingState {
  NotFound = 'not_found',
  NotInstalled = 'not_installed',
  Installing = 'installing',
  Ready = 'ready'
}

const customClientErrors = {
  extract_failed: 'Failed to extract custom client',
  invalid_custom_client:
    'Invalid custom client uploaded. Please check if the zip file directly contains the client files (such as index.html).'
}

const Developer: React.FC = () => {
  const navigate = useNavigate()
  const [serverStarted, setServerStarted] = useState(false)
  const [lyricsCacheCleared, setLyricsCacheCleared] = useState(false)
  const [playlistImageCacheCleared, setPlaylistImageCacheCleared] =
    useState(false)

  const clearLyricsCache = async () => {
    await window.api.setStorageValue('spotify_lyrics_cache', null)
    setLyricsCacheCleared(true)

    setTimeout(() => {
      setLyricsCacheCleared(false)
    }, 3000)
  }

  const clearPlaylistImageCache = async () => {
    await window.api.setStorageValue('spotify_playlist_image_cache', null)
    setPlaylistImageCacheCleared(true)

    setTimeout(() => {
      setPlaylistImageCacheCleared(false)
    }, 3000)
  }

  const [carThingState, setCarThingState] = useState<CarThingState | null>(
    null
  )
  const carThingStateRef = useRef(carThingState)
  const [hasCustomClient, setHasCustomClient] = useState(false)

  useEffect(() => {
    async function checkServerStarted() {
      const started = await window.api.isServerStarted()
      setServerStarted(started)
    }

    const interval = setInterval(checkServerStarted, 1000)

    const removeListener = window.api.on('carThingState', s => {
      const state = s as CarThingState

      setCarThingState(state)
      carThingStateRef.current = state
    })

    const timeout = setTimeout(() => {
      if (carThingStateRef.current !== null) return

      window.api.triggerCarThingStateUpdate()
    }, 200)

    checkServerStarted()

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
      removeListener()
    }
  }, [])

  const updateHasCustomClient = async () =>
    setHasCustomClient(await window.api.hasCustomClient())

  useEffect(() => {
    updateHasCustomClient()
  }, [])

  return (
    <div className={styles.developer}>
      <h1>Developer</h1>
      <Link to="/">Back</Link>

      <h2>CarThing</h2>
      <p>State: {carThingState}</p>
      <div className={styles.buttons}>
        <button onClick={() => window.api.installApp()}>
          Install Web App
        </button>
        {hasCustomClient ? (
          <button
            onClick={() =>
              window.api.removeCustomClient().then(updateHasCustomClient)
            }
            data-type="danger"
          >
            Remove Custom Web App
          </button>
        ) : (
          <button
            onClick={() =>
              window.api.importCustomClient().then(res => {
                if (typeof res === 'string')
                  alert(customClientErrors[res] || res)

                updateHasCustomClient()
              })
            }
          >
            Import Custom Web App
          </button>
        )}
      </div>
      <div className={styles.buttons}>
        <button onClick={() => window.api.forwardSocketServer()}>
          Forward WebSocketServer
        </button>
      </div>
      <div className={styles.buttons}>
        <button onClick={() => window.api.rebootCarThing()}>
          Reboot CarThing
        </button>
      </div>

      <h2>Server</h2>
      <div className={styles.buttons}>
        {serverStarted ? (
          <button onClick={() => window.api.stopServer()}>
            Stop WebSocketServer
          </button>
        ) : (
          <button onClick={() => window.api.startServer()}>
            Start WebSocketServer
          </button>
        )}
      </div>
      <div className={styles.buttons}>
        <button onClick={clearLyricsCache}>
          Clear Spotify Lyrics Cache
        </button>
        {lyricsCacheCleared && (
          <span className={styles.successMessage}>
            Lyrics cache cleared successfully, please restart GlanceThing!
          </span>
        )}
      </div>
      <div className={styles.buttons}>
        <button onClick={clearPlaylistImageCache}>
          Clear Spotify Playlist Image Cache
        </button>
        {playlistImageCacheCleared && (
          <span className={styles.successMessage}>
            Playlist image cache cleared successfully, please restart
            GlanceThing!
          </span>
        )}
      </div>

      <h2>Links</h2>
      <div className={styles.buttons}>
        <button onClick={() => navigate('/setup?step=3')}>Setup</button>
        <button onClick={() => window.api.openDevTools()}>
          Open DevTools
        </button>
      </div>
    </div>
  )
}

export default Developer
