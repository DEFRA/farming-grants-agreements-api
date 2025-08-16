// pdfkit-gen.js (ESM)
import PDFDocument from 'pdfkit';
// Try both: side-effect patch AND function export
import PDFTable from 'pdfkit-table';

const drawTable = (doc, { title, headers, rows }, opts = {}) => {
  const {
    x = doc.page.margins.left,
    y = doc.y,
    rowHeight = 16,
    headerHeight = 18,
    zebra = true,
    padding = 4,
    widths = [] // optional fixed widths; otherwise auto-split equally
  } = opts;

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const cols = headers.length;
  const colWidths = widths.length === cols ? widths : Array(cols).fill(pageWidth / cols);

  // Title
  if (title) {
    doc.font('Helvetica-Bold').fontSize(12).text(title, x, y);
    doc.moveDown(0.5);
  }
  let cursorY = doc.y;

  const ensureSpace = (needed) => {
    if (cursorY + needed > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      cursorY = doc.page.margins.top;
    }
  };

  // Header
  ensureSpace(headerHeight + 2);
  doc.save();
  doc.rect(x, cursorY, pageWidth, headerHeight).fillOpacity(0.08).fill('#000').fillOpacity(1);
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(9);

  let cx = x;
  headers.forEach((h, i) => {
    doc.text(String(h), cx + padding, cursorY + padding, { width: colWidths[i] - padding * 2 });
    cx += colWidths[i];
  });
  cursorY += headerHeight;
  doc.restore();

  // Rows
  doc.font('Helvetica').fontSize(9);
  rows.forEach((r, ri) => {
    ensureSpace(rowHeight + 2);
    if (zebra && ri % 2 === 1) {
      doc.save();
      doc.rect(x, cursorY, pageWidth, rowHeight).fillOpacity(0.04).fill('#000').fillOpacity(1);
      doc.restore();
    }
    let cxr = x;
    r.forEach((cell, i) => {
      doc.fillColor('#000')
         .text(String(cell ?? ''), cxr + padding, cursorY + 3, { width: colWidths[i] - padding * 2 });
      cxr += colWidths[i];
    });
    cursorY += rowHeight;
  });

  doc.moveTo(x, cursorY).moveDown(0.5); // advance doc.y nicely
  doc.y = cursorY + 6;
};

export const generateAgreementPdfBuffer = async (agreement) => {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  const chunks = [];
  doc.on('data', c => chunks.push(c));
  const finished = new Promise((res, rej) => {
    doc.on('end', res);
    doc.on('error', rej);
  });

  // Header
  doc.fontSize(18).text('Agile Farm agreement', { align: 'center' }).moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(11).text('Agreement holder:', { continued: true })
    .font('Helvetica').text(` ${agreement.company ?? agreement.username ?? ''}`);
  doc.font('Helvetica-Bold').text('SBI:', { continued: true })
    .font('Helvetica').text(` ${agreement.sbi ?? ''}`);
  doc.font('Helvetica-Bold').text('Address:', { continued: true })
    .font('Helvetica').text(` ${agreement.address ?? ''}`);
  doc.moveDown();

  doc.font('Helvetica-Bold').fontSize(13).text('1. Introduction and overview');
  doc.moveDown(0.25);
  doc.font('Helvetica').fontSize(10)
    .text('This Agreement Document describes your selected actions and associated payments.');
  doc.moveDown();

  // ===== Summary of actions (uses your exact structure) =====
  const soa = agreement.summaryOfActions;
  if (soa?.headings?.length && soa?.data?.length) {
    const headers = soa.headings.map(h => h?.text ?? '');
    const rows = soa.data.map(r => r.map(c => c?.text ?? ''));

    drawTable(doc, {
      title: '4. Summary of actions',
      headers,
      rows
    });
  } else {
    doc.font('Helvetica-Oblique').fontSize(9).fillColor('#666')
      .text('No actions to display')
      .fillColor('#000')
      .moveDown();
  }

  const sop = agreement.summaryOfPayments;
  if (sop?.headings?.length && sop?.data?.length) {
    drawTable(doc, {
      title: '5. Summary of payments',
      headers: sop.headings.map(h => h?.text ?? ''),
      rows: sop.data.map(r => r.map(c => c?.text ?? ''))
    });
  }


//   (Optional) Annual payment schedule — apply the same approach
  const aps = agreement.annualPaymentSchedule;
  if (aps?.headings?.length && aps?.data?.length) {
    drawTable(doc, {
      title: '6. Payment schedule',
      headers: aps.headings.map(h => h?.text ?? ''),
      rows: aps.data.map(r => r.map(c => c?.text ?? ''))
    });
  }

  

  // Footer
  const range = doc.bufferedPageRange();
  doc.end();
  await finished;

  // Add page numbers after end? With manual draw we didn't buffer pages.
  // If you need page numbers, switch to bufferedPageRange by creating the doc with { bufferPages: true }

  return Buffer.concat(chunks);
};


