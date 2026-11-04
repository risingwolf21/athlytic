import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { UserProfile } from '@shared/domain.ts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useProfile, useSaveProfile } from '@/hooks/use-fitness-data'
import { DEFAULT_PROFILE } from '@shared/domain.ts'

interface FormState {
  displayName: string
  birthYear: string
  maxHr: string
  restingHrOverride: string
  stepGoal: string
}

const toForm = (p: UserProfile): FormState => ({
  displayName: p.displayName,
  birthYear: p.birthYear?.toString() ?? '',
  maxHr: p.maxHr.toString(),
  restingHrOverride: p.restingHrOverride?.toString() ?? '',
  stepGoal: p.stepGoal.toString(),
})

const optionalInt = (value: string): number | null => {
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : null
}

function Field({ id, label, hint, ...props }: { id: string; label: string; hint?: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} className="h-11" {...props} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function ProfileForm() {
  const { t } = useTranslation()
  const profile = useProfile()
  const save = useSaveProfile()
  const [form, setForm] = useState<FormState>(toForm(DEFAULT_PROFILE))
  const stored = profile.data

  useEffect(() => {
    if (stored) setForm(toForm(stored))
  }, [stored])

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const maxHr = optionalInt(form.maxHr)
  const stepGoal = optionalInt(form.stepGoal)
  const valid = maxHr !== null && maxHr >= 120 && maxHr <= 230 && stepGoal !== null && stepGoal >= 1000 && stepGoal <= 100000

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || maxHr === null || stepGoal === null) return
    save.mutate(
      { ...(stored ?? DEFAULT_PROFILE), displayName: form.displayName.trim(), birthYear: optionalInt(form.birthYear), maxHr, restingHrOverride: optionalInt(form.restingHrOverride), stepGoal },
      { onSuccess: () => toast.success(t('settings.profileSaved')) },
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field id="displayName" label={t('settings.displayName')} value={form.displayName} onChange={set('displayName')} autoComplete="given-name" />
      <div className="grid grid-cols-2 gap-3">
        <Field id="birthYear" label={t('settings.birthYear')} inputMode="numeric" value={form.birthYear} onChange={set('birthYear')} />
        <Field id="maxHr" label={t('settings.maxHr')} inputMode="numeric" value={form.maxHr} onChange={set('maxHr')} aria-invalid={maxHr === null || maxHr < 120 || maxHr > 230} />
        <Field id="restingHr" label={t('settings.restingHrOverride')} inputMode="numeric" value={form.restingHrOverride} onChange={set('restingHrOverride')} />
        <Field id="stepGoal" label={t('settings.stepGoal')} inputMode="numeric" value={form.stepGoal} onChange={set('stepGoal')} aria-invalid={!stepGoal} />
      </div>
      <p className="text-xs text-muted-foreground">{t('settings.maxHrHint')}</p>
      <Button type="submit" disabled={!valid || save.isPending} className="h-11 w-full">
        {t('common.save')}
      </Button>
      {save.isPaused && <p className="text-xs text-muted-foreground">{t('offline.queued')}</p>}
    </form>
  )
}
