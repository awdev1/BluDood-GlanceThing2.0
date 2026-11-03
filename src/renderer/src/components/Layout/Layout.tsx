import React from 'react'
import { Outlet } from 'react-router-dom'

import Developer from '@/pages/Developer/Developer.js'
import Shortcuts from '@/pages/Shortcuts/Shortcuts.js'
import Settings from '@/pages/Settings/Settings.js'
import Titlebar from '@/components/Titlebar/Titlebar.js'
import UpdateBanner from '@/components/UpdateBanner/UpdateBanner.js'
import AuthExpiredBanner from '@/components/AuthExpiredBanner/AuthExpiredBanner.js'

import styles from './Layout.module.css'

const Layout: React.FC = () => {
  return (
    <>
      <div className={styles.layout}>
        <Titlebar />
        <div className={styles.outlet}>
          <Outlet />
        </div>
      </div>
      <Settings />
      <Shortcuts />
      <Developer />
      <div className={styles.banners}>
        <AuthExpiredBanner />
        <UpdateBanner />
      </div>
    </>
  )
}

export default Layout
