import { useAppStore } from '../../state/store'
import { BackToHome } from '../../components/BackToHome'
import styles from './Opening.module.css'

export function Opening() {
  const activeServiceId = useAppStore(s => s.activeServiceId)
  const services = useAppStore(s => s.services)

  const service = services.find(s => s.id === activeServiceId)
  const serviceLabel = service?.label ?? ''

  return (
    <div className={styles.opening}>
      <div className={styles.pulse} />
      <span className={styles.label}>
        {`פותחת את ${serviceLabel}…`}
      </span>
      <span className={styles.hint}>
        כדי לחזור ל-ABU-BANK: לחצי על כפתור הבית ופתחי שוב את ABU-BANK
      </span>
      <BackToHome />
    </div>
  )
}
