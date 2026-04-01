import { useAppStore } from '../../state/store'
import { useInstallPrompt } from '../../hooks/useInstallPrompt'
import styles from './InstallGuidance.module.css'

export function InstallGuidance() {
  const setInstallDismissed = useAppStore(s => s.setInstallDismissed)
  const { canInstall, triggerInstall } = useInstallPrompt()

  // Already installed — hide guidance
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  if (isStandalone) return null

  const handleDismiss = () => {
    setInstallDismissed(true)
    localStorage.setItem('abu-dismiss-v1', '1')
  }

  return (
    <div className={styles.bar}>
      <span className={styles.text}>
        {canInstall
          ? 'התקנה זמינה'
          : 'כדי להתקין למסך הבית, לחצי על Share ואז על Add to Home Screen.'}
      </span>
      {canInstall && (
        <button className={styles.installButton} onClick={triggerInstall}>
          התקנה
        </button>
      )}
      <button className={styles.dismissButton} onClick={handleDismiss}>
        סגירה
      </button>
    </div>
  )
}
