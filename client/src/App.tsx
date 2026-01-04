import { useContext, useEffect } from 'react'

import { AppBlurContext } from '@/contexts/AppBlurContext.tsx'
import { SocketContext } from '@/contexts/SocketContext.tsx'
import { AppStateContext } from '@/contexts/AppStateContext.tsx'
import { MediaContext } from '@/contexts/MediaContext.tsx'

import FullscreenPlayer from './components/FullscreenPlayer/FullscreenPlayer.tsx'
import LoadingScreen from '@/components/LoadingScreen/LoadingScreen.tsx'
import UpdateScreen from './components/UpdateScreen/UpdateScreen.tsx'
import Statusbar from '@/components/Statusbar/Statusbar.tsx'
import Widgets from '@/components/Widgets/Widgets.tsx'
import Menu from '@/components/Menu/Menu.tsx'
import PlaylistsScreen from './components/PlaylistsScreen/PlaylistsScreen.tsx'
import LyricsScreen from '@/components/LyricsScreen/LyricsScreen.tsx'
import { useSwipeGesture } from '@/lib/useGestures'

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

  const { lyricsScreenShown, setLyricsScreenShown } = useContext(MediaContext)

  const bind = useSwipeGesture({
    onSwipeUp: () => {
      if (!lyricsScreenShown && !playlistsShown && !playerShown) {
        setPlayerShown(true)
      }
    },
    onSwipeDown: () => {
      if (lyricsScreenShown) {
        setLyricsScreenShown(false)
      } else if (playlistsShown) {
        setPlaylistsShown(false)
      } else if (playerShown) {
        setPlayerShown(false)
      }
    }
  }, {
    threshold: 60,
    velocity: 0.3
  })

useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return

    if (lyricsScreenShown) {
      setLyricsScreenShown(false)
      return 
    }

    if (playlistsShown) {
      setPlaylistsShown(false)
      return
    }

    if (playerShown) {
      setPlayerShown(false)
      return
    }

    setPlayerShown(true)
  }

  document.addEventListener('keydown', handleKeyDown)
  return () => document.removeEventListener('keydown', handleKeyDown)
}, [
  lyricsScreenShown,
  playlistsShown,
  playerShown,
  setLyricsScreenShown,
  setPlaylistsShown,
  setPlayerShown
])


  return (
    <>
      <div className={styles.app} data-blurred={blurred || !ready} {...bind()}>
        {showStatusBar && <Statusbar />}
        <Widgets />

        <LyricsScreen shown={lyricsScreenShown} setShown={setLyricsScreenShown} />
        <FullscreenPlayer shown={playerShown} setShown={setPlayerShown} />
        <PlaylistsScreen shown={playlistsShown} setShown={setPlaylistsShown} />
      </div>

      <LoadingScreen />
      <UpdateScreen />
      <Menu />
    </>
  )
}

export default App
