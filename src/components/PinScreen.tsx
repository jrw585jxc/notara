import { useRef, useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { Lock, Shield, Eye, EyeOff, X } from 'lucide-react'

// ── PIN dots visualizer ───────────────────────────────────────
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

// ── Password field with show/hide ─────────────────────────────
function PasswordInput({
  value, onChange, onSubmit, placeholder, autoFocus, disabled,
}: {
  value: string; onChange: (v: string) => void; onSubmit?: () => void
  placeholder?: string; autoFocus?: boolean; disabled?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="pw-input-wrap">
      <input
        className="pw-input"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSubmit?.() }}
        placeholder={placeholder ?? 'Master password'}
        autoFocus={autoFocus}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
      />
      <button className="pw-show-btn" type="button" tabIndex={-1} onClick={() => setShow(v => !v)}>
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  )
}

// ── Main PinScreen (full-screen when vault is locked) ─────────
interface Props { mode: 'unlock' | 'setup'; onComplete?: () => void }

export function PinScreen({ mode, onComplete }: Props) {
  const { unlockWithPin, unlockWithMasterPassword, setupEncryption, hasDevicePin, pinError } = useStore()

  const [unlockPhase, setUnlockPhase] = useState<'pin' | 'master'>(
    mode === 'unlock' && hasDevicePin ? 'pin' : 'master'
  )
  const [setupPhase, setSetupPhase] = useState<'master' | 'confirm' | 'pin' | 'pin-confirm'>('master')

  const [pinValue, setPinValue]         = useState('')
  const [masterPw, setMasterPw]         = useState('')
  const [confirmPw, setConfirmPw]       = useState('')
  const [pinSetup, setPinSetup]         = useState('')
  const [pinSetupConfirm, setPinSetupConfirm] = useState('')
  const [localError, setLocalError]     = useState('')
  const [shake, setShake]               = useState(false)
  const [loading, setLoading]           = useState(false)
  const pinInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (unlockPhase === 'pin') setTimeout(() => pinInputRef.current?.focus(), 80)
  }, [unlockPhase])

  const triggerShake = () => { setShake(true); setTimeout(() => setShake(false), 500) }
  const err = localError || pinError || ''

  // ── Unlock with PIN ─────────────────────────────────────────
  const handlePinInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
    setPinValue(val)
    if (val.length === 6) handlePinSubmit(val)
  }
  const handlePinSubmit = async (value: string) => {
    setLoading(true); setLocalError('')
    const ok = await unlockWithPin(value)
    setLoading(false)
    if (!ok) { setLocalError('Incorrect PIN. Try again.'); triggerShake(); setPinValue(''); setTimeout(() => pinInputRef.current?.focus(), 50) }
    else onComplete?.()
  }

  // ── Unlock with master password ─────────────────────────────
  const handleMasterSubmit = async () => {
    if (!masterPw.trim()) return
    setLoading(true); setLocalError('')
    const ok = await unlockWithMasterPassword(masterPw)
    setLoading(false)
    if (!ok) { setLocalError('Incorrect password. Try again.'); triggerShake() }
    else onComplete?.()
  }

  // ── Setup flow ──────────────────────────────────────────────
  const handleSetupNext = async (confirmedPinValue?: string) => {
    if (setupPhase === 'master') {
      if (masterPw.length < 8) { setLocalError('Password must be at least 8 characters.'); return }
      setLocalError(''); setSetupPhase('confirm')
    } else if (setupPhase === 'confirm') {
      if (masterPw !== confirmPw) { setLocalError("Passwords don't match."); triggerShake(); setConfirmPw(''); return }
      setLocalError(''); setSetupPhase('pin')
    } else if (setupPhase === 'pin-confirm') {
      // Use the value passed directly from the input handler to avoid stale closure
      const confirmValue = confirmedPinValue ?? pinSetupConfirm
      if (pinSetup !== confirmValue) {
        setLocalError("PINs don't match."); triggerShake(); setPinSetupConfirm(''); setPinSetup(''); setSetupPhase('pin'); return
      }
      await finishSetup(pinSetup)
    }
  }

  const finishSetup = async (pin?: string) => {
    setLoading(true); setLocalError('')
    await setupEncryption(masterPw, pin || undefined)
    setLoading(false); onComplete?.()
  }

  const handlePinSetupInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
    if (setupPhase === 'pin') {
      setPinSetup(val)
      if (val.length === 6) { setLocalError(''); setSetupPhase('pin-confirm') }
    } else {
      setPinSetupConfirm(val)
      // Pass val directly — state update is async so pinSetupConfirm would be stale here
      if (val.length === 6) handleSetupNext(val)
    }
  }

  // ── Render: unlock ──────────────────────────────────────────
  if (mode === 'unlock') {
    return (
      <div className="pin-screen">
        <div className={`pin-card ${shake ? 'pin-shake' : ''}`}>
          <div className="pin-icon"><Lock size={28} /></div>
          {unlockPhase === 'pin' ? (
            <>
              <h2 className="pin-title">Enter your PIN</h2>
              <p className="pin-subtitle">Your notes are encrypted. Enter your 6-digit PIN to unlock.</p>
              <PinDots value={pinValue} error={!!err} />
              <input ref={pinInputRef} type="password" inputMode="numeric" maxLength={6}
                value={pinValue} onChange={handlePinInput} disabled={loading}
                style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }} autoFocus />
              <div style={{ cursor: 'text', padding: '12px 0' }} onClick={() => pinInputRef.current?.focus()} />
              {err && <p className="pin-error">{err}</p>}
              {loading && <div className="pin-spinner" />}
              <button className="btn btn-ghost" style={{ marginTop: 16, fontSize: 12 }}
                onClick={() => { setUnlockPhase('master'); setLocalError(''); setPinValue('') }}>
                Use master password instead
              </button>
            </>
          ) : (
            <>
              <h2 className="pin-title">Enter master password</h2>
              <p className="pin-subtitle">Your notes are encrypted. Enter your master password to unlock.</p>
              <PasswordInput value={masterPw} onChange={setMasterPw} onSubmit={handleMasterSubmit} autoFocus disabled={loading} />
              {err && <p className="pin-error" style={{ marginTop: 8 }}>{err}</p>}
              <button className="btn btn-primary" style={{ marginTop: 16, width: '100%' }}
                onClick={handleMasterSubmit} disabled={loading || !masterPw.trim()}>
                {loading ? 'Unlocking…' : 'Unlock'}
              </button>
              {hasDevicePin && (
                <button className="btn btn-ghost" style={{ marginTop: 10, fontSize: 12 }}
                  onClick={() => { setUnlockPhase('pin'); setLocalError(''); setMasterPw('') }}>
                  Use PIN instead
                </button>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Render: setup ───────────────────────────────────────────
  const setupTitles: Record<typeof setupPhase, string> = {
    master: 'Create a master password', confirm: 'Confirm your password',
    pin: 'Add a PIN for this device', 'pin-confirm': 'Confirm your PIN',
  }
  const setupSubs: Record<typeof setupPhase, string> = {
    master: "Choose a strong password. It encrypts all your notes and is required on every new device.",
    confirm: 'Enter the password again to confirm.',
    pin: 'Optional: a 6-digit PIN lets you unlock quickly on this device without retyping your password.',
    'pin-confirm': 'Enter the PIN again to confirm.',
  }

  return (
    <div className="pin-screen">
      <div className={`pin-card ${shake ? 'pin-shake' : ''}`}>
        <div className="pin-icon"><Shield size={28} /></div>
        <h2 className="pin-title">{setupTitles[setupPhase]}</h2>
        <p className="pin-subtitle">{setupSubs[setupPhase]}</p>

        {(setupPhase === 'master' || setupPhase === 'confirm') && (
          <>
            <PasswordInput
              value={setupPhase === 'master' ? masterPw : confirmPw}
              onChange={setupPhase === 'master' ? setMasterPw : setConfirmPw}
              onSubmit={() => handleSetupNext()}
              placeholder={setupPhase === 'master' ? 'At least 8 characters' : 'Repeat password'}
              autoFocus disabled={loading}
            />
            {err && <p className="pin-error" style={{ marginTop: 8 }}>{err}</p>}
            <button className="btn btn-primary" style={{ marginTop: 16, width: '100%' }}
              onClick={() => handleSetupNext()}
              disabled={loading || (setupPhase === 'master' ? masterPw.length < 8 : !confirmPw)}>
              Continue
            </button>
          </>
        )}

        {(setupPhase === 'pin' || setupPhase === 'pin-confirm') && (
          <>
            <PinDots value={setupPhase === 'pin' ? pinSetup : pinSetupConfirm} error={!!err} />
            <input type="password" inputMode="numeric" maxLength={6}
              value={setupPhase === 'pin' ? pinSetup : pinSetupConfirm}
              onChange={handlePinSetupInput} disabled={loading}
              style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }} autoFocus />
            <div style={{ cursor: 'text', padding: '12px 0' }} />
            {err && <p className="pin-error">{err}</p>}
            {loading && <div className="pin-spinner" />}
            {setupPhase === 'pin' && (
              <button className="btn btn-ghost" style={{ marginTop: 8, fontSize: 12 }}
                onClick={() => finishSetup(undefined)} disabled={loading}>
                Skip — use master password only
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Modals ────────────────────────────────────────────────────
export function PinSetupModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <PinScreen mode="setup" onComplete={onClose} />
      </div>
    </div>
  )
}

export function PinDisableModal({ onClose, onDisabled }: { onClose: () => void; onDisabled: () => void }) {
  const { disableEncryption } = useStore()
  const [password, setPassword] = useState('')
  const [shake, setShake] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleDisable = async () => {
    if (!password.trim()) return
    setLoading(true); setError('')
    const ok = await disableEncryption(password)
    setLoading(false)
    if (!ok) { setError('Incorrect password.'); setShake(true); setTimeout(() => setShake(false), 500); setPassword('') }
    else onDisabled()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-card ${shake ? 'pin-shake' : ''}`} style={{ padding: '24px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={18} /><span style={{ fontWeight: 600, fontSize: 15 }}>Disable Encryption</span>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={14} /></button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Enter your master password to decrypt all notes and disable encryption.
        </p>
        <PasswordInput value={password} onChange={setPassword} onSubmit={handleDisable} autoFocus disabled={loading} />
        {error && <p className="pin-error" style={{ marginTop: 8 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleDisable} disabled={loading || !password.trim()}>
            {loading ? 'Decrypting…' : 'Disable Encryption'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function PinAddDeviceModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const { setupPinForDevice } = useStore()
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [phase, setPhase] = useState<'pin' | 'confirm'>('pin')
  const [shake, setShake] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80) }, [phase])

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
    if (phase === 'pin') { setPin(val); if (val.length === 6) { setError(''); setPhase('confirm') } }
    // Pass val directly — pinConfirm state update would be stale when handleConfirm reads it
    else { setPinConfirm(val); if (val.length === 6) handleConfirm(val) }
  }

  const handleConfirm = async (val: string) => {
    if (val !== pin) {
      setError("PINs don't match."); setShake(true); setTimeout(() => setShake(false), 500)
      setPinConfirm(''); setPin(''); setPhase('pin'); return
    }
    setLoading(true); setError('')
    await setupPinForDevice(pin)
    setLoading(false); onAdded()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-card ${shake ? 'pin-shake' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="pin-icon"><Shield size={24} /></div>
        <h2 className="pin-title" style={{ fontSize: 18 }}>
          {phase === 'pin' ? 'Create a device PIN' : 'Confirm your PIN'}
        </h2>
        <p className="pin-subtitle">
          {phase === 'pin' ? 'Set a 6-digit PIN for quick access on this device.' : 'Enter the PIN again to confirm.'}
        </p>
        <PinDots value={phase === 'pin' ? pin : pinConfirm} error={!!error} />
        <input ref={inputRef} type="password" inputMode="numeric" maxLength={6}
          value={phase === 'pin' ? pin : pinConfirm} onChange={handleInput} disabled={loading}
          style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }} autoFocus />
        <div style={{ cursor: 'text', padding: '8px 0' }} onClick={() => inputRef.current?.focus()} />
        {error && <p className="pin-error">{error}</p>}
        {loading && <div className="pin-spinner" />}
        <button className="btn btn-ghost" style={{ width: '100%', marginTop: 16 }} onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}
