import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import type { Nft, NftEvent, NftPage, Order, OrderEvent } from './types'

// Cliente socket.io real. Ciclo de vida atrelado ao usuário: logout/troca de usuário desconecta e remove listeners.
export function useRealtime(userId: string | undefined) {
  const qc = useQueryClient()
  const [notice, setNotice] = useState('')
  useEffect(() => {
    if (!userId) return
    const socket = io({ path: '/socket.io', transports: ['websocket'] })
    const seen = new Set<string>()
    const onNft = (e: NftEvent) => {
      if (seen.has(e.id)) return // duplicata
      seen.add(e.id)
      const merge = (n: Nft): Nft => (n.id === e.resourceId && e.version > n.version ? { ...n, ...e.data, version: e.version } : n) // evento antigo não regride
      qc.setQueryData<Nft>(['nft', e.resourceId], (o) => (o ? merge(o) : o))
      qc.setQueriesData<NftPage>({ queryKey: ['nfts'] }, (o) => (o ? { ...o, items: o.items.map(merge) } : o))
      qc.invalidateQueries({ queryKey: ['cart'] })
      setNotice(`NFT ${e.resourceId} atualizado: ${e.data.priceEth} ETH, ${e.data.stock} em estoque.`)
    }
    const onOrder = (e: OrderEvent) => {
      if (e.userId !== userId || seen.has(e.id)) return // evento de outra sessão/usuário ou duplicado
      seen.add(e.id)
      qc.setQueryData<Order>(['order', e.resourceId], (o) => (o && e.version > o.version ? { ...o, ...e.data, version: e.version } : o)) // terminal/antigo não regride
      qc.invalidateQueries({ queryKey: ['cart'] })
      setNotice(e.data.status === 'confirmed' ? 'Pedido confirmado.' : e.data.status === 'rejected' ? 'Pedido recusado.' : '')
    }
    const onConnect = () => qc.invalidateQueries() // reconcilia com a API REST após (re)conexão
    socket.on('nft.updated', onNft)
    socket.on('order.updated', onOrder)
    socket.on('connect', onConnect)
    return () => { socket.off('nft.updated', onNft); socket.off('order.updated', onOrder); socket.off('connect', onConnect); socket.disconnect() }
  }, [userId, qc])
  return notice
}
