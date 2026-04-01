import type { ServiceConfig } from '../../state/types'
import { ServiceTile } from '../ServiceTile'
import styles from './MoreModal.module.css'

interface MoreModalProps {
  service: ServiceConfig
  onClose: () => void
  onServiceTap: (id: string) => void
}

export function MoreModal({ service, onClose, onServiceTap }: MoreModalProps) {
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className={styles.overlay}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={service.label}
    >
      <div className={styles.content}>
        <ServiceTile
          id={service.id}
          label={service.label}
          iconPath={service.iconPath}
          onPress={() => onServiceTap(service.id)}
        />
      </div>
    </div>
  )
}
