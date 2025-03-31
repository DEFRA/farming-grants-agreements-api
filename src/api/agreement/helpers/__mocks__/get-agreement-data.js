const getAgreementData = jest.fn(() => ({
  agreementNumber: 'SFI123456789',
  agreementName: 'Sample Agreement',
  sbi: '123456789',
  company: 'Sample Farm Ltd',
  address: '123 Farm Lane, Farmville',
  postcode: 'FA12 3RM',
  username: 'John Doe',
  agreementStartDate: new Date('1/11/2024'),
  agreementEndDate: new Date('31/10/2027'),
  signatureDate: '1/11/2024',
  actions: [
    {
      code: 'CSAM1A',
      title:
        'Assess soil, test soil organic matter and produce a soil management plan',
      startDate: new Date('01/11/2024'),
      endDate: new Date('31/10/2027'),
      duration: '3 years'
    }
  ],
  parcels: [
    {
      parcelNumber: 'SX63599044',
      parcelName: '',
      totalArea: 0.7306,
      activities: []
    }
  ],
  payments: {
    activities: [],
    totalAnnualPayment: 3886.69,
    yearlyBreakdown: {
      details: [],
      annualTotals: {
        year1: 4365.45,
        year2: 4126.07,
        year3: 4126.07
      },
      totalAgreementPayment: 12617.59
    }
  }
}))

export { getAgreementData }
