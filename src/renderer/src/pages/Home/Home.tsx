import React, { useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { DevModeContext } from '@/contexts/DevModeContext.js'

import icon from '@/assets/icon.png'
import iconNightly from '@/assets/icon-nightly.png'

import styles from './Home.module.css'
import { ChannelContext } from '@/contexts/ChannelContext.js'

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
  const [hasCustomClient, setHasCustomClient] = useState(false)

  const [carThingState, setCarThingState] = useState<CarThingState | null>(
    null
  )
  const carThingStateRef = useRef(carThingState)
  const [needsPlaybackSetup, setNeedsPlaybackSetup] = useState(false)

  useEffect(() => {
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

  return (
    <div className={styles.home}>
      <img src={channel === 'nightly' ? iconNightly : icon} alt="" />
      <h1>GlanceThing{channel === 'nightly' ? ' Nightly' : ''}</h1>
      <div className={styles.status}>
        {carThingState === CarThingState.NotFound ? (
          <>
            <p>
              CarThing not found. Please reconnect it to your computer, or
              run setup again.
            </p>
            <button onClick={() => navigate('/setup')}>
              Setup <span className="material-icons">arrow_forward</span>
            </button>
          </>
        ) : carThingState === CarThingState.NotInstalled ? (
          <>
            <p>CarThing found, but the app is not installed.</p>
            <button onClick={() => navigate('/setup')}>
              Setup <span className="material-icons">arrow_forward</span>
            </button>
          </>
        ) : carThingState === CarThingState.Installing ? (
          <p>
            CarThing found, but the app is not installed. Installing...
          </p>
        ) : carThingState === CarThingState.Ready ? (
          <p>CarThing is ready!</p>
        ) : (
          <p>Checking for CarThing...</p>
        )}
      </div>
      {needsPlaybackSetup && carThingState === CarThingState.Ready ? (
        <div className={styles.notice}>
          <p>You have not set up a playback handler yet!</p>
          <button onClick={() => navigate('/setup?step=3')}>
            Set up now
          </button>
        </div>
      ) : null}
      {devMode && hasCustomClient ? (
        <div className={styles.notice} data-type="warning">
          <p>
            <span className="material-icons">warning</span>
            You have a custom client installed!
          </p>
          <button
            data-type="danger"
            onClick={() =>
              window.api.removeCustomClient().then(updateHasCustomClient)
            }
          >
            Remove
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default Home
