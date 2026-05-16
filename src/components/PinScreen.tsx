import { useRef, useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { Lock, Shield } from 'lucide-react'

type Mode = 'unlock' | 'setup' | 'confirm'

interface Props {
  mode: 'unlock' | 'setup'
  onComplete?: () => void
}

function PinDots({ value, length = 6, error }: { value: string; length?: number; error?: boolean }) {
  return (
    <div className={`pin-dots ${error ? 'pin-dots-error' : ''}`}>
      {Array.from({ length }).map((_, i) => (
        <div
          key={i}
          className={`pin-dot ${i < value.length ? 'pin-dot-filled' : ''} ${i === value.length ? 'pin-dot-active' : ''}`}
        />
      ))}
    </div>
  )
}

export function PinScreen({ mode, onComplete }: Props) {
  const { unlockWithPin, setupPin, pinError } = useStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [phase, setPhase] = useState<Mode>(mode)
  const [localError, setLocalError] = useState('')
  const [shake, setShake] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [phase])

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
    if (phase === 'confirm') {
      setConfirmPin(val)
      if (val.length === 6) handleSubmitConfirm(val)
    } else {
      setPin(val)
      if (val.length === 6) {
        if (phase === 'unlock') handleUnlock(val)
        else if (phase === 'setup') {
          // Move to confirm phase
          setTimeout(() => { setPhase('confirm'); setLocalError('') }, 200)
        }
      }
    }
  }

  const handleUnlock = async (value: string) => {
    setLoading(true)
    const ok = await unlockWithPin(value)
    setLoading(false)
    if (!ok) {
      setLocalError('Incorrect PIN. Try again.')
      triggerShake()
      setPin('')
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      onComplete?.()
    }
  }

  const handleSubmitConfirm = async (value: string) => {
    if (value !== pin) {
      setLocalError("PINs don't match. Try again.")
      triggerShake()
      setConfirmPin('')
      setPin('')
      setPhase('setup')
      setTimeout(() => inputRef.current?.focus(), 50)
      return
    }
    setLoading(true)
    await setupPin(pin)
    setLoading(false)
    onComplete?.()
  }

  const currentPin = phase === 'confirm' ? confirmPin : pin
  const errorMsg = localError || pinError || ''

  const titles: Record<Mode, string> = {
    unlock: 'Enter your PIN',
    setup: 'Create a PIN',
    confirm: 'Confirm your PIN',
  }
  const subtitles: Record<Mode, string> = {
    unlock: 'Your notes are encrypted. Enter your 6-digit PIN to unlock.',
    setup: 'Set a 6-digit PIN to encrypt all your notes.',
    confirm: 'Enter the PIN again to confirm.',
  }

  return (
    <div className="pin-screen">
      <div className={`pin-card ${shake ? 'pin-shake' : ''}`}>
        <div className="pin-icon">
          {mode === 'unlock' ? <Lock size={28} /> : <Shield size={28} />}
        </div>
        <h2 className="pin-title">{titles[phase]}</h2>
        <p className="pin-subtitle">{subtitles[phase]}</p>

        <PinDots value={currentPin} error={!!errorMsg} />

        {/* Hidden actual input */}
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={currentPin}
          onChange={handleInput}
          disabled={loading}
          style={{
            position: 'absolute', opacity: 0, width: 1, height: 1,
            pointerEvents: 'none',
          }}
          autoFocus
        />

        {/* Clickable area to re-focus */}
        <div
          style={{ cursor: 'text', padding: '16px 0' }}
          onClick={() => inputRef.current?.focus()}
        />

        {errorMsg && <p className="pin-error">{errorMsg}</p>}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <span className="spinner" style={{
              display: 'inline-block', width: 20, height: 20,
              border: '2px solid var(--border-default)', borderTopColor: 'var(--accent)',
              borderRadius: '50%',
            }} />
          </div>
        )}

        {phase === 'setup' && pin.length > 0 && pin.length < 6 && (
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
            {6 - pin.length} digit{6 - pin.length !== 1 ? 's' : ''} remaining
          </p>
        )}
      </div>
    </div>
  )
}

// ── Inline PIN setup modal (for page menu → Enable PIN) ───────
interface SetupModalProps {
  onClose: () => void
}
export function PinSetupModal({ onClose }: SetupModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <PinScreen mode="setup" onComplete={onClose} />
      </div>
    </div>
  )
}

// ── Inline PIN disable modal ──────────────────────────────────
interface DisableModalProps {
  onClose: () => void
  onDisabled: () => void
}
export function PinDisableModal({ onClose, onDisabled }: DisableModalProps) {
  const { disablePin } = useStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState('')

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100) }, [])

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
    setPin(val)
    if (val.length === 6) handleDisable(val)
  }

  const handleDisable = async (value: string) => {
    setLoading(true)
    const ok = await disablePin(value)
    setLoading(false)
    if (!ok) {
      setLocalError('Incorrect PIN.')
      setShake(true); setTimeout(() => setShake(false), 500)
      setPin('')
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      onDisabled()
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-card ${shake ? 'pin-shake' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="pin-icon"><Lock size={24} /></div>
        <h2 className="pin-title" style={{ fontSize: 20 }}>Disable PIN Lock</h2>
        <p className="pin-subtitle">Enter your current PIN to disable encryption.</p>
        <PinDots value={pin} error={!!localError} />
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={handleInput}
          disabled={loading}
          style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }}
          autoFocus
        />
        <div style={{ cursor: 'text', padding: '8px 0' }} onClick={() => inputRef.current?.focus()} />
        {localError && <p className="pin-error">{localError}</p>}
        <button className="btn btn-ghost" style={{ width: '100%', marginTop: 16 }} onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}
