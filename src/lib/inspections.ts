import jsPDF from 'jspdf';
import { urlToBase64 } from '../utils/pdfHelpers';
import { withTitle } from './textCase';

export type InspectionStatus = 'good' | 'advisory' | 'urgent';

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

export const INSPECTION_CATEGORIES: { name: string; items: string[] }[] = [
    {
        name: 'Fluids & Filters',
        items: [
            'Engine Oil & Oil Filter',
            'Coolant / Radiator Level',
            'Brake Fluid Condition',
            'Transmission / Gearbox Fluid',
            'Engine Air Filter',
            'Cabin A/C Filter',
        ],
    },
    {
        name: 'Brakes & Tires',
        items: [
            'Front Brake Pads & Rotors',
            'Rear Brake Pads / Shoes',
            'Tire Tread Depth & Wear',
            'Tire Pressure & Spare Tire',
            'Handbrake / Parking Brake',
        ],
    },
    {
        name: 'Suspension & Steering',
        items: [
            'Shock Absorbers & Struts',
            'Suspension Bushings & Ball Joints',
            'Steering Rack & Tie Rod Ends',
            'Underbody & Exhaust Integrity',
        ],
    },
    {
        name: 'Underhood & Electrical',
        items: [
            '12V Battery Health & Terminals',
            'Alternator & Charging Voltage',
            'Drive Belts & Tensioner',
            'Coolant Hoses & Clamps',
        ],
    },
    {
        name: 'Safety & Exterior',
        items: [
            'Windshield Wipers & Washer Fluid',
            'Headlights, Taillights & Indicators',
            'Horn & Warning Lights',
            'Air Conditioning Cooling Performance',
        ],
    },
];

export const STATUS_META = {
    good: {
        label: 'Good / Satisfactory',
        shortLabel: 'Good',
        badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        dotClass: 'bg-emerald-400',
        textColor: '#10b981',
    },
    advisory: {
        label: 'Advisory / Future Work',
        shortLabel: 'Advisory',
        badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        dotClass: 'bg-amber-400',
        textColor: '#f59e0b',
    },
    urgent: {
        label: 'Urgent Attention Needed',
        shortLabel: 'Urgent',
        badgeClass: 'bg-red-500/15 text-red-400 border-red-500/30',
        dotClass: 'bg-red-400',
        textColor: '#ef4444',
    },
};

/** Summary metrics for an inspection run */
export function getInspectionCounts(items: JobInspectionRecord[]) {
    let good = 0;
    let advisory = 0;
    let urgent = 0;
    items.forEach(item => {
        if (item.status === 'good') good++;
        else if (item.status === 'advisory') advisory++;
        else if (item.status === 'urgent') urgent++;
    });
    return {
        total: items.length,
        good,
        advisory,
        urgent,
        futureWorkItems: items.filter(i => i.status === 'advisory' || i.status === 'urgent'),
    };
}

