// view-pdf-agreement.controller.js (ESM)

import Boom from '@hapi/boom';
import puppeteer, { executablePath } from 'puppeteer';
import { PassThrough } from 'stream';

import { getHTMLAgreementDocument } from '~/src/api/agreement/helpers/get-html-agreement.js';
import { getAgreementDataById } from '~/src/api/agreement/helpers/get-agreement-data.js';
import { getBaseUrl } from '~/src/api/common/helpers/base-url.js';

/* ----------------------------- Constants ----------------------------- */

/* ----------------------------- Print CSS Fragments ----------------------------- */

const PRINT_HIDE_CHROME = `
  /* Hide chrome you don't want in PDFs */
  header, footer, .site-header, .site-footer, .govuk-header, .govuk-footer, .print-hide,
  .govuk-phase-banner, .govuk-notification-banner, .govuk-cookie-banner,
  .govuk-breadcrumbs, .service-navigation, .app-subnav, .app-side-nav, .side-nav,
  .sidebar, .banner, .cookie-banner {
    display: none !important;
  }
`;

const PRINT_FONTS_AND_BASE = `
  /* Emphasise <dt> in details list */
  dl.dataset-info dt { font-weight: 700 !important; color: #000 !important; }
  dl.dataset-info dd { font-weight: 400 !important; }

  /* Use GOV.UK font (adjust paths if needed) */
  @font-face {
    font-family: "GDS Transport";
    src: url("/assets/fonts/GDSTransport.woff2") format("woff2");
    font-weight: 400; font-style: normal; font-display: swap;
  }
  @font-face {
    font-family: "GDS Transport";
    src: url("/assets/fonts/GDSTransport-Bold.woff2") format("woff2");
    font-weight: 700; font-style: normal; font-display: swap;
  }
  body, .govuk-body, .govuk-table, .govuk-table th, .govuk-table td {
    font-family: "GDS Transport", Arial, Helvetica, sans-serif !important;
    font-size: 12pt !important; line-height: 1.55 !important;
  }
  .govuk-table th { font-weight: 700 !important; }
`;

const PRINT_NAMES_ROW_FIX = `
  /* Names row: match class containing "govuk-!-margin-top-3" safely */
  .govuk-grid-row[class~="govuk-!-margin-top-3"] {
    display: flex !important; flex-wrap: nowrap !important;
    align-items: flex-start !important; justify-content: space-between !important;
    gap: 1rem;
  }
  .govuk-grid-row[class~="govuk-!-margin-top-3"] > [class*="govuk-grid-column"] {
    float: none !important; width: auto !important; max-width: none !important;
    padding-left: 0 !important; padding-right: 0 !important; box-sizing: border-box !important;
  }
  .govuk-grid-row[class~="govuk-!-margin-top-3"] .govuk-grid-column-three-quarters {
    flex: 1 1 auto !important; min-width: 0 !important;
  }
  .govuk-grid-row[class~="govuk-!-margin-top-3"] .govuk-grid-column-one-quarter {
    flex: 0 0 auto !important; text-align: right !important;
    white-space: nowrap !important; margin-left: 1rem !important;
  }
  .govuk-grid-row[class~="govuk-!-margin-top-3"] h3,
  .govuk-grid-row[class~="govuk-!-margin-top-3"] p {
    margin: 0 0 2pt 0 !important;
  }
`;

const PRINT_TABLE_BASE = `
  /* Table lines + padding */
  .govuk-table th, .govuk-table td {
    border-bottom: 1px solid #b1b4b6 !important;
    padding: 6pt 8pt !important; vertical-align: top !important;
  }
  .govuk-table thead th { border-bottom: 2px solid #000 !important; }
`;

const PRINT_TABLE_SUMMARY_OF_ACTIONS = `
  /* Summary of actions */
  .soa-table { table-layout: fixed !important; width: 100% !important; border-collapse: collapse !important; font-size: 10pt !important; }
  .soa-table th, .soa-table td { padding: 6pt 8pt !important; }
  .soa-table th:nth-child(1), .soa-table td:nth-child(1) { width: 28mm !important; white-space: nowrap !important; }
  .soa-table th:nth-child(2), .soa-table td:nth-child(2) { width: 18mm !important; white-space: nowrap !important; }
  .soa-table th:nth-child(3), .soa-table td:nth-child(3) { width: auto !important; overflow-wrap: anywhere !important; word-break: break-word !important; hyphens: auto !important; }
  .soa-table th:nth-child(4), .soa-table td:nth-child(4) { width: 22mm !important; text-align: right !important; }
  .soa-table th:nth-child(5), .soa-table td:nth-child(5) { width: 24mm !important; white-space: nowrap !important; }
  .soa-table th:nth-child(6), .soa-table td:nth-child(6) { width: 24mm !important; white-space: nowrap !important; }
  .soa-table tbody tr:nth-child(even) td { background: #f6f6f6 !important; }
`;

