import { useEffect, useRef } from 'react'

import Controls from './widgets/Controls/Controls.tsx'
import Player from './widgets/Player/Player.tsx'
import Apps from './widgets/Apps/Apps.tsx'

import styles from './Widgets.module.css'

const Widgets: React.FC = () => {
  const widgetsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (!widgetsRef.current) return
      const widgets = widgetsRef.current.querySelectorAll('#widget')
      if (e.key === '1') {
        const widget = widgets[0] as HTMLDivElement
        widget.focus()
      } else if (e.key === '2') {
        const widget = widgets[1] as HTMLDivElement
        widget.focus()
      } else if (e.key === '3') {
        const widget = widgets[2] as HTMLDivElement
        widget.focus()
      }
    }

    document.addEventListener('keydown', listener)

    return () => {
      document.removeEventListener('keydown', listener)
    }
  })

  return (
    <div className={styles.widgets} ref={widgetsRef}>
      <Player />
      <div className={styles.column}>
        <Apps />
        <Controls />
      </div>
    </div>
  )
}

export default Widgets
