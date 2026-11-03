import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import styles from '@/components/UpdateBanner/UpdateBanner.module.css'

const AuthExpiredBanner: React.FC = () => {
  const navigate = useNavigate()
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    window.api.getPlaybackAuthExpired().then(setExpired)

    return window.api.on('playbackAuthExpired', () => setExpired(true))
  }, [])

  if (!expired) return null

  function renew() {
    setExpired(false)
    navigate('/setup?step=3')
  }

  return (
    <div className={styles.banner}>
      <span className="material-icons" style={{ color: '#ff9800' }}>
        key_off
      </span>
      <span className={styles.text}>
        Spotify login expired, <strong>sign in again.</strong>
      </span>
      <button className={styles.download} onClick={renew}>
        Renew
      </button>
      <button className={styles.dismiss} onClick={() => setExpired(false)}>
        <span className="material-icons">close</span>
      </button>
    </div>
  )
}

export default AuthExpiredBanner
