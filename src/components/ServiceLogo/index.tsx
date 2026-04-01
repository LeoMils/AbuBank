import { useState } from 'react'
import styles from './ServiceLogo.module.css'

interface ServiceLogoProps {
  iconPath: string
  serviceId: string
}

// H4-FIX: load chain via <img src> string path — NOT ES import
// onError chains to next fallback using DOM event, not import()
export function ServiceLogo({ serviceId }: ServiceLogoProps) {
  const [step, setStep] = useState(0)

  const sources = [
    `/logos/service-${serviceId}.svg`,
    `/logos/service-${serviceId}.png`,
    '/logos/fallback-service.svg',
  ]

  const currentSrc = sources[step]
  if (!currentSrc) return null

  const handleError = () => {
    if (step < sources.length - 1) {
      setStep(s => s + 1)
    }
  }

  return (
    <img
      src={currentSrc}
      alt=""
      className={styles.logo}
      onError={handleError}
      draggable={false}
    />
  )
}
