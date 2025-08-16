import path from 'node:path'

import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { getAgreementDocumentData } from '~/src/api/agreement/helpers/get-html-agreement.js'
import { generateSamplePDFDoc } from '~/src/api/agreement/helpers/pdf/pdf-generator.js'
import { generateAgreementPdfBuffer } from '~/src/api/agreement/helpers/pdf/pdfkit-gen.js'
import { getAgreementDataById } from '~/src/api/agreement/helpers/get-agreement-data.js'
import { getBaseUrl } from '~/src/api/common/helpers/base-url.js'
import { validateJwtAuthentication } from '~/src/api/common/helpers/jwt-auth.js'
import puppeteer, { executablePath } from 'puppeteer';
import { PassThrough } from 'stream';

/**
 * Controller to serve HTML agreement document
 * Renders a Nunjucks template with agreement data
 * @satisfies {Partial<ServerRoute>}
 */

export const viewAgreementPDFKitController = {
  handler: async (request, h) => {
    const { agreementId } = request.params
    const baseUrl = getBaseUrl(request)

    const agreementData = await getAgreementDataById(agreementId)
    if (!agreementData) throw Boom.notFound('Agreement not found');

    // get HTML agreement
      const agreementHtml = await getAgreementDocumentData(
        agreementId,
        agreementData,
        baseUrl
      )

    console.log('Agreement DATA ********** ', JSON.stringify(agreementHtml))
    console.log('****** actions headers:', agreementHtml.summaryOfActions?.headings?.length);
    console.log('****** actions rows:', agreementHtml.summaryOfActions?.data?.length);
    console.log('****** schedule headers:', agreementHtml.annualPaymentSchedule?.headings?.length);
    console.log('****** schedule rows:', agreementHtml.annualPaymentSchedule?.data?.length);

    const start = Date.now();
    const buf = await generateAgreementPdfBuffer(agreementHtml);
    // const buf = await drawTable(agreementHtml);
    const ms = Date.now() - start;
    request.log(['info'], `PDFKit generated ${buf.length} bytes in ${ms}ms`);

    const stream = new PassThrough();
    stream.end(buf);

    return h.response(stream)
      .type('application/pdf')
      .header('Content-Disposition', 'inline; filename="agreement.pdf"')
      .header('Content-Length', String(buf.length))
      .header('Content-Encoding', 'identity') // avoid proxies re-encoding
      .code(200);
  }
};