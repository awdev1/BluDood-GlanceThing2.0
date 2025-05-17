import { useContext, useEffect, useState } from 'react'

import { AppBlurContext } from '@/contexts/AppBlurContext.tsx'
import { SocketContext } from '@/contexts/SocketContext.tsx'

import FullescreenPlayer from './components/FullscreenPlayer/FullscreenPlayer.tsx'
import LoadingScreen from '@/components/LoadingScreen/LoadingScreen.tsx'
import UpdateScreen from './components/UpdateScreen/UpdateScreen.tsx'
import Statusbar from '@/components/Statusbar/Statusbar.tsx'
import Widgets from '@/components/Widgets/Widgets.tsx'
import Menu from '@/components/Menu/Menu.tsx'

import styles from './App.module.css'

const App: React.FC = () => {
  const { blurred } = useContext(AppBlurContext)
  const { ready } = useContext(SocketContext)
  const [playerShown, setPlayerShown] = useState(false)

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPlayerShown(s => !s)
      }
    }

    document.addEventListener('keydown', listener)

    return () => {
      document.removeEventListener('keydown', listener)
    }
  })

  return (
    <>
      <div className={styles.app} data-blurred={blurred || !ready}>
        <Statusbar />
        <Widgets />
        <FullescreenPlayer shown={playerShown} setShown={setPlayerShown} />
      </div>
      <LoadingScreen />
      <UpdateScreen />
      <Menu />
    </>
  )
}

export default App
