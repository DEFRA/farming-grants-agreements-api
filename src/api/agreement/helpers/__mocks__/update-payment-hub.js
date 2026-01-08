import { vi } from 'vitest'

export const updatePaymentHub = vi.fn().mockImplementation(() => ({
  status: 'success',
  message: 'Payload sent to payment hub successfully'
}))
