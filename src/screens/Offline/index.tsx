import { WifiSlash } from '@phosphor-icons/react'
import { useAppStore } from '../../state/store'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { retryNavigation } from '../../services/navigationService'
import { BackToHome } from '../../components/BackToHome'
import { Screen } from '../../state/types'
import styles from './Offline.module.css'

export function Offline() {
  const activeServiceId = useAppStore(s => s.activeServiceId)
  const setScreen = useAppStore(s => s.setScreen)
  const setActiveServiceId = useAppStore(s => s.setActiveServiceId)
  const online = useOnlineStatus()

  const handleBackToHome = () => {
    setActiveServiceId(null)
    setScreen(Screen.Home)
  }

  return (
    <div className={styles.offline} role="alert">
      <WifiSlash weight="fill" size={48} className={styles.icon} />
      <span className={styles.title}>אין חיבור לאינטרנט</span>
      <span className={styles.message}>
        בדקי את החיבור לאינטרנט ונסי שוב.
      </span>
      {activeServiceId && (
        <button
          className={styles.retryButton}
          onClick={retryNavigation}
          disabled={!online}
        >
          נסי שוב
        </button>
      )}
      <BackToHome onPress={handleBackToHome} />
    </div>
  )
}
