import React, { useEffect, useState } from 'react'

import styles from './Playback.module.css'

import Spotify from './providers/Spotify/Spotify.js'
import SpotifyFree from './providers/SpotifyFree/SpotifyFree.js' // New import for Spotify Free
import None from './providers/None/None.js'
import Native from './providers/Native/Native.js'

interface PlaybackProps {
  onStepComplete: () => void
}

enum State {
  Pending,
  Complete
}

const Playback: React.FC<PlaybackProps> = ({ onStepComplete }) => {
  const [state, setState] = useState<State>(0)
  const [selectedProvider, setSelectedProvider] = useState<string | null>(
    null
  )

  useEffect(() => {
    setState(State.Pending)
  }, [selectedProvider])

  async function complete() {
    await window.api.setStorageValue('playbackHandler', selectedProvider)
    if ((await window.api.getStorageValue('setupComplete')) === true)
      await window.api.restartPlaybackHandler()
    onStepComplete()
  }

  return (
    <div className={styles.playback}>
      <p className={styles.step}>Step 3</p>
      <h1>Setting up Playback</h1>
      <p>
        Choose a media provider you would like to use with GlanceThing from
        the list below.
      </p>
      <div className={styles.providers}>
        <button
          className={styles.provider}
          onClick={() => setSelectedProvider('none')}
          data-selected={selectedProvider === 'none'}
        >
          <span className="material-icons">block</span>
          Disable
        </button>
        <button
          className={styles.provider}
          onClick={() => setSelectedProvider('spotify')}
          data-selected={selectedProvider === 'spotify'}
        >
          <span className="material-icons">rss_feed</span>
          Spotify Premium
        </button>
        <button
          className={styles.provider}
          onClick={() => setSelectedProvider('spotifyfree')}
          data-selected={selectedProvider === 'spotifyfree'}
        >
          <span className="material-icons">rss_feed</span>
          Spotify Free
        </button>
        <button
          className={styles.provider}
          onClick={() => setSelectedProvider('native')}
          data-selected={selectedProvider === 'native'}
        >
          <span className="material-icons">settings_input_component</span>
          Native
        </button>
      </div>
      <div className={styles.setup} key={selectedProvider}>
        {selectedProvider === 'none' ? (
          <None onStepComplete={() => setState(State.Complete)} />
        ) : selectedProvider === 'spotify' ? (
          <Spotify onStepComplete={complete} />
        ) : selectedProvider === 'spotifyfree' ? (
          <SpotifyFree onStepComplete={complete} />
        ) : selectedProvider === 'native' ? (
          <Native onStepComplete={complete} />
        ) : null}
      </div>
      <div className={styles.buttons}>
        {state === State.Complete ? (
          <button onClick={complete}>Continue</button>
        ) : null}
      </div>
    </div>
  )
}

export default Playback
