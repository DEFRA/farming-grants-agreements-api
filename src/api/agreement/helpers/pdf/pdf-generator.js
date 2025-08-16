import PDFDocument from 'pdfkit'
import fs from 'fs'


const generateSamplePDFDoc = (outputFile='sample-agreement.pdf') => {

    const doc = new PDFDocument({ margin: 50 });

    doc.pipe(fs.createWriteStream(outputFile));

    // ===== Title & Header =====
    doc
    .fontSize(18)
    .text('Agile Farm Agreement', { align: 'center' })
    .moveDown();

    doc
    .fontSize(12)
    .text('Agreement Holder: Agile Farm', { continued: true })
    .text('   SBI: 999999999')
    .moveDown()
    .text('Address: 123 Farm Lane, Farmville', { align: 'left' })
    .moveDown();

    // ===== Section 1 =====
    doc.fontSize(14).text('1. Introduction and Overview', { underline: true });
    doc.fontSize(10).text(
    'This Sustainable Farming Incentive (SFI) Agreement Document describes the sum to be paid (the "Grant") for delivering the SFI actions you have chosen...'
    );
    doc.moveDown();

    // ===== Example Table =====
    const { Table } = require('pdfkit-table');

    const actionsTable = {
    title: 'Summary of Actions',
    headers: ['Parcel Code', 'Action', 'Area (ha)', 'Start Date', 'End Date'],
    rows: [
        ['SO3757 3159', 'CMOR1 Assess moorland', '8.3405', '01/11/2024', '31/10/2027'],
        ['SO3757 3159', 'UPL3 Limited grazing', '8.3405', '01/11/2024', '31/10/2027'],
        ['SO3757 3159', 'UPL4 Keep cattle & ponies', '8.3405', '01/11/2024', '31/10/2027'],
    ],
    };

    doc.table(actionsTable, {
    prepareHeader: () => doc.fontSize(9).fillColor('black'),
    prepareRow: (row, i) => doc.fontSize(9).fillColor(i % 2 ? 'black' : 'black'),
    });
    doc.moveDown();

    // ===== Payment Schedule Table =====
    const paymentsTable = {
    title: 'Payment Schedule',
    headers: ['Code', 'Year 1', 'Year 2', 'Year 3', 'Total'],
    rows: [
        ['CMOR1', '£360.41', '£360.41', '£360.41', '£1,081.23'],
        ['UPL3', '£550.47', '£550.47', '£550.47', '£1,651.41'],
        ['UPL4', '£58.39', '£58.39', '£58.39', '£175.17'],
        ['SPM5', '£91.75', '£91.75', '£91.75', '£275.25'],
        ['UPL10', '£400.34', '£400.34', '£400.34', '£1,201.02'],
    ],
    };

    doc.table(paymentsTable, {
    prepareHeader: () => doc.fontSize(9),
    prepareRow: (row, i) => doc.fontSize(9),
    });

    // ===== Footer =====
    doc.moveDown().fontSize(8).text('© Crown copyright', { align: 'center' });

    // Finalize PDF file
    doc.end();

    console.log(`PDF generated: ${outputFile}`);

}

export { generateSamplePDFDoc }
