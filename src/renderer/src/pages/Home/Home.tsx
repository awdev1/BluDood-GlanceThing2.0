import React, { useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { DevModeContext } from '@/contexts/DevModeContext.js'
import { ChannelContext } from '@/contexts/ChannelContext.js'
import Loader from '@/components/Loader/Loader'
import icon from '@/assets/icon.png'
import iconNightly from '@/assets/icon-nightly.png'
import styles from './Home.module.css'

enum CarThingState {
  NotFound = 'not_found',
  NotInstalled = 'not_installed',
  Installing = 'installing',
  Ready = 'ready'
}

const Home: React.FC = () => {
  const navigate = useNavigate()
  const { devMode } = useContext(DevModeContext)
  const { channel } = useContext(ChannelContext)

  const [version, setVersion] = useState<string | null>(null)
  const [hasCustomClient, setHasCustomClient] = useState(false)
  const [carThingState, setCarThingState] = useState<CarThingState | null>(null)
  const carThingStateRef = useRef(carThingState)
  const [needsPlaybackSetup, setNeedsPlaybackSetup] = useState(false)

  useEffect(() => {
    window.api.getVersion().then(setVersion)

    window.api.getStorageValue('setupComplete').then(setupComplete => {
      if (!setupComplete) navigate('/setup')
    })

    const removeListener = window.api.on('carThingState', async s => {
      const state = s as CarThingState
      setCarThingState(state)
      carThingStateRef.current = state
    })

    const timeout = setTimeout(() => {
      if (carThingStateRef.current !== null) return
      window.api.triggerCarThingStateUpdate()
    }, 200)

    window.api.getStorageValue('playbackHandler').then(handler => {
      if (handler === null) setNeedsPlaybackSetup(true)
    })

    return () => {
      removeListener()
      clearTimeout(timeout)
    }
  }, [])

  const updateHasCustomClient = async () =>
    setHasCustomClient(await window.api.hasCustomClient())

  useEffect(() => {
    updateHasCustomClient()
  }, [devMode])

  const getStatusMessage = () => {
    switch (carThingState) {
      case CarThingState.NotFound:
        return 'CarThing not found. Please reboot or run setup again.'
      case CarThingState.NotInstalled:
        return 'CarThing found, but the app is not installed and auto install is off. Click "Run Setup" to reinstall.'
      case CarThingState.Installing:
        return 'Installing app to CarThing. This may take a moment...'
      case CarThingState.Ready:
        return 'CarThing is ready and running GlanceThing!'
      default:
        return 'Checking for a CarThing...'
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <img
          src={channel === 'nightly' ? iconNightly : icon}
          alt="GlanceThing Logo"
          className={styles.logo}
        />
        
        <h1 className={styles.title}>
          GlanceThing{channel === 'nightly' ? ' Nightly' : ''}
        </h1>
        {version && <p className={styles.version}>Version {version}</p>}
      <div className={styles.status}>
        {carThingState === CarThingState.Ready ? (
          <span className="material-icons" style={{ color: '#4caf50' }}>
            check_circle
          </span>
        ) : carThingState === CarThingState.Installing || carThingState === null ? (
          <Loader />
        ) : (
          <span className="material-icons" style={{ color: '#f44336' }}>
            error
          </span>
        )}
        <span>{getStatusMessage()}</span>
      </div>

        {needsPlaybackSetup && carThingState === CarThingState.Ready && (
          <button
            className={styles.button}
            onClick={() => navigate('/setup?step=3')}
          >
            Set up playback handler
          </button>
        )}

        {(carThingState === CarThingState.NotFound ||
          carThingState === CarThingState.NotInstalled) && (
          <button className={styles.button} onClick={() => navigate('/setup')}>
            Run Setup
          </button>
        )}

        {devMode && hasCustomClient && (
          <div className={styles.warning}>
            <span className="material-icons">warning</span>
            Custom client installed
            <button
              className={styles.dangerButton}
              onClick={() =>
                window.api.removeCustomClient().then(updateHasCustomClient)
              }
            >
              Remove
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Home