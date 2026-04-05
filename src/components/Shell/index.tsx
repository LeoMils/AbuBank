import type { ReactNode } from 'react'
import { useAppStore } from '../../state/store'
import { Screen } from '../../state/types'
import { Header } from '../Header'
import { BottomBar } from '../BottomBar'
import { InstallGuidance } from '../InstallGuidance'
import styles from './Shell.module.css'

interface ShellProps {
  children: ReactNode
}

export function Shell({ children }: ShellProps) {
  const installDismissed = useAppStore(s => s.installDismissed)
  const currentScreen = useAppStore(s => s.currentScreen)
  const isHome = currentScreen === Screen.Home
  const isFullScreen = isHome || currentScreen === Screen.AbuAI || currentScreen === Screen.AbuWhatsApp || currentScreen === Screen.Settings || currentScreen === Screen.AbuGames || currentScreen === Screen.AbuWeather || currentScreen === Screen.AbuCalendar || currentScreen === Screen.FamilyGallery

  return (
    <div className={styles.shell}>
      {!isFullScreen && <Header />}
      <main role="main" className={isFullScreen ? styles.mainFull : styles.main}>
        {children}
      </main>
      {!installDismissed && !isFullScreen && <InstallGuidance />}
      {!isFullScreen && <BottomBar />}
    </div>
  )
}
