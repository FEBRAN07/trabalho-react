export type UserProfile = 'ATENDENTE' | 'TECNICO'
export interface User {
  id: string
  name: string
  email: string
  profile: UserProfile
  active: boolean
  createdAt: string
}
export interface UserInput {
  name: string
  email: string
  password: string
  profile: UserProfile
  active: boolean
}
export function validateUser(input: UserInput, editing = false) {
  const errors: Partial<Record<keyof UserInput, string>> = {}
  if (!input.name.trim()) errors.name = 'Informe o nome.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) errors.email = 'Informe um e-mail válido.'
  if (!editing && !input.password.trim()) errors.password = 'Informe a senha.'
  if (!['ATENDENTE', 'TECNICO'].includes(input.profile)) errors.profile = 'Selecione um perfil válido.'
  return errors
}
