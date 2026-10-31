import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

const variants = cva('inline-flex items-center justify-center rounded-md px-5 py-2.5 text-xs font-bold uppercase tracking-wide transition disabled:opacity-50 disabled:cursor-not-allowed', {
  variants: { variant: { primary: 'bg-brand text-ink hover:brightness-110', outline: 'border border-brand text-brand hover:bg-brand/15' } },
  defaultVariants: { variant: 'primary' },
})
interface Props extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof variants> { asChild?: boolean }
export const Button = forwardRef<HTMLButtonElement, Props>(({ className, variant, asChild, ...p }, ref) => {
  const C = asChild ? Slot : 'button'
  return <C ref={ref} className={cn(variants({ variant }), className)} {...p} />
})
Button.displayName = 'Button'
