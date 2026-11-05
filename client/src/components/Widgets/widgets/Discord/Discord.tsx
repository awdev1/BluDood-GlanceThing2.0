import React, { useContext } from 'react'

import { SocketContext } from '@/contexts/SocketContext.tsx'
import { DiscordState } from '@/lib/useDiscordState.ts'
import BaseWidget from '../BaseWidget/BaseWidget.tsx'

import styles from './Discord.module.css'

interface DiscordProps {
  visible: boolean
  state: DiscordState | null
}

const Discord: React.FC<DiscordProps> = ({ visible, state }) => {
  const { socket } = useContext(SocketContext)

  function send(action: string) {
    socket?.send(JSON.stringify({ type: 'discord', action }))
  }

  const buttons = [
    {
      action: 'mute',
      icon: state?.mute ? 'mic_off' : 'mic',
      label: state?.mute ? 'Unmute' : 'Mute',
      active: !!state?.mute
    },
    {
      action: 'deafen',
      icon: state?.deaf ? 'headset_off' : 'headset',
      label: state?.deaf ? 'Undeafen' : 'Deafen',
      active: !!state?.deaf
    },
    { action: 'leave', icon: 'call_end', label: 'Leave', active: true }
  ]

  return (
    <BaseWidget className={styles.discord} visible={visible}>
      <div className={styles.content}>
        <p className={styles.channel}>{state?.channel ?? 'Voice call'}</p>
        <div className={styles.buttons}>
          {buttons.map(({ action, icon, label, active }) => (
            <div
              key={action}
              className={styles.control}
              tabIndex={-1}
              data-type={action}
              data-active={active}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.stopPropagation()
                  send(action)
                }
              }}
              onClick={() => send(action)}
            >
              <span className="material-icons">{icon}</span>
              <p>{label}</p>
            </div>
          ))}
        </div>
      </div>
    </BaseWidget>
  )
}

export default Discord
