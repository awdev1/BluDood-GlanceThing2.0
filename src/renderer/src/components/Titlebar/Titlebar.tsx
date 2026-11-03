import React, { useContext } from 'react'
import { useNavigate } from 'react-router-dom'

import { DevModeContext } from '@/contexts/DevModeContext.js'
import { ModalContext } from '@/contexts/ModalContext.js'

import styles from './Titlebar.module.css'

const Titlebar: React.FC = () => {
  const navigate = useNavigate()
  const { openModals, setModalOpen } = useContext(ModalContext)
  const { devMode } = useContext(DevModeContext)

  const buttons = [
    ...(devMode
      ? [
          {
            icon: 'code',
            action: () => navigate('/developer')
          }
        ]
      : []),
    {
      icon: 'apps',
      action: () =>
        setModalOpen('shortcuts', !openModals.includes('shortcuts'))
    },
    {
      icon: 'settings',
      action: () =>
        setModalOpen('settings', !openModals.includes('settings'))
    },
    {
      icon: 'close',
      action: () => window.close()
    }
  ]

  return (
    <div className={styles.titlebar}>
      <div className={styles.actions}>
        {buttons.map(({ icon, action }) => (
          <button key={icon} onClick={action}>
            <span className="material-icons">{icon}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default Titlebar
