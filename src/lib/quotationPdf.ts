import jsPDF from 'jspdf';
import { urlToBase64, fitLogoBox } from '../utils/pdfHelpers';
import { withTitle } from './textCase';
import { calcDiscount } from './totals';
import type { QuotationPartRow, QuotationLaborRow } from './quotations';

/**
 * Quotation PDF. Deliberately laid out like the invoice PDF (Invoices.tsx,
 * buildInvoicePdf) so a customer sees the same document family: logo and shop
 * top-left, document label top-right, vehicle band, labour then parts, totals.
 * Differences: no payment / bank block (nothing is owed yet), a "valid until"
 * line, and the quote's notes above the terms.
 */

export interface QuotationPdfTenant {
    name?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    logo_url?: string | null;
    terms_and_conditions?: string | null;
}

export interface QuotationPdfData {
    quoteNumber: string;
    date: string;
    validUntil?: string | null;
    description?: string | null;
    notes?: string | null;
    customerDetails?: { title?: string | null; name?: string | null; phone?: string | null; address?: string | null } | null;
    vehicleDetails?: { year?: string | null; make?: string | null; model?: string | null; license_plate?: string | null; color?: string | null; vin?: string | null } | null;
    parts: QuotationPartRow[];
    labor: QuotationLaborRow[];
    subtotal: number;
    discount: number;
    linesDiscount: number;
    jobDiscount: number;
    discountType?: string | null;
    discountValue?: number | string | null;
    total: number;
    rawDate?: Date;
}

