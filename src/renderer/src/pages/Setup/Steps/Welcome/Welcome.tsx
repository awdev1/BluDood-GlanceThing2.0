import React, { useContext } from 'react'

import styles from './Welcome.module.css'

import icon from '@/assets/icon.png'
import iconNightly from '@/assets/icon-nightly.png'
import { ChannelContext } from '@/contexts/ChannelContext.js'

interface WelcomeProps {
  onStepComplete: () => void
}

const Welcome: React.FC<WelcomeProps> = ({ onStepComplete }) => {
  const { channel } = useContext(ChannelContext)

  return (
    <div className={styles.welcome}>
      <img src={channel === 'nightly' ? iconNightly : icon} alt="" />
      <h1>
        Welcome to GlanceThing{channel === 'nightly' ? ' Nightly' : ''}!
      </h1>
      <p>
        With only a few steps, you&apos;ll be up and running with
        GlanceThing.
      </p>
      <div className={styles.buttons}>
        <button onClick={onStepComplete}>Get Started</button>
      </div>
    </div>
  )
}

export default Welcome
