import jsPDF from 'jspdf';
import { urlToBase64 } from '../utils/pdfHelpers';
import { withTitle } from './textCase';

export type InspectionStatus = 
    | 'checked'
    | 'adjusted'
    | 'clean'
    | 'replace'
    | 'problem'
    | 'na'
    | 'good'
    | 'advisory'
    | 'urgent';

export interface InspectionTemplateItem {
    category: string;
    item_name: string;
}

export interface JobInspectionRecord {
    id?: string;
    job_id?: string;
    tenant_id?: string;
    category: string;
    item_name: string;
    status: InspectionStatus;
    notes?: string;
    estimated_cost_lkr?: number;
}

/**
 * Official Periodic Maintenance Check Sheet Categories & Items
 * Directly matching the workshop inspection standard.
 */
export const INSPECTION_CATEGORIES: { name: string; items: string[] }[] = [
    {
        name: '1. [Engine On]',
        items: [
            'Lights and indicators',
            'Horn',
            'Windshield washers / wipers',
            'Steering free play operation',
            'Brake / Clutch pedal operation',
            'Parking brake level',
            'Side mirror operation',
            'Power windows operation',
            'Seat belt operation',
            'A/T Fluid',
            'Power steering fluid',
            'Engine noise',
        ],
    },
    {
        name: '2. [Engine Off]',
        items: [
            'Engine oil level check',
            'Brake fluid',
            'Clutch fluid',
            'Windscreen washer fluid',
            'Engine coolant',
            'Inverter coolant',
            'Drive belts',
            'Battery water & report',
            'AC filter',
            'Air filter',
            'HV battery air filter',
        ],
    },
    {
        name: '3. Wheel / Suspension',
        items: [
            'Wheel bearings',
            'Steering knuckle & linkage',
            'Front brakes',
            'Rear brakes',
            'Tyre condition',
        ],
    },
    {
        name: '4. Underbody / Chassis',
        items: [
            'Oil drain',
            'Engine oil filter',
            'CVT/WS MT Oil',
            'Transfer case oil',
            'Differential oil',
            'Grease points',
            'Exhaust hangers',
            'Drive shaft / rack boots',
            'Link/bushes stabilizer',
            'Ball joints',
            'Bushes & mounts',
            'Shock absorbers',
        ],
    },
    {
        name: '5. Final Checks (Engine On)',
        items: [
            'Fill engine oil/check level',
            'Wheel rotation',
        ],
    },
    {
        name: '6. Fluid Leakage',
        items: [
            'Oil/fluid leakage',
            'Installed condition of replacement parts',
        ],
    },
    {
        name: '7. Final Operations',
        items: [
            'Torque wheel nuts',
            'Tyre pressure + spare wheel',
            'Car care / check condition',
        ],
    },
];

