import { Link } from '@tanstack/react-router'
import type { Nft } from '../lib/types'
import { Skeleton } from './ui/skeleton'

export const NftCard = ({ nft }: { nft: Nft }) => (
  <Link to="/nft/$id" params={{ id: nft.id }} className="block rounded-lg bg-surface p-3 hover:ring-1 ring-brand">
    <img src={nft.image} alt={`${nft.name}, da coleção ${nft.collection}`} width={600} height={600} loading="lazy" className="aspect-square w-full rounded-md object-cover" />
    <h3 className="mt-3 text-xs font-medium">{nft.name}</h3>
    <p className="mt-1 flex justify-between text-xs"><span className="font-bold text-accent">{nft.priceEth} ETH</span><span className="text-muted">{nft.stock > 0 ? `${nft.stock} disp.` : 'Esgotado'}</span></p>
  </Link>
)
export const NftCardSkeleton = () => <div className="rounded-lg bg-surface p-3"><Skeleton className="aspect-square" /><Skeleton className="mt-3 h-4 w-3/4" /><Skeleton className="mt-2 h-4 w-1/2" /></div>
