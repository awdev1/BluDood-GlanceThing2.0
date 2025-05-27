import React, { useEffect, useRef, useState } from 'react'
import styles from './Spotify.module.css'
import Loader from '@/components/Loader/Loader.js'

interface SpotifyFreeProps {
  onStepComplete: () => void
}

enum SpotifyStep {
  Token
}

const SpotifyFree: React.FC<SpotifyFreeProps> = ({ onStepComplete }) => {
  const [step] = useState<SpotifyStep>(0)
  const [hasSetup, setHasSetup] = useState(false)

  useEffect(() => {
    window.api.getPlaybackHandlerConfig('spotifyfree').then(data => {
      if (data) setHasSetup(true)
    })
  }, [])

  return (
    <div className={styles.spotify}>
      {step === SpotifyStep.Token ? (
        <TokenSetup
          onStepComplete={data => {
            window.api.setPlaybackHandlerConfig('spotifyfree', data)
            onStepComplete()
          }}
        />
      ) : null}
      <div className={styles.hasSetup} data-shown={hasSetup}>
        <span className="material-icons">check_circle</span>
        <h2>Spotify Free is already set up!</h2>
        <p>You can choose to set it up again or skip this step.</p>
        <div className={styles.actions}>
          <button onClick={() => setHasSetup(false)}>Set up again</button>
          <button onClick={onStepComplete}>Continue</button>
        </div>
      </div>
    </div>
  )
}

interface TokenSetupProps {
  onStepComplete: (data: {
    discordToken: string
    connectionId: string
  }) => void
}

enum TokenSetupState {
  Pending,
  Checking,
  Valid,
  Invalid,
  Error
}

const TokenSetup: React.FC<TokenSetupProps> = ({ onStepComplete }) => {
  const [state, setState] = useState<TokenSetupState>(0)
  const [error, setError] = useState<string>('')
  const discordTokenRef = useRef<HTMLInputElement | null>(null)
  const connectionIdRef = useRef<HTMLInputElement | null>(null)

  async function check() {
    const discordToken = discordTokenRef.current!.value
    const connectionId = connectionIdRef.current!.value
    setError('')
    setState(TokenSetupState.Checking)
    await new Promise(r => setTimeout(r, 0))
    if (!validate(discordToken, connectionId)) return
    const valid = await window.api.validateConfig('spotifyfree', {
      discordToken,
      connectionId
    })
    if (valid) {
      setState(TokenSetupState.Valid)
    } else {
      setError('Invalid Discord token or connection ID! Please try again.')
      setState(TokenSetupState.Invalid)
    }
  }

  function complete() {
    const discordToken = discordTokenRef.current!.value
    const connectionId = connectionIdRef.current!.value
    onStepComplete({ discordToken, connectionId })
  }

  function validate(discordToken: string, connectionId: string) {
    if (discordToken.length === 0) {
      setError('Discord token cannot be empty!')
      setState(TokenSetupState.Invalid)
      return false
    }
    if (
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(
        discordToken
      )
    ) {
      setError('Invalid Discord token format!')
      setState(TokenSetupState.Invalid)
      return false
    }
    if (connectionId.length === 0) {
      setError('Connection ID cannot be empty!')
      setState(TokenSetupState.Invalid)
      return false
    }
    if (!/^[a-zA-Z0-9-]+$/.test(connectionId)) {
      setError('Invalid connection ID format!')
      setState(TokenSetupState.Invalid)
      return false
    }
    return true
  }

  return (
    <div className={styles.step}>
      <h2>Step 1: Discord Token and Connection ID Setup</h2>
      <p>
        To enable Spotify Free playback on GlanceThing, you need to provide
        your Discord token and Spotify discord connection ID.
      </p>
      <p className={styles.disclaimer}>
        <strong>Privacy notice:</strong> Your Discord token and connection
        ID are only used to authenticate with Discord and Spotify once
        every hour to retreive tokens. This data is never stored or sent to
        any other third parties. We use the same logic as{' '}
        <a
          href="https://github.com/Vendicated/Vencord/blob/main/src/plugins/spotifyControls/PlayerComponent.tsx"
          target="_blank"
          rel="noreferrer"
        >
          Vencord&quot;s SpotifyControls
        </a>{' '}
      </p>
      <div className={styles.inputs}>
        <input
          ref={discordTokenRef}
          disabled={[
            TokenSetupState.Checking,
            TokenSetupState.Valid
          ].includes(state)}
          type="password"
          placeholder="Discord token"
          className={styles.input}
        />
        <input
          ref={connectionIdRef}
          disabled={[
            TokenSetupState.Checking,
            TokenSetupState.Valid
          ].includes(state)}
          type="text"
          placeholder="Connection ID"
          className={styles.input}
        />
      </div>
      {state === TokenSetupState.Checking ? (
        <div className={styles.state} key={'checking'}>
          <Loader />
          <p>Checking...</p>
        </div>
      ) : state === TokenSetupState.Valid ? (
        <div className={styles.state} key={'valid'}>
          <span className="material-icons">check_circle</span>
          <p>Valid!</p>
        </div>
      ) : state === TokenSetupState.Invalid ? (
        <div className={styles.state} key={'invalid'}>
          <span className="material-icons" data-type="error">
            error
          </span>
          <p>{error ?? 'Invalid token or ID!'}</p>
        </div>
      ) : state === TokenSetupState.Error ? (
        <div className={styles.state} key={'error'}>
          <span className="material-icons" data-type="error">
            error
          </span>
          <p>{error}</p>
        </div>
      ) : null}
      <div className={styles.buttons}>
        {[
          TokenSetupState.Pending,
          TokenSetupState.Error,
          TokenSetupState.Invalid
        ].includes(state) ? (
          <button
            onClick={check}
            disabled={state === TokenSetupState.Checking}
            data-hidden={state === TokenSetupState.Valid}
          >
            Check
          </button>
        ) : [TokenSetupState.Valid].includes(state) ? (
          <button onClick={complete}>Continue</button>
        ) : null}
      </div>
    </div>
  )
}

export default SpotifyFree