export async function buildQuotationPdf(
    quote: QuotationPdfData,
    tenant: QuotationPdfTenant | null | undefined,
): Promise<{ doc: jsPDF; filename: string }> {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginLeft = 15;
    const marginRight = 15;

    // 1. Logo
    const headerY = 15;
    let leftColumnY = headerY;
    if (tenant?.logo_url) {
        try {
            const base64Img = await urlToBase64(tenant.logo_url);
            const imgProps = doc.getImageProperties(base64Img);
            const { width, height } = fitLogoBox(imgProps.width, imgProps.height, 35, 28);
            doc.addImage(base64Img, 'PNG', marginLeft, headerY, width, height);
            leftColumnY = headerY + height + 8;
        } catch (e) {
            console.warn('Logo error', e);
            leftColumnY = headerY + 10;
        }
    }

    // 2. Label & meta
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(0);
    doc.text('QUOTATION', pageWidth - marginRight, 25, { align: 'right' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    doc.text(`#${quote.quoteNumber}`, pageWidth - marginRight, 32, { align: 'right' });
    doc.text(`Date: ${quote.date}`, pageWidth - marginRight, 37, { align: 'right' });
    if (quote.validUntil) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text(`Valid until: ${quote.validUntil}`, pageWidth - marginRight, 42, { align: 'right' });
        doc.setFont('helvetica', 'normal');
    }
    doc.setTextColor(0);

    // 3. Shop
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(tenant?.name || 'Service Center', marginLeft, leftColumnY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60);
    leftColumnY += 6;
    if (tenant?.address) {
        const split = doc.splitTextToSize(tenant.address, 80);
        doc.text(split, marginLeft, leftColumnY);
        leftColumnY += split.length * 5;
    }
    if (tenant?.phone) { doc.text(tenant.phone, marginLeft, leftColumnY); leftColumnY += 5; }
    if (tenant?.email) { doc.text(tenant.email, marginLeft, leftColumnY); leftColumnY += 5; }

    // 4. Customer
    let customerY = 49;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Prepared For:', pageWidth - marginRight, customerY, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60);
    customerY += 5;
    const c = quote.customerDetails;
    doc.text(withTitle(c?.title, c?.name) || 'Customer', pageWidth - marginRight, customerY, { align: 'right' });
    customerY += 4.5;
    if (c?.address) {
        doc.splitTextToSize(c.address, 80).forEach((line: string) => {
            doc.text(line, pageWidth - marginRight, customerY, { align: 'right' });
            customerY += 4.5;
        });
    }
    if (c?.phone) {
        doc.text(c.phone, pageWidth - marginRight, customerY, { align: 'right' });
        customerY += 4.5;
    }

    // 5. Vehicle band
    let yPos = Math.max(leftColumnY, customerY) + 6;
    const veh = quote.vehicleDetails;
    if (veh) {
        doc.setFillColor(245, 247, 250);
        doc.rect(marginLeft, yPos, pageWidth - marginLeft * 2, 16, 'F');
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text('VEHICLE', marginLeft + 5, yPos + 5.5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(60);
        doc.text(
            `${[veh.year, veh.make, veh.model].filter(Boolean).join(' ')} — ${veh.license_plate || 'No plate'}`,
            marginLeft + 40, yPos + 5.5,
        );
        const extra = [veh.color && `Colour: ${veh.color}`, veh.vin && `VIN: ${veh.vin}`].filter(Boolean).join('    ');
        if (extra) doc.text(extra, marginLeft + 40, yPos + 11.5);
        doc.setTextColor(0);
        yPos += 20;
    }

    if (quote.description) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        const split = doc.splitTextToSize(quote.description, pageWidth - marginLeft * 2 - 10);
        doc.text(split, marginLeft + 5, yPos + 2);
        yPos += split.length * 5 + 4;
    }

    // 6. Items
    const colTotal = pageWidth - marginRight - 5;
    const colQty = colTotal - 26;
    const colUnit = colQty - 26;
    const descWidth = colUnit - (marginLeft + 5) - 4;
    const bottomLimit = pageHeight - 20;
    let repeatHeader: (() => void) | null = null;

    const ensureSpace = (needed: number) => {
        if (yPos + needed <= bottomLimit) return;
        doc.addPage();
        yPos = 20;
        if (repeatHeader) repeatHeader();
    };

    const drawSectionHeader = (label: string, unitLabel?: string, qtyLabel?: string) => {
        doc.setFillColor(245, 247, 250);
        doc.rect(marginLeft, yPos, pageWidth - marginLeft * 2, 8, 'F');
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text(label.toUpperCase(), marginLeft + 5, yPos + 5.5);
        if (unitLabel) doc.text(unitLabel, colUnit, yPos + 5.5, { align: 'right' });
        if (qtyLabel) doc.text(qtyLabel, colQty, yPos + 5.5, { align: 'right' });
        doc.text('TOTAL', colTotal, yPos + 5.5, { align: 'right' });
        yPos += 11.5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(50);
    };

    const sectionHeader = (label: string, unitLabel?: string, qtyLabel?: string) => {
        repeatHeader = null;
        ensureSpace(22);
        repeatHeader = () => drawSectionHeader(`${label} (continued)`, unitLabel, qtyLabel);
        drawSectionHeader(label, unitLabel, qtyLabel);
    };

    const row = (
        desc: string,
        netTotal: number,
        unit?: number,
        qty?: number | string,
        discount?: { off: number; gross: number; type?: string | null; value?: number | string | null },
    ) => {
        const hasLineDiscount = !!discount && discount.off > 0;
        const width = unit === undefined ? colTotal - (marginLeft + 5) - 6 : descWidth;
        const lines = doc.splitTextToSize(desc, width);
        const base = lines.length * 4.6;
        const height = hasLineDiscount ? Math.max(10, base + 5) : Math.max(7.5, base + 2.5);
        ensureSpace(height);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(50);
        doc.text(lines, marginLeft + 5, yPos);
        if (unit !== undefined) doc.text(Number(unit).toLocaleString(), colUnit, yPos, { align: 'right' });
        if (qty !== undefined) doc.text(String(qty), colQty, yPos, { align: 'right' });

        if (hasLineDiscount && discount) {
            const grossStr = discount.gross.toLocaleString();
            doc.setFontSize(8.5);
            doc.setTextColor(130);
            doc.text(grossStr, colTotal, yPos, { align: 'right' });
            const w = doc.getTextWidth(grossStr);
            doc.setDrawColor(130);
            doc.setLineWidth(0.3);
            doc.line(colTotal - w, yPos - 1.1, colTotal, yPos - 1.1);
            const discY = yPos + 4.2;
            const note = discount.type === 'percent'
                ? `${discount.value}% discount applied (-LKR ${discount.off.toLocaleString()})`
                : `Discount applied (-LKR ${discount.off.toLocaleString()})`;
            doc.setFontSize(7.5);
            doc.setTextColor(16, 149, 105);
            doc.text(note, marginLeft + 7, discY);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0);
            doc.text(netTotal.toLocaleString(), colTotal, discY, { align: 'right' });
        } else {
            doc.text(netTotal.toLocaleString(), colTotal, yPos, { align: 'right' });
        }
        yPos += height;
    };

    if (quote.labor.length) {
        const anyHourly = quote.labor.some(l => !l.is_fixed);
        sectionHeader('Labour / Description', anyHourly ? 'RATE' : undefined, anyHourly ? 'HOURS' : undefined);
        quote.labor.forEach(l => {
            const qty = Math.max(1, Number(l.quantity) || 1);
            const gross = qty * (Number(l.hours) || 0) * (Number(l.hourly_rate_lkr) || 0);
            const off = calcDiscount(gross, l.discount_type, l.discount_value);
            const desc = qty > 1 ? `${l.description || 'Service'} (x${qty})` : (l.description || 'Service');
            row(
                desc,
                Math.max(0, gross - off),
                anyHourly && !l.is_fixed ? Number(l.hourly_rate_lkr) || 0 : undefined,
                anyHourly && !l.is_fixed ? Number(l.hours) || 0 : undefined,
                off > 0 ? { off, gross, type: l.discount_type, value: l.discount_value } : undefined,
            );
        });
        yPos += 2;
    }

    if (quote.parts.length) {
        sectionHeader('Materials / Parts', 'PRICE', 'QTY');
        quote.parts.forEach(p => {
            const gross = (Number(p.quantity) || 0) * (Number(p.price_at_time_lkr) || 0);
            const off = calcDiscount(gross, p.discount_type, p.discount_value);
            row(
                p.custom_name || p.parts?.name || 'Part',
                Math.max(0, gross - off),
                Number(p.price_at_time_lkr) || 0,
                Number(p.quantity) || 0,
                off > 0 ? { off, gross, type: p.discount_type, value: p.discount_value } : undefined,
            );
        });
        yPos += 2;
    }

    if (!quote.labor.length && !quote.parts.length) {
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(120);
        doc.text('No items on this quotation yet.', marginLeft + 5, yPos);
        doc.setFont('helvetica', 'normal');
        yPos += 8;
    }

    // 7. Totals, kept together
    repeatHeader = null;
    const totalDiscount = Number(quote.discount) || 0;
    const hasBoth = quote.linesDiscount > 0 && quote.jobDiscount > 0;
    ensureSpace(totalDiscount > 0 ? (hasBoth ? 36 : 28) : 16);

    doc.setDrawColor(220);
    doc.line(marginLeft, yPos + 2, pageWidth - marginRight, yPos + 2);
    yPos += 8;
    const jobLabel = quote.discountType === 'percent' ? `Discount (${Number(quote.discountValue) || 0}%)` : 'Discount';
    if (totalDiscount > 0) {
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80);
        doc.text('Subtotal (Normal Price)', pageWidth - marginRight - 65, yPos);
        doc.text(quote.subtotal.toLocaleString(), pageWidth - marginRight, yPos, { align: 'right' });
        yPos += 5.5;
        doc.setTextColor(16, 149, 105);
        if (hasBoth) {
            doc.text('Line Discounts', pageWidth - marginRight - 65, yPos);
            doc.text(`- ${quote.linesDiscount.toLocaleString()}`, pageWidth - marginRight, yPos, { align: 'right' });
            yPos += 5.5;
            doc.text(jobLabel, pageWidth - marginRight - 65, yPos);
            doc.text(`- ${quote.jobDiscount.toLocaleString()}`, pageWidth - marginRight, yPos, { align: 'right' });
        } else {
            doc.text(quote.jobDiscount > 0 ? jobLabel : 'Discount (You Save)', pageWidth - marginRight - 65, yPos);
            doc.text(`- ${totalDiscount.toLocaleString()}`, pageWidth - marginRight, yPos, { align: 'right' });
        }
        yPos += 6;
    }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('ESTIMATED TOTAL', pageWidth - marginRight - 65, yPos);
    doc.setTextColor(6, 182, 212);
    doc.text(`LKR ${quote.total.toLocaleString()}`, pageWidth - marginRight, yPos, { align: 'right' });
    if (totalDiscount > 0) {
        yPos += 5;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(16, 149, 105);
        doc.text(`Total savings on this quotation: LKR ${totalDiscount.toLocaleString()}`, pageWidth - marginRight, yPos, { align: 'right' });
    }

    // 8. Notes
    if (quote.notes?.trim()) {
        const split = doc.splitTextToSize(quote.notes.trim(), pageWidth - marginLeft - marginRight);
        yPos += 10;
        ensureSpace(8 + split.length * 4.2);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text('Notes:', marginLeft, yPos);
        yPos += 4.5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(60);
        doc.text(split, marginLeft, yPos);
        yPos += split.length * 4.2;
    }

    // 9. Quotation terms, then the workshop's own terms
    const quoteTerms = [
        quote.validUntil ? `This quotation is valid until ${quote.validUntil}.` : 'This quotation is an estimate.',
        'Prices are estimates based on the inspection so far; any additional work found will be quoted before it is done.',
    ].join(' ');
    const rawTerms = [quoteTerms, tenant?.terms_and_conditions?.trim()].filter(Boolean).join('\n');
    const splitTerms = doc.splitTextToSize(rawTerms, pageWidth - marginLeft - marginRight);
    yPos += 8;
    ensureSpace(10 + splitTerms.length * 3.5);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Terms & Conditions:', marginLeft, yPos);
    yPos += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(80);
    doc.text(splitTerms, marginLeft, yPos);

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page++) {
        doc.setPage(page);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.setFont('helvetica', 'italic');
        if (page === pageCount) {
            doc.text('Thank you for considering us!', pageWidth / 2, pageHeight - 15, { align: 'center' });
        }
        if (pageCount > 1) {
            doc.text(`Page ${page} of ${pageCount}`, pageWidth - marginRight, pageHeight - 15, { align: 'right' });
            doc.text(`Quotation #${quote.quoteNumber}`, marginLeft, pageHeight - 15);
        }
    }

    const firstName = (quote.customerDetails?.name || 'Customer').split(' ')[0].replace(/[^a-z0-9]/gi, '_');
    const d = quote.rawDate instanceof Date && !isNaN(quote.rawDate.getTime()) ? quote.rawDate : new Date();
    const ddmm = `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { doc, filename: `Quotation-${quote.quoteNumber}-${firstName}-${ddmm}.pdf` };
}
