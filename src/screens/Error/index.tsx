import { useAppStore } from '../../state/store'
import { Screen } from '../../state/types'
import styles from './Error.module.css'

export function ErrorScreen() {
  const lastError = useAppStore(s => s.lastError)
  const setScreen = useAppStore(s => s.setScreen)
  const clearError = useAppStore(s => s.clearError)

  const handleGoHome = () => {
    clearError()
    setScreen(Screen.Home)
  }

  return (
    <div className={styles.error} role="alert" dir="rtl">
      <div style={{ fontSize: 56 }}>😔</div>
      <span className={styles.title}>משהו לא עבד</span>
      <span className={styles.message}>
        {lastError?.message || 'נסי שוב או חזרי הביתה'}
      </span>
      <button
        type="button"
        onClick={handleGoHome}
        aria-label="חזרה למסך הבית"
        className={styles.homeButton}
      >
        חזרה הביתה
      </button>
    </div>
  )
}
