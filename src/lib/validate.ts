export const WALLET_TYPES = ['MetaMask', 'WalletConnect', 'Coinbase Wallet'] as const
export const NETWORKS = [{ id: 'ethereum', label: 'Ethereum' }, { id: 'polygon', label: 'Polygon' }, { id: 'arbitrum', label: 'Arbitrum' }] as const

export interface CheckoutForm {
  displayName: string; username: string; profileName: string; email: string; referralCode: string; ens: string
  walletAddress: string; secondary: string; walletType: string; network: string; note: string
}
export const EMPTY_FORM: CheckoutForm = { displayName: '', username: '', profileName: '', email: '', referralCode: '', ens: '', walletAddress: '', secondary: '', walletType: '', network: '', note: '' }

// Regras do formulário de pagamento. Usadas na UI e revalidadas pelo handler de pedidos.
export function validateCheckout(f: CheckoutForm): Record<string, string> {
  const e: Record<string, string> = {}
  if (f.displayName.trim().length < 3) e.displayName = 'Informe o nome de exibição (mín. 3 caracteres)'
  if (!/^[a-z0-9_]{3,20}$/i.test(f.username)) e.username = 'Use 3 a 20 caracteres: letras, números e _'
  if (f.profileName.trim().length < 3) e.profileName = 'Informe o nome do perfil (mín. 3 caracteres)'
  if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = 'E-mail inválido'
  if (!/^[a-z0-9]{4,12}$/i.test(f.referralCode)) e.referralCode = 'Código de 4 a 12 letras ou números'
  if (!/^[a-z0-9-]{3,30}$/i.test(f.ens)) e.ens = 'Informe o nome ENS, sem o .eth'
  if (!/^0x[0-9a-fA-F]{40}$/.test(f.walletAddress)) e.walletAddress = 'Endereço 0x inválido (42 caracteres)'
  if (f.secondary && !/^0x[0-9a-fA-F]{40}$/.test(f.secondary) && !/^[a-z0-9-]+\.eth$/i.test(f.secondary)) e.secondary = 'Use um endereço 0x ou um nome .eth'
  if (!WALLET_TYPES.some((w) => w === f.walletType)) e.walletType = 'Selecione o tipo de carteira'
  if (!NETWORKS.some((n) => n.id === f.network)) e.network = 'Selecione uma rede'
  if (f.note.length > 280) e.note = 'Máximo de 280 caracteres'
  return e
}

export interface WalletForm { displayName: string; nickname: string; network: string; profileName: string; walletAddress: string; secondary: string; walletType: string; referralCode: string; email: string; ens: string }
export const EMPTY_WALLET: WalletForm = { displayName: '', nickname: '', network: '', profileName: '', walletAddress: '', secondary: '', walletType: '', referralCode: '', email: '', ens: '' }
export function validateWallet(f: WalletForm): Record<string, string> {
  const e = validateCheckout({ ...EMPTY_FORM, ...f, username: 'user_ok', note: '' })
  delete e.username; delete e.note
  if (f.nickname.trim().length < 3) e.nickname = 'Informe o apelido da carteira (mín. 3 caracteres)'
  return e
}

export interface ProfileForm { displayName: string; username: string; email: string; ens: string; nickname: string }
export function validateProfile(f: ProfileForm, pw: { current: string; next: string; confirm: string }): Record<string, string> {
  const e: Record<string, string> = {}
  if (f.displayName.trim().length < 3) e.displayName = 'Informe o nome de exibição (mín. 3 caracteres)'
  if (!/^[a-z0-9_]{3,20}$/i.test(f.username)) e.username = 'Use 3 a 20 caracteres: letras, números e _'
  if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = 'E-mail inválido'
  if (!/^[a-z0-9-]{3,30}$/i.test(f.ens)) e.ens = 'Informe o nome ENS, sem o .eth'
  if (f.nickname.trim().length < 3) e.nickname = 'Informe o apelido da carteira (mín. 3 caracteres)'
  if (pw.current || pw.next || pw.confirm) {
    if (!pw.current) e.currentPassword = 'Informe a senha atual'
    if (pw.next.length < 8) e.newPassword = 'A nova senha precisa ter ao menos 8 caracteres'
    if (pw.confirm !== pw.next) e.confirmPassword = 'As senhas não coincidem'
  }
  return e
}