export const STATUS_META: Record<InspectionStatus, {
    code: string;
    label: string;
    shortLabel: string;
    badgeClass: string;
    activeButtonClass: string;
    textColor: string;
    pdfBgColor: [number, number, number];
    pdfBorderColor: [number, number, number];
    pdfTextColor: [number, number, number];
}> = {
    checked: {
        code: 'OK',
        label: 'Checked',
        shortLabel: 'Checked',
        badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        activeButtonClass: 'bg-emerald-500 text-slate-950 shadow-sm font-black',
        textColor: '#10b981',
        pdfBgColor: [236, 253, 245],
        pdfBorderColor: [52, 211, 153],
        pdfTextColor: [5, 150, 105],
    },
    good: {
        code: 'OK',
        label: 'Checked',
        shortLabel: 'Checked',
        badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        activeButtonClass: 'bg-emerald-500 text-slate-950 shadow-sm font-black',
        textColor: '#10b981',
        pdfBgColor: [236, 253, 245],
        pdfBorderColor: [52, 211, 153],
        pdfTextColor: [5, 150, 105],
    },
    adjusted: {
        code: 'A',
        label: 'Adjusted',
        shortLabel: 'Adjusted',
        badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
        activeButtonClass: 'bg-blue-500 text-slate-950 shadow-sm font-black',
        textColor: '#3b82f6',
        pdfBgColor: [239, 246, 255],
        pdfBorderColor: [96, 165, 250],
        pdfTextColor: [37, 99, 235],
    },
    clean: {
        code: 'C',
        label: 'Clean',
        shortLabel: 'Clean',
        badgeClass: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
        activeButtonClass: 'bg-teal-500 text-slate-950 shadow-sm font-black',
        textColor: '#14b8a6',
        pdfBgColor: [240, 253, 250],
        pdfBorderColor: [45, 212, 191],
        pdfTextColor: [13, 148, 136],
    },
    replace: {
        code: 'R',
        label: 'Replace',
        shortLabel: 'Replace',
        badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        activeButtonClass: 'bg-amber-500 text-slate-950 shadow-sm font-black',
        textColor: '#f59e0b',
        pdfBgColor: [254, 243, 199],
        pdfBorderColor: [245, 158, 11],
        pdfTextColor: [180, 83, 9],
    },
    advisory: {
        code: 'R',
        label: 'Replace',
        shortLabel: 'Replace',
        badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        activeButtonClass: 'bg-amber-500 text-slate-950 shadow-sm font-black',
        textColor: '#f59e0b',
        pdfBgColor: [254, 243, 199],
        pdfBorderColor: [245, 158, 11],
        pdfTextColor: [180, 83, 9],
    },
    problem: {
        code: 'X',
        label: 'Problem',
        shortLabel: 'Problem',
        badgeClass: 'bg-red-500/15 text-red-400 border-red-500/30',
        activeButtonClass: 'bg-red-500 text-white shadow-sm font-black',
        textColor: '#ef4444',
        pdfBgColor: [254, 226, 226],
        pdfBorderColor: [239, 68, 68],
        pdfTextColor: [220, 38, 38],
    },
    urgent: {
        code: 'X',
        label: 'Problem',
        shortLabel: 'Problem',
        badgeClass: 'bg-red-500/15 text-red-400 border-red-500/30',
        activeButtonClass: 'bg-red-500 text-white shadow-sm font-black',
        textColor: '#ef4444',
        pdfBgColor: [254, 226, 226],
        pdfBorderColor: [239, 68, 68],
        pdfTextColor: [220, 38, 38],
    },
    na: {
        code: 'NA',
        label: 'N/A',
        shortLabel: 'N/A',
        badgeClass: 'bg-slate-700/40 text-slate-400 border-slate-700',
        activeButtonClass: 'bg-slate-700 text-white shadow-sm font-bold',
        textColor: '#94a3b8',
        pdfBgColor: [241, 245, 249],
        pdfBorderColor: [148, 163, 184],
        pdfTextColor: [100, 116, 139],
    },
};

/** Summary metrics for an inspection run */
export function getInspectionCounts(items: JobInspectionRecord[]) {
    let checked = 0;
    let adjusted = 0;
    let clean = 0;
    let replace = 0;
    let problem = 0;
    let na = 0;

    items.forEach(item => {
        const s = item.status;
        if (s === 'checked' || s === 'good') checked++;
        else if (s === 'adjusted') adjusted++;
        else if (s === 'clean') clean++;
        else if (s === 'replace' || s === 'advisory') replace++;
        else if (s === 'problem' || s === 'urgent') problem++;
        else if (s === 'na') na++;
        else checked++;
    });

    const attentionItems = items.filter(i => 
        i.status === 'problem' || 
        i.status === 'urgent' || 
        i.status === 'replace' || 
        i.status === 'advisory' || 
        i.status === 'adjusted' ||
        Boolean(i.notes?.trim())
    );

    return {
        total: items.length,
        checked,
        good: checked, // backward compatibility
        adjusted,
        clean,
        replace,
        advisory: replace, // backward compatibility
        problem,
        urgent: problem, // backward compatibility
        na,
        futureWorkItems: attentionItems,
    };
}

/**
 * Draws a sharp, native vector checkmark in jsPDF (avoids font encoding bugs with Unicode ✓)
 */
