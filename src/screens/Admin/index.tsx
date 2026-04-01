import { useState, useRef, useCallback } from 'react'
import {
  Lock, FloppyDisk, DownloadSimple, UploadSimple,
  CaretDown, CaretUp, Warning, CheckCircle,
} from '@phosphor-icons/react'
import { useAppStore } from '../../state/store'
import * as adminService from '../../services/adminService'
import * as storageService from '../../services/storageService'
import { BackToHome } from '../../components/BackToHome'
import type { ServiceConfig } from '../../state/types'
import { Screen } from '../../state/types'
import styles from './Admin.module.css'

function isValidUrl(url: string): boolean {
  return /^https:\/\/.+\..+/.test(url) && !url.includes('replace-me.invalid')
}

function AdminSkeleton() {
  return (
    <div className={styles.skeleton}>
      <div className={styles.skeletonBlock} />
      <div className={styles.skeletonBlock} />
      <div className={styles.skeletonBlock} />
    </div>
  )
}

function AdminLocked() {
  const adminFirstBoot = useAppStore(s => s.adminFirstBoot)
  const unlockAdmin = useAppStore(s => s.unlockAdmin)
  const setAdminFirstBoot = useAppStore(s => s.setAdminFirstBoot)
  const setScreen = useAppStore(s => s.setScreen)
  const lockAdmin = useAppStore(s => s.lockAdmin)

  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [step, setStep] = useState<'enter' | 'confirm'>('enter')
  const [error, setError] = useState('')
  const [locked, setLocked] = useState(adminService.isLockedOut())
  const inputRef = useRef<HTMLInputElement>(null)

  const handleBackToHome = () => {
    lockAdmin()
    setScreen(Screen.Home)
  }

  if (locked) {
    return (
      <div className={styles.pinContainer} role="alert">
        <Lock weight="fill" size={48} className={styles.pinIcon} />
        <span className={styles.pinTitle}>הגישה נחסמה</span>
        <span className={styles.lockoutMessage}>
          בוצעו יותר מדי ניסיונות. יש לרענן את האפליקציה.
        </span>
        <BackToHome onPress={handleBackToHome} />
      </div>
    )
  }

  if (adminFirstBoot) {
    const handleSubmitSetup = async () => {
      if (step === 'enter') {
        if (pin.length !== 6) {
          setError('יש להזין 6 ספרות')
          return
        }
        setError('')
        setStep('confirm')
        setConfirmPin('')
        setTimeout(() => inputRef.current?.focus(), 50)
        return
      }

      if (confirmPin.length !== 6) {
        setError('יש להזין 6 ספרות')
        return
      }

      if (pin !== confirmPin) {
        setError('הקודים אינם תואמים')
        setPin('')
        setConfirmPin('')
        setStep('enter')
        setTimeout(() => inputRef.current?.focus(), 50)
        return
      }

      await adminService.storePINHash(pin)
      await adminService.setAdminFirstBootComplete()
      setAdminFirstBoot(false)
      unlockAdmin()
    }

    return (
      <div className={styles.pinContainer}>
        <Lock weight="fill" size={48} className={styles.pinIcon} />
        <span className={styles.pinTitle}>
          {step === 'enter' ? 'הגדרת קוד גישה' : 'אימות קוד גישה'}
        </span>
        <span className={styles.pinSubtitle}>
          {step === 'enter' ? 'בחרי קוד בן 6 ספרות' : 'הזיני שוב לאימות'}
        </span>
        <input
          ref={inputRef}
          className={styles.pinInput}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          autoComplete="off"
          value={step === 'enter' ? pin : confirmPin}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '').slice(0, 6)
            if (step === 'enter') setPin(val)
            else setConfirmPin(val)
            setError('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmitSetup()
          }}
          autoFocus
        />
        <span className={styles.pinError}>{error}</span>
        <button
          className={styles.pinButton}
          onClick={handleSubmitSetup}
          disabled={step === 'enter' ? pin.length !== 6 : confirmPin.length !== 6}
        >
          {step === 'enter' ? 'המשך' : 'אישור'}
        </button>
        <BackToHome onPress={handleBackToHome} />
      </div>
    )
  }

  // Existing PIN verification
  const handleVerify = async () => {
    if (pin.length !== 6) {
      setError('יש להזין 6 ספרות')
      return
    }

    const correct = await adminService.verifyPIN(pin)
    if (correct) {
      unlockAdmin()
      return
    }

    const attempts = adminService.trackAttempt()
    if (attempts >= 5) {
      setLocked(true)
      return
    }
    if (attempts >= 3) {
      const remaining = 5 - attempts
      setError(`קוד שגוי. נותרו ${remaining} ניסיונות`)
    } else {
      setError('קוד שגוי')
    }
    setPin('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  return (
    <div className={styles.pinContainer}>
      <Lock weight="fill" size={48} className={styles.pinIcon} />
      <span className={styles.pinTitle}>הזיני קוד גישה</span>
      <input
        ref={inputRef}
        className={styles.pinInput}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        autoComplete="off"
        value={pin}
        onChange={(e) => {
          const val = e.target.value.replace(/\D/g, '').slice(0, 6)
          setPin(val)
          setError('')
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleVerify()
        }}
        autoFocus
      />
      <span className={styles.pinError}>{error}</span>
      <button
        className={styles.pinButton}
        onClick={handleVerify}
        disabled={pin.length !== 6}
      >
        המשך
      </button>
      <BackToHome onPress={handleBackToHome} />
    </div>
  )
}

