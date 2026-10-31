import { useRouter } from '@tanstack/react-router'
import { cn } from '../lib/utils'

export const BackButton = ({ className }: { className?: string }) => {
  const router = useRouter()
  return <button type="button" aria-label="Voltar" onClick={() => router.history.back()} className={cn('grid size-9 place-items-center rounded-full border border-line-soft bg-surface text-brand sm:hidden', className)}>‹</button>
}
