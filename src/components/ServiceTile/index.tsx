import { ServiceLogo } from '../ServiceLogo'
import styles from './ServiceTile.module.css'

interface ServiceTileProps {
  id: string
  label: string
  iconPath: string
  onPress: () => void
}

export function ServiceTile({ id, label, iconPath, onPress }: ServiceTileProps) {
  return (
    <button
      className={styles.tile}
      onClick={onPress}
      aria-label={`${label}. כפתור`}
    >
      <div className={styles.iconContainer}>
        <ServiceLogo iconPath={iconPath} serviceId={id} />
      </div>
      <span className={styles.label}>{label}</span>
    </button>
  )
}
