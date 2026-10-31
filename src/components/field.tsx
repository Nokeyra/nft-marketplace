import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '../lib/utils'

const box = 'mt-1 w-full rounded border border-line bg-ink px-3 py-2 text-xs placeholder:text-secondary/70 aria-[invalid=true]:border-red-400'
interface Base { label: string; error?: string; required?: boolean; className?: string }

const Shell = ({ id, label, required, error, className, children }: Base & { id: string; children: ReactNode }) => (
  <div className={className}>
    <label htmlFor={id} className="text-xs">{label}{required && <span aria-hidden className="text-brand"> *</span>}</label>
    {children}
    <p id={`${id}-err`} role="alert" className="mt-1 min-h-4 text-[11px] text-red-300">{error}</p>
  </div>
)
export function Field({ label, error, required, className, ...p }: Base & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return <Shell {...{ id, label, required, error, className }}><input id={id} required={required} aria-required={required} aria-invalid={!!error} aria-describedby={`${id}-err`} className={box} {...p} /></Shell>
}
export function SelectField({ label, error, required, className, children, ...p }: Base & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return <Shell {...{ id, label, required, error, className }}><select id={id} required={required} aria-required={required} aria-invalid={!!error} aria-describedby={`${id}-err`} className={cn(box, 'appearance-none')} {...p}>{children}</select></Shell>
}
export function TextAreaField({ label, error, required, className, ...p }: Base & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return <Shell {...{ id, label, required, error, className }}><textarea id={id} aria-invalid={!!error} aria-describedby={`${id}-err`} className={cn(box, 'h-28')} {...p} /></Shell>
}
