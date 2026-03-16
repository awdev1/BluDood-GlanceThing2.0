import React, { useEffect, useState } from 'react'

import styles from './UpdateBanner.module.css'

const UpdateBanner: React.FC = () => {
  const [update, setUpdate] = useState<{ version: string; url: string } | null>(null)

  useEffect(() => {
    window.api.getUpdateAvailable().then(data => {
      if (data) setUpdate(data)
    })

    const unsub = window.api.on('updateAvailable', (...args) => {
      const data = args[0] as { version: string; url: string }
      setUpdate(data)
    })
    return unsub
  }, [])

  if (!update) return null

  return (
    <div className={styles.banner}>
      <span className="material-icons">system_update</span>
      <span className={styles.text}>
        Update available — <strong>v{update.version}</strong>
      </span>
      <button className={styles.download} onClick={() => window.api.openExternal(update.url)}>
        Download
      </button>
      <button className={styles.dismiss} onClick={() => setUpdate(null)}>
        <span className="material-icons">close</span>
      </button>
    </div>
  )
}

export default UpdateBanner
