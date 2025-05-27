import { useContext, useEffect } from 'react'

import { AppBlurContext } from '@/contexts/AppBlurContext.tsx'
import { SocketContext } from '@/contexts/SocketContext.tsx'
import { AppStateContext } from '@/contexts/AppStateContext.tsx'

import FullescreenPlayer from './components/FullscreenPlayer/FullscreenPlayer.tsx'
import LoadingScreen from '@/components/LoadingScreen/LoadingScreen.tsx'
import UpdateScreen from './components/UpdateScreen/UpdateScreen.tsx'
import Statusbar from '@/components/Statusbar/Statusbar.tsx'
import Widgets from '@/components/Widgets/Widgets.tsx'
import Menu from '@/components/Menu/Menu.tsx'
import PlaylistsScreen from './components/PlaylistsScreen/PlaylistsScreen.tsx'

import styles from './App.module.css'

const App: React.FC = () => {
  const { blurred } = useContext(AppBlurContext)
  const { ready } = useContext(SocketContext)
  const {
    showStatusBar,
    playerShown,
    setPlayerShown,
    playlistsShown,
    setPlaylistsShown
  } = useContext(AppStateContext)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !playlistsShown) {
        setPlayerShown(!playerShown)
      } else if (e.key === 'Escape' && playlistsShown) {
        setPlaylistsShown(!playlistsShown)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [playerShown, setPlayerShown, playlistsShown, setPlaylistsShown])

  return (
    <>
      <div className={styles.app} data-blurred={blurred || !ready}>
        {showStatusBar && <Statusbar />}
        <Widgets />
        <FullescreenPlayer shown={playerShown} setShown={setPlayerShown} />
        <PlaylistsScreen
          shown={playlistsShown}
          setShown={setPlaylistsShown}
        />
      </div>
      <LoadingScreen />
      <UpdateScreen />
      <Menu />
    </>
  )
}

export default App
