import { WarningCircle } from '@phosphor-icons/react'
import { BackToHome } from '../../components/BackToHome'
import styles from './Error.module.css'

export function ErrorScreen() {
  return (
    <div className={styles.error} role="alert">
      <WarningCircle weight="fill" size={48} className={styles.icon} />
      <span className={styles.title}>שגיאה</span>
      <span className={styles.message}>
        הכתובת של השירות אינה תקינה.
      </span>
      <BackToHome />
    </div>
  )
}
