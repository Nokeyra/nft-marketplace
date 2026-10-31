// ETH trafega como string decimal; cálculos em bigint (wei) para não perder precisão.
const ONE = 10n ** 18n
export const toWei = (s: string): bigint => {
  const [i, f = ''] = s.split('.')
  return BigInt(i || '0') * ONE + BigInt((f + '0'.repeat(18)).slice(0, 18))
}
export const fromWei = (w: bigint): string => {
  const neg = w < 0n, a = neg ? -w : w
  const frac = (a % ONE).toString().padStart(18, '0').replace(/0+$/, '')
  return `${neg ? '-' : ''}${a / ONE}${frac ? '.' + frac : ''}`
}
export const bps = (w: bigint, basisPoints: bigint) => (w * basisPoints) / 10000n