function AdminUnlocked() {
  const services = useAppStore(s => s.services)
  const storageMode = useAppStore(s => s.storageMode)
  const adminFirstBoot = useAppStore(s => s.adminFirstBoot)
  const isNavigating = useAppStore(s => s.isNavigating)
  const isOnline = useAppStore(s => s.isOnline)
  const appVersion = useAppStore(s => s.appVersion)
  const setServices = useAppStore(s => s.setServices)
  const setScreen = useAppStore(s => s.setScreen)
  const lockAdmin = useAppStore(s => s.lockAdmin)

  const [edited, setEdited] = useState<ServiceConfig[]>(() =>
    services.map(s => ({ ...s }))
  )
  const [writeError, setWriteError] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [importError, setImportError] = useState('')
  const [diagOpen, setDiagOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleBackToHome = () => {
    lockAdmin()
    setScreen(Screen.Home)
  }

  const updateService = useCallback((index: number, field: keyof ServiceConfig, value: string) => {
    setEdited(prev => {
      const next = prev.map(s => ({ ...s }))
      const target = next[index]
      if (!target) return prev
      target[field] = value
      return next
    })
    setWriteError(false)
    setSaveSuccess(false)
  }, [])

  const hasInvalidUrl = edited.some(s => !isValidUrl(s.url))
  const hasEmptyLabel = edited.some(s => s.label.trim() === '')

  const handleSave = async () => {
    const r = await storageService.writeServices(edited)
    if (r.ok) {
      setServices(edited)
      setWriteError(false)
      setSaveSuccess(true)
    } else {
      setWriteError(true)
      setSaveSuccess(false)
    }
  }

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(edited, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'abu-bank-config.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset file input so same file can be re-imported
    e.target.value = ''

    try {
      const text = await file.text()
      const data: unknown = JSON.parse(text)

      if (!Array.isArray(data) || data.length !== 9) {
        setImportError('הקובץ אינו תקין — נדרשים 9 שירותים')
        return
      }

      for (const item of data) {
        if (typeof item !== 'object' || item === null) {
          setImportError('הקובץ אינו תקין — מבנה שגוי')
          return
        }
        const rec = item as Record<string, unknown>
        if (typeof rec.id !== 'string' || rec.id === '') {
          setImportError('הקובץ אינו תקין — שדה id חסר')
          return
        }
        if (typeof rec.label !== 'string' || rec.label === '') {
          setImportError('הקובץ אינו תקין — שדה label חסר')
          return
        }
        if (typeof rec.url !== 'string') {
          setImportError('הקובץ אינו תקין — שדה url חסר')
          return
        }
        if (typeof rec.iconPath !== 'string') {
          setImportError('הקובץ אינו תקין — שדה iconPath חסר')
          return
        }
      }

      const validated = data as ServiceConfig[]

      // eslint-disable-next-line no-restricted-globals
      if (!confirm('לייבא הגדרות חדשות? הפעולה תחליף את ההגדרות הנוכחיות.')) return

      const r = await storageService.writeServices(validated)
      if (r.ok) {
        setServices(validated)
        setEdited(validated.map(s => ({ ...s })))
        setWriteError(false)
        setSaveSuccess(true)
        setImportError('')
      } else {
        setWriteError(true)
      }
    } catch {
      setImportError('הקובץ אינו תקין — JSON שגוי')
    }
  }

  return (
    <div className={styles.admin}>
      <div className={styles.editorHeader}>
        <span className={styles.editorTitle}>הגדרות</span>
      </div>

      {storageMode === 'volatile' && (
        <div className={`${styles.banner} ${styles.bannerVolatile}`} role="alert">
          <Warning weight="fill" size={20} className={styles.bannerIcon} />
          <span>ההגדרות נשמרות רק זמנית במכשיר הזה.</span>
        </div>
      )}

      {writeError && (
        <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
          <Warning weight="fill" size={20} className={styles.bannerIcon} />
          <span>לא ניתן לשמור — נסי שוב מאוחר יותר.</span>
        </div>
      )}

      {saveSuccess && (
        <div className={`${styles.banner} ${styles.bannerSuccess}`}>
          <CheckCircle weight="fill" size={20} className={styles.bannerIcon} />
          <span>ההגדרות נשמרו בהצלחה.</span>
        </div>
      )}

      {edited.map((service, index) => (
        <div key={service.id} className={styles.serviceCard}>
          <span className={styles.serviceCardLabel}>{service.id}</span>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>שם השירות</label>
            <input
              className={`${styles.fieldInput}${service.label.trim() === '' ? ` ${styles.fieldInputInvalid}` : ''}`}
              type="text"
              value={service.label}
              onChange={(e) => updateService(index, 'label', e.target.value)}
            />
            {service.label.trim() === '' && (
              <span className={styles.fieldError}>שם השירות הוא שדה חובה</span>
            )}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>כתובת URL</label>
            <input
              className={`${styles.fieldInput} ${styles.fieldInputUrl}${!isValidUrl(service.url) ? ` ${styles.fieldInputInvalid}` : ''}`}
              type="url"
              value={service.url}
              onChange={(e) => updateService(index, 'url', e.target.value)}
            />
            {!isValidUrl(service.url) && (
              <span className={styles.fieldError}>הכתובת של השירות אינה תקינה.</span>
            )}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>נתיב אייקון</label>
            <input
              className={`${styles.fieldInput} ${styles.fieldInputUrl}`}
              type="text"
              value={service.iconPath}
              onChange={(e) => updateService(index, 'iconPath', e.target.value)}
            />
          </div>
        </div>
      ))}

      <div className={styles.actions}>
        <button
          className={`${styles.actionButton} ${styles.saveButton}`}
          onClick={handleSave}
          disabled={hasInvalidUrl || hasEmptyLabel}
        >
          <FloppyDisk weight="fill" size={20} />
          שמירה
        </button>
        <button className={styles.actionButton} onClick={handleExport}>
          <DownloadSimple weight="fill" size={20} />
          ייצוא
        </button>
        <button className={styles.actionButton} onClick={handleImportClick}>
          <UploadSimple weight="fill" size={20} />
          ייבוא
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImportFile}
          hidden
        />
      </div>

      {importError && (
        <span className={styles.importError} role="alert">{importError}</span>
      )}

      <div className={styles.diagSection}>
        <button
          className={styles.diagToggle}
          onClick={() => setDiagOpen(v => !v)}
        >
          <span>אבחון</span>
          {diagOpen
            ? <CaretUp weight="fill" size={20} />
            : <CaretDown weight="fill" size={20} />
          }
        </button>
        {diagOpen && (
          <div className={styles.diagContent}>
            <div className={styles.diagRow}>
              <span className={styles.diagLabel}>אחסון</span>
              <span className={styles.diagValue}>
                <span className={styles.ltrSpan}>{storageMode}</span>
              </span>
            </div>
            <div className={styles.diagRow}>
              <span className={styles.diagLabel}>גרסת סכמה</span>
              <span className={styles.diagValue}>
                <span className={styles.ltrSpan}>1</span>
              </span>
            </div>
            <div className={styles.diagRow}>
              <span className={styles.diagLabel}>הפעלה ראשונה</span>
              <span className={styles.diagValue}>{adminFirstBoot ? 'כן' : 'לא'}</span>
            </div>
            <div className={styles.diagRow}>
              <span className={styles.diagLabel}>ניווט פעיל</span>
              <span className={styles.diagValue}>{isNavigating ? 'כן' : 'לא'}</span>
            </div>
            <div className={styles.diagRow}>
              <span className={styles.diagLabel}>מחובר</span>
              <span className={styles.diagValue}>{isOnline ? 'כן' : 'לא'}</span>
            </div>
            <div className={styles.diagRow}>
              <span className={styles.diagLabel}>גרסה</span>
              <span className={styles.diagValue}>
                <span className={styles.ltrSpan}>{appVersion}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <BackToHome onPress={handleBackToHome} />
      </div>
    </div>
  )
}

export function Admin() {
  const adminInitComplete = useAppStore(s => s.adminInitComplete)
  const adminUnlocked = useAppStore(s => s.adminUnlocked)

  // H1-FIX: Admin renders loading skeleton when !adminInitComplete
  if (!adminInitComplete) return <AdminSkeleton />

  if (!adminUnlocked) return <AdminLocked />

  return <AdminUnlocked />
}
