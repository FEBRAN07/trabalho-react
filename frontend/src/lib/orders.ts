import { validateId } from './registry'

export interface ServiceOrder {
  number: string
  status: string
  problem: string
  createdAt: string
  createdBy: string
  client: { id: string; name: string; phone: string; email: string }
  equipment: { code: string; type: string; brand: string; model: string; serial: string }
}
export interface OpenOrder { number: string; status: string; problem: string; createdAt: string }
export interface OrderInput { clientId: string; equipmentCode: string; problem: string }
export interface OrderFilters { clientId?: string; status?: string }
export type OrderErrors = Partial<Record<keyof OrderInput, string>>

export function validateOrder(input: OrderInput): OrderErrors {
  const errors: OrderErrors = {}
  if (!validateId(input.clientId)) errors.clientId = 'Selecione um cliente cadastrado.'
  if (!validateId(input.equipmentCode)) errors.equipmentCode = 'Selecione um equipamento deste cliente.'
  if (!input.problem.trim() || input.problem.trim().length > 1000) errors.problem = 'Informe o problema relatado (até 1000 caracteres).'
  return errors
}