// export const generateAgreementPdfBuffer = async (agreement) => {
//   const doc = new PDFDocument({ size: 'A4', margin: 50 });

//   // collect bytes
//   const chunks = [];
//   doc.on('data', (c) => chunks.push(c));
//   const finished = new Promise((resolve, reject) => {
//     doc.on('end', resolve);
//     doc.on('error', reject);
//   });

//   // helper that renders a table with whatever API your pdfkit-table exposes
//   const renderTable = async (table, options = {}) => {
//     // prefer patched method if present
//     if (typeof doc.table === 'function') {
//       const maybe = doc.table(table, options);
//       if (maybe && typeof maybe.then === 'function') await maybe; // await async layout
//       return;
//     }
//     // fall back to function style export
//     if (typeof PDFTable === 'function') {
//       const maybe = PDFTable(doc, table, options);
//       if (maybe && typeof maybe.then === 'function') await maybe;
//       return;
//     }
//     // last resort: draw headers and rows as plain text so you see *something*
//     const { headers = [], rows = [] } = table;
//     doc.font('Helvetica-Bold').fontSize(9).text(headers.join(' | '));
//     doc.moveDown(0.25);
//     doc.font('Helvetica').fontSize(9);
//     rows.forEach(r => doc.text(r.join(' | ')));
//     doc.moveDown();
//   };

//   // ===== Header / Title =====
//   doc.fontSize(18).text('Agile Farm agreement', { align: 'center' }).moveDown(0.5);

//   doc.font('Helvetica-Bold').fontSize(11).text('Agreement holder:', { continued: true })
//     .font('Helvetica').text(` ${agreement.company ?? agreement.username ?? ''}`);
//   doc.font('Helvetica-Bold').text('SBI:', { continued: true })
//     .font('Helvetica').text(` ${agreement.sbi ?? ''}`);
//   doc.font('Helvetica-Bold').text('Address:', { continued: true })
//     .font('Helvetica').text(` ${agreement.address ?? ''}`);
//   doc.moveDown();

//   doc.font('Helvetica-Bold').fontSize(13).text('1. Introduction and overview');
//   doc.moveDown(0.25);
//   doc.font('Helvetica').fontSize(10)
//     .text('This Agreement Document describes your selected actions and associated payments.');
//   doc.moveDown();

//   // ===== Summary of actions (your posted shape) =====
//   const soa = agreement.summaryOfActions;
//   const hasSOA = soa && Array.isArray(soa.headings) && Array.isArray(soa.data) && soa.data.length > 0;
//   if (hasSOA) {
//     const headers = soa.headings.map(h => `${h?.text ?? ''}`);
//     const rows = soa.data.map(r => r.map(c => `${c?.text ?? ''}`));

//     await renderTable(
//       { title: '4. Summary of actions', headers, rows },
//       {
//         width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
//         prepareHeader: () => doc.font('Helvetica-Bold').fontSize(9),
//         prepareRow: (_row, i) => {
//           doc.font('Helvetica').fontSize(9);
//           if (i % 2) {
//             const { x, y } = doc;
//             doc.rect(
//               x, y - 2,
//               doc.page.width - doc.page.margins.left - doc.page.margins.right,
//               16
//             ).fillOpacity(0.06).fill('#000').fillOpacity(1).fillColor('#000');
//           }
//         }
//       }
//     );
//     doc.moveDown();
//   } else {
//     doc.font('Helvetica-Oblique').fontSize(9).fillColor('#666')
//        .text('No actions to display').fillColor('#000');
//   }

//   // ===== Finish =====
//   doc.end();
//   await finished;
//   console.log('table method?', typeof doc.table);        // 'function' if patched
//   console.log('PDFTable export?', typeof PDFTable);      // 'function' if function-style
//   return Buffer.concat(chunks);
// };
