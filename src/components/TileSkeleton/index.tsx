import styles from './TileSkeleton.module.css'

export function TileSkeleton() {
  return (
    <div className={styles.skeleton} aria-hidden="true">
      <div className={styles.iconBox} />
      <div className={styles.labelBox} />
    </div>
  )
}
