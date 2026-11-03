import React, { useContext, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { DevModeContext } from '@/contexts/DevModeContext.js'
import { ModalContext } from '@/contexts/ModalContext.js'

import Loader from '@/components/Loader/Loader.js'

import styles from './Developer.module.css'

interface ServerInfo {
  running: boolean
  port: number | null
}

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
  const location = useLocation()
  const { openModals, setModalOpen } = useContext(ModalContext)
  const { devMode } = useContext(DevModeContext)

  function onClickBackground(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) setModalOpen('developer', false)
  }

  const [carThingState, setCarThingState] = useState<CarThingState | null>(
    null
  )
  const carThingStateRef = useRef(carThingState)
  const [hasCustomClient, setHasCustomClient] = useState(false)

  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null)
  const [clearedCache, setClearedCache] = useState<string | null>(null)

  useEffect(() => {
    const removeListener = window.api.on('carThingState', s => {
      const state = s as CarThingState

      setCarThingState(state)
      carThingStateRef.current = state
    })

    const removeServerInfoListener = window.api.on('serverStatus', up =>
      setServerInfo(up as ServerInfo)
    )

    const timeout = setTimeout(() => {
      if (carThingStateRef.current !== null) return

      window.api.triggerCarThingStateUpdate()
    }, 200)

    window.api.getServerInfo().then(setServerInfo)

    return () => {
      clearTimeout(timeout)
      removeListener()
      removeServerInfoListener()
    }
  }, [])

  const updateHasCustomClient = async () =>
    setHasCustomClient(await window.api.hasCustomClient())

  useEffect(() => {
    updateHasCustomClient()
  }, [])

  useEffect(() => {
    if (!devMode) setModalOpen('developer', false)
  }, [devMode])

  useEffect(() => {
    if (!clearedCache) return
    const timeout = setTimeout(() => setClearedCache(null), 3000)
    return () => clearTimeout(timeout)
  }, [clearedCache])

  async function clearCache(key: string, label: string) {
    await window.api.setStorageValue(key, null)
    setClearedCache(label)
  }

  return (
    <div
      className={styles.developer}
      data-open={openModals.includes('developer')}
      onClick={onClickBackground}
    >
      <div className={styles.box}>
        <h2>
          Developer
          <button onClick={() => setModalOpen('developer', false)}>
            <span className="material-icons">close</span>
          </button>
        </h2>
        <div className={styles.section}>
          <div className={styles.status}>
            {carThingState === CarThingState.Ready ? (
              <span className="material-icons" style={{ color: '#4caf50' }}>
                check_circle
              </span>
            ) : carThingState === CarThingState.Installing ||
              carThingState === null ? (
              <Loader />
            ) : (
              <span className="material-icons" style={{ color: '#f44336' }}>
                error
              </span>
            )}
            {carThingState === CarThingState.NotFound
              ? 'Car Thing not found'
              : carThingState === CarThingState.NotInstalled
                ? 'Car Thing not installed'
                : carThingState === CarThingState.Installing
                  ? 'Car Thing is installing'
                  : carThingState === CarThingState.Ready
                    ? 'Car Thing is ready'
                    : 'Car Thing state unknown'}
          </div>
          <div className={styles.actions}>
            <button
              onClick={() => window.api.installApp()}
              disabled={
                ![
                  CarThingState.Ready,
                  CarThingState.NotInstalled
                ].includes(carThingState!)
              }
            >
              <span className="material-icons">download</span>
              Force Install
            </button>

            {hasCustomClient ? (
              <button
                onClick={() =>
                  window.api
                    .removeCustomClient()
                    .then(updateHasCustomClient)
                }
                data-type="danger"
                disabled={
                  ![
                    CarThingState.Ready,
                    CarThingState.NotInstalled
                  ].includes(carThingState!)
                }
              >
                <span className="material-icons">brush</span>
                Remove Custom
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
                disabled={
                  ![
                    CarThingState.Ready,
                    CarThingState.NotInstalled
                  ].includes(carThingState!)
                }
              >
                <span className="material-icons">brush</span>
                Install Custom
              </button>
            )}
            <button
              data-type="danger"
              onClick={() =>
                window.api.setStorageValue(
                  'installAutomatically',
                  false
                ) && window.api.restoreCarThing()
              }
              disabled={
                ![
                  CarThingState.Ready,
                  CarThingState.NotInstalled
                ].includes(carThingState!)
              }
            >
              <span className="material-icons">
                settings_backup_restore
              </span>
              Restore
            </button>
            <button
              onClick={() => window.api.forwardSocketServer()}
              disabled={carThingState !== CarThingState.Ready}
            >
              <span className="material-icons">swap_horiz</span>
              Forward Socket
            </button>
            <button
              data-type="danger"
              onClick={() => window.api.rebootCarThing()}
              disabled={
                ![
                  CarThingState.Ready,
                  CarThingState.NotInstalled
                ].includes(carThingState!)
              }
            >
              <span className="material-icons">refresh</span>
              Reboot
            </button>
          </div>
        </div>
        {serverInfo ? (
          <div className={styles.section}>
            <div className={styles.status}>
              <span
                className="material-icons"
                style={{ color: serverInfo.running ? '#4caf50' : '#f44336' }}
              >
                {serverInfo.running ? 'check_circle' : 'error'}
              </span>
              {serverInfo.running
                ? `Server is running on port ${serverInfo.port}`
                : 'Server is stopped'}
            </div>
            <div className={styles.actions}>
              <button
                onClick={() => window.api.startServer()}
                disabled={serverInfo.running}
              >
                <span className="material-icons">play_arrow</span>
                Start
              </button>
              <button
                data-type="danger"
                onClick={() => window.api.stopServer()}
                disabled={!serverInfo.running}
              >
                <span className="material-icons">block</span>
                Stop
              </button>
            </div>
          </div>
        ) : null}
        <div className={styles.section}>
          <div className={styles.actions}>
            <button
              onClick={() =>
                clearCache('spotify_lyrics_cache', 'Lyrics cache cleared')
              }
            >
              <span className="material-icons">lyrics</span>
              Clear Lyrics Cache
            </button>
            <button
              onClick={() =>
                clearCache(
                  'spotify_playlist_image_cache',
                  'Playlist image cache cleared'
                )
              }
            >
              <span className="material-icons">image</span>
              Clear Playlist Image Cache
            </button>
          </div>
          {clearedCache && (
            <p className={styles.success}>
              <span className="material-icons">check_circle</span>
              {clearedCache}
            </p>
          )}
        </div>
        <div className={styles.bottomActions}>
          {location.pathname === '/setup' ? (
            <button onClick={() => navigate('/')}>
              <span className="material-icons">logout</span>
              Leave Setup
            </button>
          ) : (
            <button onClick={() => navigate('/setup?step=3')}>
              <span className="material-icons">tune</span>
              Enter Setup
            </button>
          )}
          <button onClick={() => window.api.openDevTools()}>
            <span className="material-icons">build</span>
            Open DevTools
          </button>
        </div>
      </div>
    </div>
  )
}

export default Developer
