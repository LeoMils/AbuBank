import { useRef } from 'react'
import { useAppStore } from '../../state/store'
import { Screen } from '../../state/types'
import styles from './Header.module.css'

export function Header() {
  const currentScreen = useAppStore(s => s.currentScreen)
  const setScreen = useAppStore(s => s.setScreen)
  const tapTimestamps = useRef<number[]>([])

  const handleWordmarkTap = () => {
    if (currentScreen !== Screen.Home) return
    const now = Date.now()
    tapTimestamps.current = [...tapTimestamps.current, now]
      .filter(t => now - t < 1500)
    if (tapTimestamps.current.length >= 3) {
      tapTimestamps.current = []
      setScreen(Screen.Admin)
    }
  }

  return (
    <header className={styles.header}>
      <span
        className={styles.wordmark}
        onClick={handleWordmarkTap}
        role="presentation"
      >
        ABU-BANK
      </span>
    </header>
  )
}
