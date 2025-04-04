export const updatePaymentHub = jest.fn().mockImplementation(() => ({
  status: 'success',
  message: 'Payload sent to payment hub successfully'
}))