const PRINT_TABLE_SUMMARY_OF_PAYMENTS = `
  /* Summary of payments */
  .summary-of-payment-table { table-layout: fixed !important; width: 100% !important; border-collapse: collapse !important; font-size: 10pt !important; }
  .summary-of-payment-table th, .summary-of-payment-table td { padding: 6pt 8pt !important; }
  .summary-of-payment-table th:nth-child(1), .summary-of-payment-table td:nth-child(1) { width: 24mm !important; white-space: nowrap !important; }
  .summary-of-payment-table th:nth-child(2), .summary-of-payment-table td:nth-child(2) {
    width: 50mm !important; white-space: normal !important; overflow-wrap: anywhere !important; word-break: break-word !important; hyphens: auto !important;
  }
  .summary-of-payment-table th:nth-child(3), .summary-of-payment-table td:nth-child(3) { width: 22mm !important; }
  .summary-of-payment-table th:nth-child(4), .summary-of-payment-table td:nth-child(4) { width: 22mm !important; text-align: right !important; }
  .summary-of-payment-table th:nth-child(5), .summary-of-payment-table td:nth-child(5) { width: 24mm !important; white-space: nowrap !important; }
  .summary-of-payment-table tbody tr:nth-child(even) td { background: #f6f6f6 !important; }
`;

const PRINT_TABLE_LAND_COVERED = `
  /* Land covered */
  .land-coverd-table.govuk-table .govuk-table__header,
  .land-coverd-table.govuk-table .govuk-table__cell,
  .land-coverd-table th.govuk-table__header, .land-coverd-table td.govuk-table__cell,
  .land-coverd-table th, .land-coverd-table td {
    padding: 6pt 8pt !important; text-align: left !important; vertical-align: top !important; box-sizing: border-box !important;
  }
  .land-coverd-table th:nth-child(1), .land-coverd-table td:nth-child(1) {
    width: 50mm !important; white-space: normal !important; overflow-wrap: anywhere !important; word-break: break-word !important; hyphens: auto !important;
  }
  .land-coverd-table th:nth-child(2), .land-coverd-table td:nth-child(2) {
    width: 25mm !important; text-align: right !important; white-space: nowrap !important;
  }
`;

/* ----------------------------- Combined ----------------------------- */

const PRINT_CSS = `
@media print {
  ${PRINT_HIDE_CHROME}
  ${PRINT_FONTS_AND_BASE}
  ${PRINT_NAMES_ROW_FIX}
  ${PRINT_TABLE_BASE}
  ${PRINT_TABLE_SUMMARY_OF_ACTIONS}
  ${PRINT_TABLE_SUMMARY_OF_PAYMENTS}
  ${PRINT_TABLE_LAND_COVERED}
}
`;

/* ----------------------------- Helpers ------------------------------ */

const buildHtmlWithBase = (html, baseUrl) =>
  html.includes('<base ')
    ? html
    : html.replace(/<head([^>]*)>/i, `<head$1><base href="${baseUrl}">`);

