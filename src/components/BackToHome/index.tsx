// Deprecated: use BackButton from src/components/BackButton instead.
// Kept only for Admin screen (v16 — remove in v17).
import { House } from '@phosphor-icons/react'
import { useAppStore } from '../../state/store'
import { Screen } from '../../state/types'
import styles from './BackToHome.module.css'

interface BackToHomeProps {
  onPress?: () => void
}

export function BackToHome({ onPress }: BackToHomeProps) {
  const setScreen = useAppStore(s => s.setScreen)

  const handleClick = () => {
    if (onPress) {
      onPress()
    } else {
      setScreen(Screen.Home)
    }
  }

  return (
    <button
      className={styles.button}
      onClick={handleClick}
      aria-label="חזרה למסך הבית"
    >
      <House weight="fill" size={24} />
    </button>
  )
}