function drawVectorCheckmark(doc: jsPDF, x: number, y: number, color = [5, 150, 105]) {
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(0.65);
    // Left tick
    doc.line(x - 1.4, y + 0.1, x - 0.2, y + 1.4);
    // Right upward tick
    doc.line(x - 0.2, y + 1.4, x + 1.8, y - 1.6);
}

/** Generates the official Periodic Maintenance Check Sheet Report PDF */
export async function buildVehicleHealthPdf(opts: {
    job: any;
    inspections: JobInspectionRecord[];
    tenant: any;
    nextServiceMileage?: number | null;
    nextServiceDate?: string | null;
    generalNotes?: string | null;
}): Promise<{ doc: jsPDF; filename: string }> {
    const { job, inspections, tenant, nextServiceMileage, nextServiceDate, generalNotes } = opts;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginLeft = 14;
    const marginRight = 14;
    const printableWidth = pageWidth - marginLeft - marginRight; // 182 mm
    const bottomLimit = pageHeight - 18;

    let yPos = 14;

    const ensureSpace = (needed: number) => {
        if (yPos + needed <= bottomLimit) return;
        doc.addPage();
        yPos = 16;
    };

    // 1. Logo (Top Left)
    let leftHeaderY = yPos;
    if (tenant?.logo_url) {
        try {
            const base64Img = await urlToBase64(tenant.logo_url);
            const imgProps = doc.getImageProperties(base64Img);
            const ratio = imgProps.height / imgProps.width;
            const width = 28;
            const height = width * ratio;
            doc.addImage(base64Img, 'PNG', marginLeft, leftHeaderY, width, height);
            leftHeaderY += height + 3;
        } catch {
            leftHeaderY += 4;
        }
    }

    // 2. Document Title & Header Meta (Right aligned)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42);
    doc.text('PERIODIC MAINTENANCE CHECK SHEET', pageWidth - marginRight, 18, { align: 'right' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Job Card #: ${(job.id || '').slice(0, 8).toUpperCase()}`, pageWidth - marginRight, 23.5, { align: 'right' });
    doc.text(`Date: ${new Date(job.created_at || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, pageWidth - marginRight, 28, { align: 'right' });

    // Shop info below logo
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    const shopName = tenant?.name || 'Automotive Service Center';
    const splitShopName = doc.splitTextToSize(shopName, 90);
    doc.text(splitShopName, marginLeft, leftHeaderY);
    leftHeaderY += (splitShopName.length * 4.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    if (tenant?.address) {
        const splitAddr = doc.splitTextToSize(tenant.address, 90);
        doc.text(splitAddr, marginLeft, leftHeaderY);
        leftHeaderY += (splitAddr.length * 3.4);
    }
    if (tenant?.phone) {
        doc.text(`Tel: ${tenant.phone}`, marginLeft, leftHeaderY);
        leftHeaderY += 3.5;
    }

    yPos = Math.max(leftHeaderY + 2, 34);

    // 3. CODES GUIDE BANNER
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(marginLeft, yPos, printableWidth, 6.5, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(51, 65, 85);
    doc.text(
        'CODES:    A: Adjusted   |   OK: Checked   |   X: Problem   |   NA: Not Applicable   |   C: Clean   |   R: Replace',
        pageWidth / 2,
        yPos + 4.3,
        { align: 'center' }
    );
    yPos += 9.5;

    // 4. Customer & Vehicle Box (with strict padding & no overflow)
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(marginLeft, yPos, printableWidth, 19, 1.2, 1.2, 'FD');

    const customerName = withTitle(job.vehicles?.customers?.title, job.vehicles?.customers?.name) || 'Walk-in Customer';
    const plate = (job.vehicles?.license_plate || 'No Plate').toUpperCase();
    const vehicleDesc = [job.vehicles?.year, job.vehicles?.make, job.vehicles?.model].filter(Boolean).join(' ') || 'Vehicle';
    const currentMileage = job.mileage ? `${Number(job.mileage).toLocaleString()} km` : 'N/A';

    // Headers
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('CUSTOMER', marginLeft + 4, yPos + 4.8);
    doc.text('VEHICLE', marginLeft + 65, yPos + 4.8);
    doc.text('CURRENT MILEAGE', marginLeft + 138, yPos + 4.8);

    // Values (safely truncated / wrapped)
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);

    const splitCust = doc.splitTextToSize(customerName, 58);
    doc.text(splitCust[0], marginLeft + 4, yPos + 9.8);

    const splitVeh = doc.splitTextToSize(`${vehicleDesc} (${plate})`, 68);
    doc.text(splitVeh[0], marginLeft + 65, yPos + 9.8);

    doc.text(currentMileage, marginLeft + 138, yPos + 9.8);

    // Sub-values
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    if (job.vehicles?.customers?.phone) {
        doc.text(`Phone: ${job.vehicles.customers.phone}`, marginLeft + 4, yPos + 14.8);
    }
    if (splitVeh.length > 1) {
        doc.text(splitVeh[1], marginLeft + 65, yPos + 14.8);
    } else if (job.vehicles?.vin) {
        doc.text(`VIN: ${job.vehicles.vin}`, marginLeft + 65, yPos + 14.8);
    }

    yPos += 22.5;

    // 5. Structured Inspection Summary Scorecard (No text overflow)
    const counts = getInspectionCounts(inspections);
    doc.setFillColor(240, 253, 250);
    doc.setDrawColor(45, 212, 191);
    doc.roundedRect(marginLeft, yPos, printableWidth, 11, 1.2, 1.2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(13, 148, 136);
    doc.text(`INSPECTION SUMMARY (${counts.total} ITEMS INSPECTED):`, marginLeft + 4, yPos + 4.2);

    // Summary Metric Badges (horizontal layout)
    doc.setFontSize(7.2);
    doc.setFont('helvetica', 'bold');
    const badgeGap = 29;
    let bX = marginLeft + 4;

    // Checked
    doc.setTextColor(5, 150, 105);
    doc.text(`[OK] ${counts.checked} Checked`, bX, yPos + 8.5);
    bX += badgeGap;

    // Adjusted
    doc.setTextColor(37, 99, 235);
    doc.text(`[A] ${counts.adjusted} Adjusted`, bX, yPos + 8.5);
    bX += badgeGap;

    // Clean
    doc.setTextColor(13, 148, 136);
    doc.text(`[C] ${counts.clean} Clean`, bX, yPos + 8.5);
    bX += badgeGap;

    // Replace
    doc.setTextColor(180, 83, 9);
    doc.text(`[R] ${counts.replace} Replace`, bX, yPos + 8.5);
    bX += badgeGap;

    // Problem
    doc.setTextColor(220, 38, 38);
    doc.text(`[X] ${counts.problem} Problem`, bX, yPos + 8.5);
    bX += badgeGap;

    // NA
    doc.setTextColor(100, 116, 139);
    doc.text(`[NA] ${counts.na} N/A`, bX, yPos + 8.5);

    yPos += 14.5;

    // 6. Next Service Recommendation Box (if set)
    if (nextServiceMileage || nextServiceDate) {
        doc.setFillColor(254, 243, 199);
        doc.setDrawColor(245, 158, 11);
        doc.roundedRect(marginLeft, yPos, printableWidth, 9.5, 1, 1, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(180, 83, 9);
        doc.text('NEXT SERVICE RECOMMENDATION:', marginLeft + 4, yPos + 4.2);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(120, 53, 15);
        const nextParts = [];
        if (nextServiceMileage) nextParts.push(`Target Mileage: ${Number(nextServiceMileage).toLocaleString()} km`);
        if (nextServiceDate) nextParts.push(`Target Date: ${new Date(nextServiceDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`);
        doc.text(nextParts.join('     |     '), marginLeft + 58, yPos + 4.2);

        yPos += 13;
    }

    // 7. Check Sheet Items Table Columns Definition
    // Total printable width: 182 mm
    const colItemX = marginLeft + 3;      // 17 mm
    const colItemWidth = 84;              // 84 mm
    const colCodeBoxX = marginLeft + 90;  // 104 mm
    const colCodeBoxW = 13;               // 13 mm
    const colResultX = marginLeft + 106;  // 120 mm
    const colNotesX = marginLeft + 132;   // 146 mm
    const colNotesWidth = 46;             // 46 mm

    const categories = Array.from(new Set(inspections.map(i => i.category)));

    categories.forEach(cat => {
        const catItems = inspections.filter(i => i.category === cat);
        if (catItems.length === 0) return;

        // Ensure category header + at least 2 items fit
        ensureSpace(16);

        // Category Header Strip
        doc.setFillColor(241, 245, 249);
        doc.rect(marginLeft, yPos, printableWidth, 5.5, 'F');
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.line(marginLeft, yPos, marginLeft + printableWidth, yPos);
        doc.line(marginLeft, yPos + 5.5, marginLeft + printableWidth, yPos + 5.5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.8);
        doc.setTextColor(30, 41, 59);
        doc.text(cat.toUpperCase(), colItemX, yPos + 3.8);

        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text('CODE', colCodeBoxX + (colCodeBoxW / 2), yPos + 3.8, { align: 'center' });
        doc.text('RESULT', colResultX, yPos + 3.8);
        doc.text('OBSERVATION / ACTION / EST. COST', colNotesX, yPos + 3.8);

        yPos += 7.2;

        catItems.forEach((item, itemIdx) => {
            const meta = STATUS_META[item.status] || STATUS_META.checked;

            // Safe text wrapping to prevent any overlapping
            const itemLines: string[] = doc.splitTextToSize(item.item_name, colItemWidth);
            const rawNote = item.notes?.trim() || '';
            const noteLines: string[] = rawNote ? doc.splitTextToSize(rawNote, colNotesWidth) : [];
            const hasCost = Number(item.estimated_cost_lkr) > 0;
            const totalNoteLines = noteLines.length + (hasCost ? 1 : 0);

            const maxLines = Math.max(itemLines.length, totalNoteLines, 1);
            const rowHeight = Math.max(5.8, (maxLines * 3.4) + 2);

            ensureSpace(rowHeight + 1.5);

            // Alternating very subtle zebra row for readability
            if (itemIdx % 2 === 1) {
                doc.setFillColor(248, 250, 252);
                doc.rect(marginLeft, yPos - 1.2, printableWidth, rowHeight, 'F');
            }

            // 1. Maintenance Item Name
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(30, 41, 59);
            itemLines.forEach((line, lIdx) => {
                doc.text(line, colItemX, yPos + 2.2 + (lIdx * 3.4));
            });

            // 2. Status Code Badge (Centered pill box)
            const pillY = yPos - 0.2;
            const pillH = 4.2;
            doc.setFillColor(meta.pdfBgColor[0], meta.pdfBgColor[1], meta.pdfBgColor[2]);
            doc.setDrawColor(meta.pdfBorderColor[0], meta.pdfBorderColor[1], meta.pdfBorderColor[2]);
            doc.setLineWidth(0.2);
            doc.roundedRect(colCodeBoxX, pillY, colCodeBoxW, pillH, 0.8, 0.8, 'FD');

            if (item.status === 'checked' || item.status === 'good') {
                // Sharp vector checkmark
                drawVectorCheckmark(doc, colCodeBoxX + (colCodeBoxW / 2), pillY + (pillH / 2) + 0.2, meta.pdfTextColor);
            } else {
                // Bold ASCII code
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7.5);
                doc.setTextColor(meta.pdfTextColor[0], meta.pdfTextColor[1], meta.pdfTextColor[2]);
                doc.text(meta.code, colCodeBoxX + (colCodeBoxW / 2), pillY + 3.1, { align: 'center' });
            }

            // 3. Status Result Label
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.2);
            doc.setTextColor(meta.pdfTextColor[0], meta.pdfTextColor[1], meta.pdfTextColor[2]);
            doc.text(meta.shortLabel.toUpperCase(), colResultX, yPos + 2.5);

            // 4. Observation Notes / Estimated Cost
            if (rawNote || hasCost) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(6.8);
                doc.setTextColor(71, 85, 105);
                noteLines.forEach((nLine, nIdx) => {
                    doc.text(nLine, colNotesX, yPos + 2.2 + (nIdx * 3.2));
                });
                if (hasCost) {
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(180, 83, 9);
                    doc.text(`Est: LKR ${Number(item.estimated_cost_lkr).toLocaleString()}`, colNotesX, yPos + 2.2 + (noteLines.length * 3.2));
                }
            } else {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(6.5);
                doc.setTextColor(148, 163, 184);
                doc.text('—', colNotesX, yPos + 2.5);
            }

            // Bottom border line for each row
            doc.setDrawColor(241, 245, 249);
            doc.setLineWidth(0.15);
            doc.line(marginLeft, yPos + rowHeight - 1.2, marginLeft + printableWidth, yPos + rowHeight - 1.2);

            yPos += rowHeight;
        });

        yPos += 2.5;
    });

    // 8. Special Comments / Notes Section (Dynamically sized, no overflow)
    const rawGenNotes = generalNotes?.trim() || '';
    const splitGenNotes: string[] = rawGenNotes ? doc.splitTextToSize(rawGenNotes, printableWidth - 8) : [];
    const notesBoxHeight = Math.max(13, (splitGenNotes.length * 3.4) + 6);

    ensureSpace(notesBoxHeight + 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text('SPECIAL COMMENTS / NOTES:', marginLeft, yPos + 1);
    yPos += 3.5;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.roundedRect(marginLeft, yPos, printableWidth, notesBoxHeight, 1.2, 1.2, 'FD');

    if (rawGenNotes) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.2);
        doc.setTextColor(51, 65, 85);
        splitGenNotes.forEach((line, idx) => {
            doc.text(line, marginLeft + 4, yPos + 4.2 + (idx * 3.4));
        });
    } else {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text('No special notes recorded.', marginLeft + 4, yPos + 6);
    }

    yPos += notesBoxHeight + 6;

    // 9. Signatures Block (Guaranteed to fit on the page, never cut off)
    ensureSpace(22);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginLeft, yPos, printableWidth, 18, 1.2, 1.2, 'D');

    const colWidth = printableWidth / 4; // 45.5 mm

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text('VEHICLE NO:', marginLeft + 4, yPos + 4.5);
    doc.text('TECHNICIAN SIGNATURE:', marginLeft + colWidth + 4, yPos + 4.5);
    doc.text('CUSTOMER SIGNATURE:', marginLeft + (colWidth * 2) + 4, yPos + 4.5);
    doc.text('SUPERVISOR SIGNATURE:', marginLeft + (colWidth * 3) + 4, yPos + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(plate, marginLeft + 4, yPos + 12);

    // Signature Underlines
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.3);
    doc.line(marginLeft + colWidth + 4, yPos + 14, marginLeft + (colWidth * 2) - 4, yPos + 14);
    doc.line(marginLeft + (colWidth * 2) + 4, yPos + 14, marginLeft + (colWidth * 3) - 4, yPos + 14);
    doc.line(marginLeft + (colWidth * 3) + 4, yPos + 14, marginLeft + printableWidth - 4, yPos + 14);

    // 10. Running Footer on All Pages
    const pageCount = doc.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(6.8);
        doc.setTextColor(148, 163, 184);
        doc.text(`${shopName} — Periodic Maintenance Check Sheet`, marginLeft, pageHeight - 6.5);
        doc.text(`Page ${p} of ${pageCount}`, pageWidth - marginRight, pageHeight - 6.5, { align: 'right' });
    }

    const cleanPlate = (plate || 'Vehicle').replace(/[^a-z0-9]/gi, '_');
    return {
        doc,
        filename: `Periodic-Maintenance-Check-Sheet-${cleanPlate}-${(job.id || '').slice(0, 6)}.pdf`,
    };
}
