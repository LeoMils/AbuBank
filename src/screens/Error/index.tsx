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
        style={{
          marginTop: 8, padding: '16px 36px', borderRadius: 14,
          background: 'linear-gradient(135deg, #D4A853 0%, #C9A84C 100%)',
          color: 'rgba(0,0,0,0.85)', fontSize: 18,
          fontWeight: 700, border: 'none', cursor: 'pointer',
          fontFamily: "'Heebo',sans-serif",
          minHeight: 56, minWidth: 160,
          boxShadow: '0 4px 20px rgba(201,168,76,0.40)',
        }}
      >
        חזרה הביתה
      </button>
    </div>
  )
}
