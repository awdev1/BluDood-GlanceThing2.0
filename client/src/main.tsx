import { createRoot } from 'react-dom/client'

import { AppBlurContextProvider } from '@/contexts/AppBlurContext.tsx'
import { SocketContextProvider } from '@/contexts/SocketContext.tsx'
import { SleepContextProvider } from '@/contexts/SleepContext.tsx'
import { AppStateContextProvider } from '@/contexts/AppStateContext.tsx'

import App from '@/App.tsx'

import './index.css'
import '@fontsource-variable/open-sans'
import '@fontsource/material-icons'
import { MediaContextProvider } from './contexts/MediaContext.tsx'

const root = createRoot(document.getElementById('root')!)

root.render(
  <SocketContextProvider>
    <AppBlurContextProvider>
      <AppStateContextProvider>
        <SleepContextProvider>
          <MediaContextProvider>
            <App />
          </MediaContextProvider>
        </SleepContextProvider>
      </AppStateContextProvider>
    </AppBlurContextProvider>
  </SocketContextProvider>
)
