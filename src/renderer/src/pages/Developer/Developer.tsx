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
    'Invalid custom client uploaded. The ZIP must directly contain files like index.html.'
}

const Developer: React.FC = () => {
  const navigate = useNavigate()
  const [carThingState, setCarThingState] = useState<CarThingState | null>(null)
  const [hasCustomClient, setHasCustomClient] = useState(false)
  const [serverStarted, setServerStarted] = useState(false)
  const [lyricsCleared, setLyricsCleared] = useState(false)
  const [playlistCleared, setPlaylistCleared] = useState(false)
  const carThingRef = useRef(carThingState)

  const updateHasCustomClient = async () =>
    setHasCustomClient(await window.api.hasCustomClient())

  useEffect(() => {
    const interval = setInterval(async () => {
      setServerStarted(await window.api.isServerStarted())
    }, 1000)

    const removeListener = window.api.on('carThingState', s => {
      const state = s as CarThingState
      setCarThingState(state)
      carThingRef.current = state
    })

    const timeout = setTimeout(() => {
      if (carThingRef.current === null) {
        window.api.triggerCarThingStateUpdate()
      }
    }, 200)

    updateHasCustomClient()

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
      removeListener()
    }
  }, [])

  const clearCache = async (key: string, setFn: React.Dispatch<React.SetStateAction<boolean>>) => {
    await window.api.setStorageValue(key, null)
    setFn(true)
    setTimeout(() => setFn(false), 3000)
  }

  return (
    <div className={styles.container}>
      <h1>Developer</h1>
      <Link to="/" className={styles.backLink}>← Home</Link>

      <section>
        <h2>CarThing</h2>
        <p>Status: <code>{carThingState || 'checking...'}</code></p>
        <div className={styles.group}>
          <button onClick={() => window.api.installApp()}>Install Web App</button>
          {hasCustomClient ? (
            <button onClick={() => window.api.removeCustomClient().then(updateHasCustomClient)} className={styles.danger}>
              Remove Custom App
            </button>
          ) : (
            <button
              onClick={() =>
                window.api.importCustomClient().then(res => {
                  if (typeof res === 'string') alert(customClientErrors[res] || res)
                  updateHasCustomClient()
                })
              }
            >
              Import Custom App
            </button>
          )}
        </div>
        <div className={styles.group}>
          <button onClick={() => window.api.forwardSocketServer()}>Forward Socket</button>
          <button onClick={() => window.api.rebootCarThing()}>Reboot</button>
        </div>
      </section>

      <section>
        <h2>Server</h2>
        <div className={styles.group}>
          <button onClick={() => serverStarted ? window.api.stopServer() : window.api.startServer()}>
            {serverStarted ? 'Stop' : 'Start'} WebSocket Server
          </button>
        </div>
        <div className={styles.group}>
          <button onClick={() => clearCache('spotify_lyrics_cache', setLyricsCleared)}>
            Clear Lyrics Cache
          </button>
          {lyricsCleared && <span className={styles.success}>✓ Lyrics cache cleared</span>}
        </div>
        <div className={styles.group}>
          <button onClick={() => clearCache('spotify_playlist_image_cache', setPlaylistCleared)}>
            Clear Playlist Image Cache
          </button>
          {playlistCleared && <span className={styles.success}>✓ Playlist image cache cleared</span>}
        </div>
      </section>

      <section>
        <h2>Tools</h2>
        <div className={styles.group}>
          <button onClick={() => navigate('/setup?step=3')}>Go to Setup</button>
          <button onClick={() => window.api.openDevTools()}>Open DevTools</button>
        </div>
      </section>
    </div>
  )
}

export default Developer