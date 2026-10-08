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
    pdfColor: [number, number, number];
}> = {
    checked: {
        code: '✓',
        label: 'Checked',
        shortLabel: 'Checked',
        badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        activeButtonClass: 'bg-emerald-500 text-slate-950 shadow-sm font-black',
        textColor: '#10b981',
        pdfColor: [16, 185, 129],
    },
    good: {
        code: '✓',
        label: 'Checked',
        shortLabel: 'Checked',
        badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        activeButtonClass: 'bg-emerald-500 text-slate-950 shadow-sm font-black',
        textColor: '#10b981',
        pdfColor: [16, 185, 129],
    },
    adjusted: {
        code: 'A',
        label: 'Adjusted',
        shortLabel: 'Adjusted',
        badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
        activeButtonClass: 'bg-blue-500 text-slate-950 shadow-sm font-black',
        textColor: '#3b82f6',
        pdfColor: [59, 130, 246],
    },
    clean: {
        code: 'C',
        label: 'Clean',
        shortLabel: 'Clean',
        badgeClass: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
        activeButtonClass: 'bg-teal-500 text-slate-950 shadow-sm font-black',
        textColor: '#14b8a6',
        pdfColor: [20, 184, 166],
    },
    replace: {
        code: 'R',
        label: 'Replace',
        shortLabel: 'Replace',
        badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        activeButtonClass: 'bg-amber-500 text-slate-950 shadow-sm font-black',
        textColor: '#f59e0b',
        pdfColor: [245, 158, 11],
    },
    advisory: {
        code: 'R',
        label: 'Replace',
        shortLabel: 'Replace',
        badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        activeButtonClass: 'bg-amber-500 text-slate-950 shadow-sm font-black',
        textColor: '#f59e0b',
        pdfColor: [245, 158, 11],
    },
    problem: {
        code: 'X',
        label: 'Problem',
        shortLabel: 'Problem',
        badgeClass: 'bg-red-500/15 text-red-400 border-red-500/30',
        activeButtonClass: 'bg-red-500 text-white shadow-sm font-black',
        textColor: '#ef4444',
        pdfColor: [239, 68, 68],
    },
    urgent: {
        code: 'X',
        label: 'Problem',
        shortLabel: 'Problem',
        badgeClass: 'bg-red-500/15 text-red-400 border-red-500/30',
        activeButtonClass: 'bg-red-500 text-white shadow-sm font-black',
        textColor: '#ef4444',
        pdfColor: [239, 68, 68],
    },
    na: {
        code: 'NA',
        label: 'N/A',
        shortLabel: 'N/A',
        badgeClass: 'bg-slate-700/40 text-slate-400 border-slate-700',
        activeButtonClass: 'bg-slate-700 text-white shadow-sm font-bold',
        textColor: '#94a3b8',
        pdfColor: [148, 163, 184],
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
    const bottomLimit = pageHeight - 20;

    let yPos = 14;

    const ensureSpace = (needed: number) => {
        if (yPos + needed <= bottomLimit) return;
        doc.addPage();
        yPos = 18;
    };

    // 1. Logo (Top Left)
    if (tenant?.logo_url) {
        try {
            const base64Img = await urlToBase64(tenant.logo_url);
            const imgProps = doc.getImageProperties(base64Img);
            const ratio = imgProps.height / imgProps.width;
            const width = 30;
            const height = width * ratio;
            doc.addImage(base64Img, 'PNG', marginLeft, yPos, width, height);
            yPos += height + 3;
        } catch {
            yPos += 6;
        }
    }

    // 2. Header title (Top Right)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text('PERIODIC MAINTENANCE CHECK SHEET', pageWidth - marginRight, 20, { align: 'right' });

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Job Card #${(job.id || '').slice(0, 8).toUpperCase()}`, pageWidth - marginRight, 26, { align: 'right' });
    doc.text(`Date: ${new Date(job.created_at || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, pageWidth - marginRight, 31, { align: 'right' });

    // Shop info under logo
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(30, 41, 59);
    const shopName = tenant?.name || 'Automotive Service Center';
    doc.text(shopName, marginLeft, yPos);
    yPos += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100);
    if (tenant?.address) {
        doc.text(tenant.address, marginLeft, yPos);
        yPos += 3.5;
    }
    if (tenant?.phone) {
        doc.text(`Tel: ${tenant.phone}`, marginLeft, yPos);
        yPos += 3.5;
    }

    yPos = Math.max(yPos + 3, 38);

    // 3. CODES BANNER (Matches check sheet header)
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.rect(marginLeft, yPos, pageWidth - marginLeft - marginRight, 7, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
        'CODES:   A: Adjusted   |   ✓: Checked   |   X: Problem   |   NA: Not Applicable   |   C: Clean   |   R: Replace',
        pageWidth / 2,
        yPos + 4.8,
        { align: 'center' }
    );
    yPos += 10.5;

    // 4. Customer & Vehicle Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(marginLeft, yPos, pageWidth - marginLeft - marginRight, 20, 'FD');

    const customerName = withTitle(job.vehicles?.customers?.title, job.vehicles?.customers?.name) || 'Walk-in Customer';
    const plate = job.vehicles?.license_plate || 'No Plate';
    const vehicleDesc = [job.vehicles?.year, job.vehicles?.make, job.vehicles?.model].filter(Boolean).join(' ') || 'Vehicle';
    const currentMileage = job.mileage ? `${Number(job.mileage).toLocaleString()} km` : 'N/A';

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100);
    doc.text('CUSTOMER', marginLeft + 5, yPos + 5.5);
    doc.text('VEHICLE', marginLeft + 70, yPos + 5.5);
    doc.text('CURRENT MILEAGE', pageWidth - marginRight - 40, yPos + 5.5);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(customerName, marginLeft + 5, yPos + 11);
    doc.text(`${vehicleDesc} (${plate})`, marginLeft + 70, yPos + 11);
    doc.text(currentMileage, pageWidth - marginRight - 40, yPos + 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100);
    if (job.vehicles?.customers?.phone) {
        doc.text(`Phone: ${job.vehicles.customers.phone}`, marginLeft + 5, yPos + 16);
    }
    yPos += 24;

    // 5. Scorecard Summary Banner
    const counts = getInspectionCounts(inspections);
    doc.setFillColor(240, 253, 250);
    doc.setDrawColor(45, 212, 191);
    doc.rect(marginLeft, yPos, pageWidth - marginLeft - marginRight, 9, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 118, 110);
    const summaryText = `SUMMARY: ${counts.total} items checked  •  ${counts.checked} Checked (✓)  •  ${counts.adjusted} Adjusted (A)  •  ${counts.clean} Clean (C)  •  ${counts.replace} Replace (R)  •  ${counts.problem} Problem (X)`;
    doc.text(summaryText, marginLeft + 5, yPos + 6);

    yPos += 13;

    // 6. Next Service Recommendation Box (if set)
    if (nextServiceMileage || nextServiceDate) {
        doc.setFillColor(254, 243, 199);
        doc.setDrawColor(245, 158, 11);
        doc.rect(marginLeft, yPos, pageWidth - marginLeft - marginRight, 11, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(180, 83, 9);
        doc.text('NEXT ROUTINE SERVICE RECOMMENDATION:', marginLeft + 5, yPos + 4.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(120, 53, 15);
        const nextParts = [];
        if (nextServiceMileage) nextParts.push(`Target Mileage: ${Number(nextServiceMileage).toLocaleString()} km`);
        if (nextServiceDate) nextParts.push(`Estimated Target Date: ${new Date(nextServiceDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`);
        doc.text(nextParts.join('   |   '), marginLeft + 5, yPos + 8.5);

        yPos += 15;
    }

    // 7. Check Sheet Items Table organized by Category
    const categories = Array.from(new Set(inspections.map(i => i.category)));

    categories.forEach(cat => {
        const catItems = inspections.filter(i => i.category === cat);
        if (catItems.length === 0) return;

        ensureSpace(14 + (catItems.length * 6.5));

        // Category Header
        doc.setFillColor(241, 245, 249);
        doc.rect(marginLeft, yPos, pageWidth - marginLeft - marginRight, 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);
        doc.text(cat.toUpperCase(), marginLeft + 4, yPos + 4.2);

        doc.text('CODE', pageWidth - marginRight - 55, yPos + 4.2);
        doc.text('RESULT', pageWidth - marginRight - 35, yPos + 4.2);
        yPos += 7.5;

        catItems.forEach(item => {
            ensureSpace(6.5);

            // Item Name
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.8);
            doc.setTextColor(51, 65, 85);
            doc.text(item.item_name, marginLeft + 4, yPos);

            // Status Code Badge
            const meta = STATUS_META[item.status] || STATUS_META.checked;
            const [r, g, b] = meta.pdfColor;

            // Draw Code
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(r, g, b);
            doc.text(meta.code, pageWidth - marginRight - 50, yPos);

            // Draw Label
            doc.setFontSize(7.5);
            doc.text(meta.shortLabel.toUpperCase(), pageWidth - marginRight - 35, yPos);

            // Notes if any
            if (item.notes?.trim()) {
                yPos += 3.2;
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(7);
                doc.setTextColor(100);
                const splitNote = doc.splitTextToSize(`Note: ${item.notes.trim()}`, pageWidth - marginLeft - marginRight - 12);
                doc.text(splitNote, marginLeft + 8, yPos);
                yPos += (splitNote.length * 3.2);
            } else {
                yPos += 4.5;
            }

            // Divider line
            doc.setDrawColor(241, 245, 249);
            doc.setLineWidth(0.2);
            doc.line(marginLeft + 4, yPos - 1.2, pageWidth - marginRight - 4, yPos - 1.2);
        });

        yPos += 2.5;
    });

    // 8. Special Comments / Notes Section
    ensureSpace(24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text('SPECIAL COMMENTS / NOTES:', marginLeft, yPos);
    yPos += 3.5;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    const notesBoxHeight = generalNotes?.trim() ? 18 : 12;
    doc.rect(marginLeft, yPos, pageWidth - marginLeft - marginRight, notesBoxHeight, 'FD');

    if (generalNotes?.trim()) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        const splitNotes = doc.splitTextToSize(generalNotes.trim(), pageWidth - marginLeft - marginRight - 6);
        doc.text(splitNotes, marginLeft + 3, yPos + 4.5);
    }
    yPos += notesBoxHeight + 8;

    // 9. Signatures Block (Directly matching page 2 of check sheet)
    ensureSpace(22);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.rect(marginLeft, yPos, pageWidth - marginLeft - marginRight, 18, 'D');

    const colWidth = (pageWidth - marginLeft - marginRight) / 4;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.text('VEHICLE NO:', marginLeft + 4, yPos + 5);
    doc.text('TECHNICIAN SIGNATURE:', marginLeft + colWidth + 4, yPos + 5);
    doc.text('CUSTOMER SIGNATURE:', marginLeft + (colWidth * 2) + 4, yPos + 5);
    doc.text('SUPERVISOR SIGNATURE:', marginLeft + (colWidth * 3) + 4, yPos + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(plate, marginLeft + 4, yPos + 12);

    // Signature lines
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.3);
    doc.line(marginLeft + colWidth + 4, yPos + 14, marginLeft + (colWidth * 2) - 4, yPos + 14);
    doc.line(marginLeft + (colWidth * 2) + 4, yPos + 14, marginLeft + (colWidth * 3) - 4, yPos + 14);
    doc.line(marginLeft + (colWidth * 3) + 4, yPos + 14, pageWidth - marginRight - 4, yPos + 14);

    // 10. Footer on all pages
    const pageCount = doc.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`${shopName} — Periodic Maintenance Check Sheet`, marginLeft, pageHeight - 8);
        doc.text(`Page ${p} of ${pageCount}`, pageWidth - marginRight, pageHeight - 8, { align: 'right' });
    }

    const cleanPlate = (plate || 'Vehicle').replace(/[^a-z0-9]/gi, '_');
    return {
        doc,
        filename: `Periodic-Maintenance-Check-Sheet-${cleanPlate}-${(job.id || '').slice(0, 6)}.pdf`,
    };
}
