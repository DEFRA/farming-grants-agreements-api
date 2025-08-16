import path from 'node:path'
import Boom from '@hapi/boom'

import { statusCodes } from '~/src/api/common/constants/status-codes.js'
import { getHTMLAgreementDocument } from '~/src/api/agreement/helpers/get-html-agreement.js'
import { generateSamplePDFDoc } from '~/src/api/agreement/helpers/pdf/pdf-generator.js'
import { getBrowser, closeBrowser } from '~/src/api/agreement/helpers/pdf/pdf-browser.js'
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

export const viewAgreementPDFController = {
  handler: async (request, h) => {
    const { agreementId } = request.params;
    const baseUrl = getBaseUrl(request);

    const agreementData = await getAgreementDataById(agreementId);
    if (!agreementData) throw Boom.notFound('Agreement not found');

    
    const renderedHtml = await getHTMLAgreementDocument(agreementId, agreementData, baseUrl);

    const PRINT_CSS = `@media print {
                          /* Hide chrome you don't want in PDFs */
                          header, footer, .site-header, .site-footer, .govuk-header, .govuk-footer, .print-hide,
                          .govuk-phase-banner, .govuk-notification-banner, .govuk-cookie-banner,
                          .govuk-breadcrumbs, .service-navigation, .app-subnav, .app-side-nav, .side-nav, .sidebar, .banner, .cookie-banner {
                            display: none !important;
                          }

                          dl.dataset-info dt {
                            font-weight: 700 !important;
                            color: #000 !important;          /* ensure it's strong in print */
                          }
                          dl.dataset-info dd {
                            font-weight: 400 !important;
                          }


                          /* Use GOV.UK font (adjust paths if needed) */
                          @font-face {
                            font-family: "GDS Transport";
                            src: url("/assets/fonts/GDSTransport.woff2") format("woff2");
                            font-weight: 400;
                            font-style: normal;
                            font-display: swap;
                          }
                          @font-face {
                            font-family: "GDS Transport";
                            src: url("/assets/fonts/GDSTransport-Bold.woff2") format("woff2");
                            font-weight: 700;
                            font-style: normal;
                            font-display: swap;
                          }
                          body, .govuk-body, .govuk-table, .govuk-table th, .govuk-table td {
                            font-family: "GDS Transport", Arial, Helvetica, sans-serif !important;
                            font-size: 12pt !important;
                            line-height: 1.55 !important;
                          }
                          .govuk-table th { font-weight: 700 !important; }

                          /* ---- FIX THE ROW WITH NAMES ----
                            Use attribute selector to match the class with "!" safely */
                          .govuk-grid-row[class~="govuk-!-margin-top-3"] {
                            display: flex !important;
                            flex-wrap: nowrap !important;         /* keep in one line */
                            align-items: flex-start !important;
                            justify-content: space-between !important;
                            gap: 1rem;
                          }
                          /* neutralise grid floats/widths for JUST this row's columns */
                          .govuk-grid-row[class~="govuk-!-margin-top-3"] > [class*="govuk-grid-column"] {
                            float: none !important;
                            width: auto !important;
                            max-width: none !important;
                            padding-left: 0 !important;
                            padding-right: 0 !important;
                            box-sizing: border-box !important;
                          }
                          /* Left column grows and can wrap; SBI sits under farm name naturally */
                          .govuk-grid-row[class~="govuk-!-margin-top-3"] .govuk-grid-column-three-quarters {
                            flex: 1 1 auto !important;
                            min-width: 0 !important;
                          }
                          /* Right column hugs content, right-aligned, no wrap */
                          .govuk-grid-row[class~="govuk-!-margin-top-3"] .govuk-grid-column-one-quarter {
                            flex: 0 0 auto !important;
                            text-align: right !important;
                            white-space: nowrap !important;
                            margin-left: 1rem !important;
                          }
                          /* tighten heading/paragraph spacing in that row */
                          .govuk-grid-row[class~="govuk-!-margin-top-3"] h3,
                          .govuk-grid-row[class~="govuk-!-margin-top-3"] p {
                            margin: 0 0 2pt 0 !important;
                          }

                          /* ---- TABLE LINES (your earlier request) ---- */
                          .govuk-table th, .govuk-table td {
                            border-bottom: 1px solid #b1b4b6 !important;
                            padding: 6pt 8pt !important;
                            vertical-align: top !important;
                          }
                          .govuk-table thead th {
                            border-bottom: 2px solid #000 !important;
                          }

                          /* ---- YOUR EXISTING PER-TABLE RULES (examples) ---- */
                          /* Summary of actions */
                          .soa-table { table-layout: fixed !important; width: 100% !important; border-collapse: collapse !important; font-size: 10pt !important; }
                          .soa-table th, .soa-table td { padding: 6pt 8pt !important; }
                          .soa-table th:nth-child(1), .soa-table td:nth-child(1) { width: 28mm !important; white-space: nowrap !important; }
                          .soa-table th:nth-child(2), .soa-table td:nth-child(2) { width: 18mm !important; white-space: nowrap !important; }
                          .soa-table th:nth-child(3), .soa-table td:nth-child(3) { width: auto !important; overflow-wrap: anywhere !important; word-break: break-word !important; hyphens: auto !important; }
                          .soa-table th:nth-child(4), .soa-table td:nth-child(4) { width: 22mm !important; text-align: right !important; }
                          .soa-table th:nth-child(5), .soa-table td:nth-child(5) { width: 24mm !important; white-space: nowrap !important; }
                          .soa-table th:nth-child(6), .soa-table td:nth-child(6) { width: 24mm !important; white-space: nowrap !important; }

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

                          /* Land covered */
                          .land-coverd-table.govuk-table .govuk-table__header,
                          .land-coverd-table.govuk-table .govuk-table__cell,
                          .land-coverd-table th.govuk-table__header,
                          .land-coverd-table td.govuk-table__cell,
                          .land-coverd-table th, .land-coverd-table td {
                            padding: 6pt 8pt !important; text-align: left !important; vertical-align: top !important; box-sizing: border-box !important;
                          }
                          .land-coverd-table th:nth-child(1), .land-coverd-table td:nth-child(1) {
                            width: 50mm !important; white-space: normal !important; overflow-wrap: anywhere !important; word-break: break-word !important; hyphens: auto !important;
                          }
                          .land-coverd-table th:nth-child(2), .land-coverd-table td:nth-child(2) {
                            width: 25mm !important; text-align: right !important; white-space: nowrap !important;
                          }
                        }
                        `

    // 1) RAW CSS (no <style> wrapper)
const PRINT_CSS_OLD = `
                  @media print {
                    /* Hide chrome you don't want in PDFs */
                    header, footer, .site-header, .site-footer, .govuk-header, .govuk-footer, .print-hide,
                    .govuk-phase-banner, .govuk-notification-banner, .govuk-cookie-banner,
                    .govuk-breadcrumbs, .service-navigation, .app-subnav, .app-side-nav, .side-nav, .sidebar, .banner, .cookie-banner {
                      display: none !important;
                      visibility: hidden !important;
                      height: 0 !important;
                      margin: 0 !important;
                      padding: 0 !important;
                      overflow: hidden !important;
                    }

                    .govuk-grid-row.govuk-!-margin-top-3 {
                      display: flex !important;
                      justify-content: space-between !important;
                      align-items: flex-start !important;
                      flex-wrap: wrap !important;
                    }

                    /* Left column takes most of the space */
                    .govuk-grid-row.govuk-!-margin-top-3 .govuk-grid-column-three-quarters {
                      flex: 1 1 auto !important;
                      max-width: 75% !important;
                    }

                    /* Right column hugs content */
                    .govuk-grid-row.govuk-!-margin-top-3 .govuk-grid-column-one-quarter {
                      flex: 0 0 auto !important;
                      text-align: right !important;
                    }

                    /* Reduce extra margins for tighter print */
                    .govuk-grid-row.govuk-!-margin-top-3 h3,
                    .govuk-grid-row.govuk-!-margin-top-3 p {
                      margin: 0 0 2pt 0 !important;
                    }

                    /* Keep SBI under Agile Farm */
                    #sbi {
                      display: block !important;
                    }

                    .govuk-table th,
                    .govuk-table td {
                      border-bottom: 1px solid #b1b4b6 !important; /* light grey line */
                      padding: 6pt 8pt !important;
                    }

                    /* Optional: thicker line under header row */
                    .govuk-table thead th {
                      border-bottom: 2px solid #000 !important;
                    }

                    @font-face {
                      font-family: "GDS Transport";
                      src: url("/assets/fonts/GDSTransport.woff2") format("woff2"); /* adjust path */
                      font-weight: 400;
                      font-style: normal;
                      font-display: swap;
                    }
                    @font-face {
                      font-family: "GDS Transport";
                      src: url("/assets/fonts/GDSTransport-Bold.woff2") format("woff2");
                      font-weight: 700;
                      font-style: normal;
                      font-display: swap;
                    }

                    body,
                    .govuk-body,
                    .govuk-table,
                    .govuk-table th,
                    .govuk-table td {
                      font-family: "GDS Transport", Arial, Helvetica, sans-serif !important;
                      font-size: 12pt !important;
                      line-height: 1.55 !important;
                    }

                    .govuk-table th { font-weight: 700 !important; }
                  

                    /* Keep headers bold only */
                    .govuk-table th,
                    .govuk-table__header { font-weight: 700 !important; }

                    /* Keep skip links out of print */
                    .govuk-skip-link, .skip-link, .skiplink, #skiplink-container,
                    a[href^="#main-content"], a[href^="#content"], a[href^="#main"] {
                      display: none !important;
                    }

                    /* The problematic row: force a single flex row, two columns */
                    .govuk-grid-row.govuk-!-margin-top-3 {
                      display: flex !important;
                      flex-direction: row !important;
                      flex-wrap: nowrap !important;
                      align-items: flex-start !important;
                      justify-content: space-between !important; /* gap in middle */
                      gap: 1rem;
                    }

                    /* Kill legacy float/width on just this row’s columns */
                    .govuk-grid-row.govuk-!-margin-top-3 > [class*="govuk-grid-column"] {
                      float: none !important;
                      width: auto !important;
                      padding-left: 0 !important;
                      padding-right: 0 !important;
                      box-sizing: border-box;
                    }

                    /* Left column: lets content wrap vertically; takes remaining space */
                    .govuk-grid-row.govuk-!-margin-top-3 > .govuk-grid-column-three-quarters {
                      flex: 1 1 auto !important;
                      min-width: 0 !important; /* allow flex shrink */
                    }

                    /* Right column: stays on same line, hugs content, aligned right */
                    .govuk-grid-row.govuk-!-margin-top-3 > .govuk-grid-column-one-quarter {
                      flex: 0 0 auto !important;
                      max-width: none !important;
                      text-align: right !important;
                      white-space: nowrap !important; /* keep "Alfred Waldron" on one line */
                      margin-left: 1rem !important;
                    }
                    
                    /* Tidy text spacing in that row */
                    .govuk-grid-row.govuk-!-margin-top-3 h3,
                    .govuk-grid-row.govuk-!-margin-top-3 p {
                      margin-top: 0 !important;
                      margin-bottom: 0.2rem !important;
                    }

                    /* Base styling for consistent look */
                    .land-coverd-table.govuk-table .govuk-table__header,
                    .land-coverd-table.govuk-table .govuk-table__cell,
                    .land-coverd-table th.govuk-table__header,
                    .land-coverd-table td.govuk-table__cell,
                    .land-coverd-table th,
                    .land-coverd-table td {
                      padding: 6pt 8pt 6pt 8pt !important;
                      text-align: left !important;
                      vertical-align: top !important;
                      box-sizing: border-box !important;
                    }

                    /* Parcel column — allow wrapping */
                    .land-coverd-table th:nth-child(1),
                    .land-coverd-table td:nth-child(1) {
                      width: 50mm !important;
                      white-space: normal !important;
                      overflow-wrap: anywhere !important;
                      word-break: break-word !important;
                      hyphens: auto !important;
                    }

                    /* Total parcel area — numeric, right aligned, no wrap */
                    .land-coverd-table th:nth-child(2),
                    .land-coverd-table td:nth-child(2) {
                      width: 25mm !important;
                      text-align: right !important;
                      white-space: nowrap !important;
                    }

                    .payment-schedule-table {
                        table-layout: fixed !important;
                        width: 100% !important;
                        border-collapse: collapse !important;
                        font-size: 10pt !important;
                      }

                      /* Make header and cells use identical padding + alignment */
                      .payment-schedule-table.govuk-table .govuk-table__header,
                      .payment-schedule-table.govuk-table .govuk-table__cell,
                      .payment-schedule-table th.govuk-table__header,
                      .payment-schedule-table td.govuk-table__cell,
                      .payment-schedule-table th,
                      .payment-schedule-table td {
                        padding: 6pt 8pt 6pt 8pt !important;   /* <-- same left/right padding */
                        text-align: left !important;
                        vertical-align: top !important;
                        box-sizing: border-box !important;
                      }

                      /* Column widths + specific alignment (keeps numbers right-aligned) */
                      .payment-schedule-table th:nth-child(1), .payment-schedule-table td:nth-child(1) { width: 24mm !important; white-space: nowrap !important; }
                      .payment-schedule-table th:nth-child(2), .payment-schedule-table td:nth-child(2) { width: 22mm !important; white-space: nowrap !important; }
                      .payment-schedule-table th:nth-child(3), .payment-schedule-table td:nth-child(3) { width: 22mm !important; overflow-wrap: anywhere !important; word-break: break-word !important; hyphens: auto !important; }
                      .payment-schedule-table th:nth-child(4), .payment-schedule-table td:nth-child(4) { width: 22mm !important; text-align: right !important; }
                      .payment-schedule-table th:nth-child(5), .payment-schedule-table td:nth-child(5) { width: 22mm !important; white-space: nowrap !important; }
                      .payment-schedule-table th:nth-child(6), .payment-schedule-table td:nth-child(6) { width: 24mm !important; white-space: nowrap !important; }

                      /* Optional zebra */
                      .payment-schedule-table tbody tr:nth-child(even) td { background: #f6f6f6 !important; }                     

                     .summary-of-payment-table {
                        table-layout: fixed !important;
                        width: 100% !important;
                        border-collapse: collapse !important;
                        font-size: 10pt !important;
                      }

                      /* Make header and cells use identical padding + alignment */
                      .summary-of-payment-table.govuk-table .govuk-table__header,
                      .summary-of-payment-table.govuk-table .govuk-table__cell,
                      .summary-of-payment-table th.govuk-table__header,
                      .summary-of-payment-table td.govuk-table__cell,
                      .summary-of-payment-table th,
                      .summary-of-payment-table td {
                        padding: 6pt 8pt 6pt 8pt !important;   /* <-- same left/right padding */
                        text-align: left !important;
                        vertical-align: top !important;
                        box-sizing: border-box !important;
                      }

                      /* Column widths + specific alignment (keeps numbers right-aligned) */
                      .summary-of-payment-table th:nth-child(1), .summary-of-payment-table td:nth-child(1) { width: 24mm !important; white-space: nowrap !important; }
                      
                      .summary-of-payment-table th:nth-child(2),
                      .summary-of-payment-table td:nth-child(2) {
                        width: 50mm !important;                /* tweak this value until it fits nicely */
                        white-space: normal !important;        /* allow wrapping */
                        overflow-wrap: anywhere !important;    /* break at any point if needed */
                        word-break: break-word !important;     /* break long words */
                        hyphens: auto !important;               /* nicer hyphenation if supported */
                      }

                      
                      .summary-of-payment-table th:nth-child(3), .summary-of-payment-table td:nth-child(3) { width: 22mm !important; overflow-wrap: anywhere !important; word-break: break-word !important; hyphens: auto !important; }
                      .summary-of-payment-table th:nth-child(4), .summary-of-payment-table td:nth-child(4) { width: 22mm !important; text-align: right !important; }
                      .summary-of-payment-table th:nth-child(5), .summary-of-payment-table td:nth-child(5) { width: 24mm !important; white-space: nowrap !important; }
                      
                      /* Optional zebra */
                      .summary-of-payment-table tbody tr:nth-child(even) td { background: #f6f6f6 !important; }

                    

                    .soa-table {
                        table-layout: fixed !important;
                        width: 100% !important;
                        border-collapse: collapse !important;
                        font-size: 10pt !important;
                      }

                      /* Make header and cells use identical padding + alignment */
                      .soa-table.govuk-table .govuk-table__header,
                      .soa-table.govuk-table .govuk-table__cell,
                      .soa-table th.govuk-table__header,
                      .soa-table td.govuk-table__cell,
                      .soa-table th,
                      .soa-table td {
                        padding: 6pt 8pt 6pt 8pt !important;   /* <-- same left/right padding */
                        text-align: left !important;
                        vertical-align: top !important;
                        box-sizing: border-box !important;
                      }

                      /* Column widths + specific alignment (keeps numbers right-aligned) */
                      .soa-table th:nth-child(1), .soa-table td:nth-child(1) { width: 28mm !important; white-space: nowrap !important; }
                      .soa-table th:nth-child(2), .soa-table td:nth-child(2) { width: 18mm !important; white-space: nowrap !important; }
                      .soa-table th:nth-child(3), .soa-table td:nth-child(3) { width: auto !important; overflow-wrap: anywhere !important; word-break: break-word !important; hyphens: auto !important; }
                      .soa-table th:nth-child(4), .soa-table td:nth-child(4) { width: 22mm !important; text-align: right !important; }
                      .soa-table th:nth-child(5), .soa-table td:nth-child(5) { width: 24mm !important; white-space: nowrap !important; }
                      .soa-table th:nth-child(6), .soa-table td:nth-child(6) { width: 24mm !important; white-space: nowrap !important; }

                      /* Optional zebra */
                      .soa-table tbody tr:nth-child(even) td { background: #f6f6f6 !important; }

                    /* Your <dl> alignment for dataset-info */
                    dl.dataset-info {
                      display: grid !important;
                      grid-template-columns: max-content auto !important;
                      column-gap: 1rem !important;
                    }
                    dl.dataset-info dt, dl.dataset-info dd {
                      margin: 0 !important;
                      padding: 2px 0 !important;
                    }
                  }
                  `;


    const start = Date.now();
 
   const htmlWithBase = renderedHtml.includes('<base ')
                        ? renderedHtml
                        : renderedHtml.replace(/<head([^>]*)>/i, `<head$1><base href="${baseUrl}">`);

    const t0 = performance.now();  

    // Launch Chromium (or reuse a pooled browser if you have one)
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: await executablePath(),
    });

    const t1 = performance.now();

    const page = await browser.newPage();

    try {
      await page.setContent(htmlWithBase, { waitUntil: 'networkidle0' });

      await page.evaluate(() => {
        const selectors = [
          'header','footer','nav','aside',
          '.govuk-header','.govuk-footer',
          '.govuk-phase-banner','.govuk-notification-banner',
          '.govuk-cookie-banner','.govuk-back-link',
          '.app-side-nav','.side-nav','.sidebar','.banner','.cookie-banner',
          '.app-masthead','.govuk-breadcrumbs','.service-navigation','.app-subnav',
          '.print-hide'
        ];
        document.querySelectorAll(selectors.join(',')).forEach(el => el.remove());

        document.querySelectorAll(
          '.govuk-skip-link, .skip-link, .skiplink, #skiplink-container, a[href^="#main-content"], a[href^="#content"], a[href^="#main"]'
        ).forEach(el => el.remove());

        // optional: expand main column to full width if a sidebar existed
        const main = document.querySelector('.govuk-grid-column-two-thirds, .content-column, .main-content');
        if (main) {
          Object.assign(main.style, {
            width: '100%', maxWidth: '100%', flex: '0 0 100%',
            paddingLeft: '0', paddingRight: '0'
          });
        }

        const tagTableByHeaders = (expectedHeaders, className) => {
          document.querySelectorAll('table.govuk-table').forEach(tbl => {
            const headers = Array.from(tbl.querySelectorAll('thead th'))
              .map(th => th.textContent.trim());
            if (expectedHeaders.every(h => headers.includes(h))) {
              tbl.classList.add(className);
            }
          });
        };

        tagTableByHeaders(
          ['Parcel', 'Code', 'Action', 'Total parcel area (ha)', 'Start date', 'End date'],
          'soa-table'
        );

        tagTableByHeaders(
          ['Code', 'Year 1', 'Year 2', 'Year 3', 'Total payment'],
          'payment-schedule-table'
        );

        tagTableByHeaders(
          ['Code', 'Action', 'Total area (ha)', 'Payment rate', 'Total yearly payment'],
          'summary-of-payment-table'
        );

        tagTableByHeaders(
          ['Parcel', 'Total parcel area (ha)'],
          'land-coverd-table'
        );



        const tbl = document.querySelector('table.govuk-table.soa-table');
        if (!tbl) return;
        const colgroup = document.createElement('colgroup');
        colgroup.innerHTML = `
          <col style="width:28mm">
          <col style="width:18mm">
          <col style="width:auto">
          <col style="width:22mm">
          <col style="width:24mm">
          <col style="width:24mm">
        `;
        const thead = tbl.querySelector('thead');
        tbl.insertBefore(colgroup, thead);

        // === FIX dl/dt/dd print alignment ===
        document.querySelectorAll('dl.dataset-info').forEach(dl => {
          dl.style.display = 'grid';
          dl.style.gridTemplateColumns = 'max-content auto';
          dl.style.columnGap = '1rem';
          dl.querySelectorAll('dt, dd').forEach(el => {
            el.style.margin = '0';
            el.style.padding = '2px 0';
          });
        });
      });


      await page.emulateMediaType('print');  
      await page.addStyleTag({ content: PRINT_CSS });
      const t2 = performance.now();

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        preferCSSPageSize: true,
      });

      const t3 = performance.now();

      await page.close();
      await browser.close(); // close here (or keep a pool elsewhere)

      // Perf logs
      const total = (t3 - t0).toFixed(1);
      const launch = (t1 - t0).toFixed(1);
      const render = (t2 - t1).toFixed(1);
      const print = (t3 - t2).toFixed(1);

      request.log(
        ['info'],
        `Puppeteer PDF generated ${pdfBuffer.length} bytes in ${total}ms (launch:${launch}ms, setContent:${render}ms, pdf:${print}ms)`
        );
      // Optional: also log HTML size if you want to correlate content length
      request.log(['debug'], `HTML length: ${renderedHtml.length} chars`);

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
      try { await page.close(); } catch {}
      try { await browser.close(); } catch {}
      request.log(['error'], err);
      throw Boom.badImplementation('Failed to generate PDF');
    }
  }
};