/** Generates a dedicated Vehicle Health & Future Maintenance Report PDF */
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
    const marginLeft = 15;
    const marginRight = 15;
    const bottomLimit = pageHeight - 20;

    let yPos = 15;

    const ensureSpace = (needed: number) => {
        if (yPos + needed <= bottomLimit) return;
        doc.addPage();
        yPos = 20;
    };

    // 1. Logo (Top Left)
    if (tenant?.logo_url) {
        try {
            const base64Img = await urlToBase64(tenant.logo_url);
            const imgProps = doc.getImageProperties(base64Img);
            const ratio = imgProps.height / imgProps.width;
            const width = 32;
            const height = width * ratio;
            doc.addImage(base64Img, 'PNG', marginLeft, yPos, width, height);
            yPos += height + 4;
        } catch {
            yPos += 8;
        }
    }

    // 2. Header title (Top Right)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(0);
    doc.text('VEHICLE HEALTH REPORT', pageWidth - marginRight, 22, { align: 'right' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text('Routine Maintenance & Multi-Point Inspection', pageWidth - marginRight, 28, { align: 'right' });
    doc.text(`Job Card #${(job.id || '').slice(0, 8).toUpperCase()}`, pageWidth - marginRight, 33, { align: 'right' });
    doc.text(`Date: ${new Date(job.created_at || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, pageWidth - marginRight, 38, { align: 'right' });

    // Shop info under logo
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20);
    const shopName = tenant?.name || 'Automotive Service Center';
    doc.text(shopName, marginLeft, yPos);
    yPos += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(90);
    if (tenant?.address) {
        doc.text(tenant.address, marginLeft, yPos);
        yPos += 4;
    }
    if (tenant?.phone) {
        doc.text(`Tel: ${tenant.phone}`, marginLeft, yPos);
        yPos += 4;
    }

    yPos = Math.max(yPos + 4, 46);

    // 3. Customer & Vehicle Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(marginLeft, yPos, pageWidth - marginLeft - marginRight, 22, 'FD');

    const customerName = withTitle(job.vehicles?.customers?.title, job.vehicles?.customers?.name) || 'Walk-in Customer';
    const plate = job.vehicles?.license_plate || 'No Plate';
    const vehicleDesc = [job.vehicles?.year, job.vehicles?.make, job.vehicles?.model].filter(Boolean).join(' ') || 'Vehicle';
    const currentMileage = job.mileage ? `${Number(job.mileage).toLocaleString()} km` : 'N/A';

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100);
    doc.text('CUSTOMER', marginLeft + 5, yPos + 6);
    doc.text('VEHICLE', marginLeft + 75, yPos + 6);
    doc.text('CURRENT MILEAGE', pageWidth - marginRight - 40, yPos + 6);

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15);
    doc.text(customerName, marginLeft + 5, yPos + 12);
    doc.text(`${vehicleDesc} (${plate})`, marginLeft + 75, yPos + 12);
    doc.text(currentMileage, pageWidth - marginRight - 40, yPos + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100);
    if (job.vehicles?.customers?.phone) {
        doc.text(`Phone: ${job.vehicles.customers.phone}`, marginLeft + 5, yPos + 17);
    }
    yPos += 28;

    // 4. Scorecard Banner
    const counts = getInspectionCounts(inspections);
    doc.setFillColor(240, 253, 250);
    doc.setDrawColor(45, 212, 191);
    doc.rect(marginLeft, yPos, pageWidth - marginLeft - marginRight, 14, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 118, 110);
    doc.text('INSPECTION SUMMARY', marginLeft + 5, yPos + 6);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    const summaryText = `${counts.total} items checked:   ${counts.good} Good (Pass)   •   ${counts.advisory} Advisories for Future Care   •   ${counts.urgent} Urgent`;
    doc.text(summaryText, marginLeft + 5, yPos + 10.5);

    yPos += 19;

    // 5. Next Service Recommendation Box (if set)
    if (nextServiceMileage || nextServiceDate) {
        doc.setFillColor(254, 243, 199);
        doc.setDrawColor(245, 158, 11);
        doc.rect(marginLeft, yPos, pageWidth - marginLeft - marginRight, 13, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(180, 83, 9);
        doc.text('NEXT ROUTINE SERVICE RECOMMENDATION:', marginLeft + 5, yPos + 5.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(120, 53, 15);
        const nextParts = [];
        if (nextServiceMileage) nextParts.push(`Target Mileage: ${Number(nextServiceMileage).toLocaleString()} km`);
        if (nextServiceDate) nextParts.push(`Estimated Target Date: ${new Date(nextServiceDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`);
        doc.text(nextParts.join('   |   '), marginLeft + 5, yPos + 9.5);

        yPos += 17;
    }

    // 6. Inspection Items Table by Category
    const categories = Array.from(new Set(inspections.map(i => i.category)));

    categories.forEach(cat => {
        const catItems = inspections.filter(i => i.category === cat);
        if (catItems.length === 0) return;

        ensureSpace(14 + (catItems.length * 8));

        // Category Header
        doc.setFillColor(241, 245, 249);
        doc.rect(marginLeft, yPos, pageWidth - marginLeft - marginRight, 6.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);
        doc.text(cat.toUpperCase(), marginLeft + 4, yPos + 4.5);

        doc.text('STATUS / RESULT', pageWidth - marginRight - 50, yPos + 4.5);
        yPos += 8.5;

        catItems.forEach(item => {
            ensureSpace(8);

            // Item Name
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(30, 41, 59);
            doc.text(item.item_name, marginLeft + 4, yPos);

            // Status Badge text
            const meta = STATUS_META[item.status] || STATUS_META.good;
            if (item.status === 'good') {
                doc.setTextColor(16, 185, 129);
            } else if (item.status === 'advisory') {
                doc.setTextColor(217, 119, 6);
            } else {
                doc.setTextColor(220, 38, 38);
            }
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.text(meta.shortLabel.toUpperCase(), pageWidth - marginRight - 50, yPos);

            // Notes if any
            if (item.notes?.trim()) {
                yPos += 3.5;
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(7.5);
                doc.setTextColor(100);
                const splitNote = doc.splitTextToSize(`Advisory Note: ${item.notes.trim()}`, pageWidth - marginLeft - marginRight - 10);
                doc.text(splitNote, marginLeft + 8, yPos);
                yPos += (splitNote.length * 3.5);
            } else {
                yPos += 5.5;
            }

            // Subtle divider line
            doc.setDrawColor(241, 245, 249);
            doc.setLineWidth(0.2);
            doc.line(marginLeft + 4, yPos - 1.5, pageWidth - marginRight - 4, yPos - 1.5);
        });

        yPos += 3;
    });

    // 7. General Inspection Notes if any
    if (generalNotes?.trim()) {
        ensureSpace(18);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);
        doc.text('SERVICE ADVISOR GENERAL NOTES:', marginLeft, yPos);
        yPos += 4.5;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        const splitGen = doc.splitTextToSize(generalNotes.trim(), pageWidth - marginLeft - marginRight);
        doc.text(splitGen, marginLeft, yPos);
        yPos += (splitGen.length * 3.8) + 4;
    }

    // 8. Footer on all pages
    const pageCount = doc.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(`${shopName} — Certified Vehicle Health & Maintenance Check`, marginLeft, pageHeight - 10);
        doc.text(`Page ${p} of ${pageCount}`, pageWidth - marginRight, pageHeight - 10, { align: 'right' });
    }

    const cleanPlate = (plate || 'Vehicle').replace(/[^a-z0-9]/gi, '_');
    return {
        doc,
        filename: `Vehicle-Health-Report-${cleanPlate}-${(job.id || '').slice(0, 6)}.pdf`,
    };
}
