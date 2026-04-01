import styles from './UpdateToast.module.css'

interface UpdateToastProps {
  onUpdate: () => void
}

export function UpdateToast({ onUpdate }: UpdateToastProps) {
  return (
    <div className={styles.toast} role="status">
      <span className={styles.message}>גרסה חדשה זמינה</span>
      <button className={styles.button} onClick={onUpdate}>
        רענן
      </button>
    </div>
  )
}
