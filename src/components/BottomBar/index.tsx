import { useAppStore } from '../../state/store'
import styles from './BottomBar.module.css'

export function BottomBar() {
  const appVersion = useAppStore(s => s.appVersion)

  return (
    <footer className={styles.bottomBar} role="contentinfo">
      <span className={styles.version}>
        <span className={styles.ltrSpan}>{appVersion}</span>
      </span>
    </footer>
  )
}
