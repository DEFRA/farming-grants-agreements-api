/**
 * Resolve the payment subdoc to persist on accept for a WMP agreement.
 *
 * WMP persists its payment subdoc at create time directly from the inbound
 * payload (Land Grants is not consulted — see plan.md §4.3). On accept we
 * simply reuse the persisted payment unchanged.
 * @param {object} agreementData
 * @returns {object} The payment subdoc to write back on accept.
 */
export const wmpResolveAcceptPayment = (agreementData) => agreementData.payment