const postProcessDom = () => {
  // Remove non-print UI
  const selectors = [
    'header','footer','nav','aside',
    '.govuk-header','.govuk-footer',
    '.govuk-phase-banner','.govuk-notification-banner',
    '.govuk-cookie-banner','.govuk-back-link',
    '.app-side-nav','.side-nav','.sidebar','.banner','.cookie-banner',
    '.app-masthead','.govuk-breadcrumbs','.service-navigation','.app-subnav',
    '.print-hide',
    '.govuk-skip-link', '.skip-link', '.skiplink', '#skiplink-container',
    'a[href^="#main-content"]','a[href^="#content"]','a[href^="#main"]'
  ];
  document.querySelectorAll(selectors.join(',')).forEach(el => el.remove());

  // Expand main column if present
  const main = document.querySelector('.govuk-grid-column-two-thirds, .content-column, .main-content');
  if (main) Object.assign(main.style, { width: '100%', maxWidth: '100%', flex: '0 0 100%', paddingLeft: '0', paddingRight: '0' });

  // Tag tables by header set → add custom classes
  const tagTableByHeaders = (expected, className) => {
    document.querySelectorAll('table.govuk-table').forEach(tbl => {
      const heads = Array.from(tbl.querySelectorAll('thead th')).map(th => th.textContent.trim());
      if (expected.every(h => heads.includes(h))) tbl.classList.add(className);
    });
  };
  tagTableByHeaders(['Parcel','Code','Action','Total parcel area (ha)','Start date','End date'], 'soa-table');
  tagTableByHeaders(['Code','Year 1','Year 2','Year 3','Total payment'], 'payment-schedule-table');
  tagTableByHeaders(['Code','Action','Total area (ha)','Payment rate','Total yearly payment'], 'summary-of-payment-table');
  tagTableByHeaders(['Parcel','Total parcel area (ha)'], 'land-coverd-table');

  // Add colgroup to SOA table for extra stability
  const soa = document.querySelector('table.govuk-table.soa-table');
  if (soa) {
    const colgroup = document.createElement('colgroup');
    colgroup.innerHTML = `
      <col style="width:28mm">
      <col style="width:18mm">
      <col style="width:auto">
      <col style="width:22mm">
      <col style="width:24mm">
      <col style="width:24mm">
    `;
    const thead = soa.querySelector('thead');
    if (thead) soa.insertBefore(colgroup, thead);
  }

  // Grid dt/dd tidy
  document.querySelectorAll('dl.dataset-info').forEach(dl => {
    dl.style.display = 'grid';
    dl.style.gridTemplateColumns = 'max-content auto';
    dl.style.columnGap = '1rem';
    dl.querySelectorAll('dt, dd').forEach(el => {
      el.style.margin = '0';
      el.style.padding = '2px 0';
    });
  });
};

/* ----------------------------- Controller --------------------------- */

export const viewAgreementPDFController = {
  handler: async (request, h) => {
    const { agreementId } = request.params;
    const baseUrl = getBaseUrl(request);

    const agreementData = await getAgreementDataById(agreementId);
    if (!agreementData) throw Boom.notFound('Agreement not found');

    const renderedHtml = await getHTMLAgreementDocument(agreementId, agreementData, baseUrl);
    const htmlWithBase = buildHtmlWithBase(renderedHtml, baseUrl);

    const t0 = performance.now();
    let browser, page;

    try {
      // Launch Chromium
      const launchStart = performance.now();
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: await executablePath()
      });
      const tLaunch = performance.now() - launchStart;

      page = await browser.newPage();

      // Render HTML and post-process DOM
      const renderStart = performance.now();
      await page.setContent(htmlWithBase, { waitUntil: 'networkidle0' });
      await page.evaluate(postProcessDom);
      await page.emulateMediaType('print');
      await page.addStyleTag({ content: PRINT_CSS });
      const tRender = performance.now() - renderStart;

      // Generate the PDF
      const pdfStart = performance.now();
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        preferCSSPageSize: true
      });
      const tPdf = performance.now() - pdfStart;

      // Perf log
      const tTotal = performance.now() - t0;
      request.log(
        ['info'],
        `Puppeteer PDF generated ${pdfBuffer.length} bytes in ${tTotal.toFixed(1)}ms ` +
        `(launch:${tLaunch.toFixed(1)}ms, setContent+post:${tRender.toFixed(1)}ms, pdf:${tPdf.toFixed(1)}ms)`
      );
      request.log(['debug'], `HTML length: ${renderedHtml.length} chars`);

      // Stream response
      const stream = new PassThrough();
      stream.end(pdfBuffer);

      return h
        .response(stream)
        .type('application/pdf')
        .header('Content-Disposition', 'inline; filename="agreement.pdf"')
        .header('Cache-Control', 'no-cache, no-store, must-revalidate')
        .header('Pragma', 'no-cache')
        .header('Expires', '0')
        .header('Content-Encoding', 'identity')
        .header('Content-Length', String(pdfBuffer.length))
        .code(200);

    } catch (err) {
      request.log(['error'], err);
      throw Boom.badImplementation('Failed to generate PDF');
    } finally {
      try { await page?.close(); } catch {}
      try { await browser?.close(); } catch {}
    }
  }
};
