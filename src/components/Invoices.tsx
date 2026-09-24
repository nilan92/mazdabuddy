import { useState, useEffect } from 'react';
import { 
    Printer, 
    Download, 
    FileText, 
    RefreshCcw, 
    Search, 
    CheckCircle, 
    Clock, 
    AlertCircle,
    MessageCircle
} from 'lucide-react';
import jsPDF from 'jspdf';
import { supabase } from '../lib/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { urlToBase64, fitLogoBox } from '../utils/pdfHelpers';
import { shareInvoice, invoiceMessage } from '../lib/whatsapp';
import { withTitle } from '../lib/textCase';
import { calcDiscount, calcInvoiceSummary } from '../lib/totals';
import { downloadCSV } from '../lib/csv';
import { useConfirm } from '../context/ConfirmContext';

type ShareableInvoice = {
    invoiceNumber: string;
    vehicle: string;
    total: number;
    subtotal?: number;
    discount?: number;
    customerDetails?: { phone?: string | null } | null;
};

export const Invoices = () => {
    const queryClient = useQueryClient();
    const { profile } = useAuth();
    const confirm = useConfirm();
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [sharing, setSharing] = useState(false);

    // 1. Fetch Invoices
    const { data: invoices = [], isLoading: loading } = useQuery({
        queryKey: ['invoices'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('invoices')
                .select(`
                    *,
                    job_cards!inner (
                        description,
                        mileage,
                        discount_type,
                        discount_value,
                        vehicles!inner (license_plate, make, model, year, vin, color, customers!inner(title, name, address, phone, email)),
                        job_parts ( quantity, price_at_time_lkr, custom_name, discount_type, discount_value, parts(name) ),
                        job_labor ( description, hours, hourly_rate_lkr, is_fixed, discount_type, discount_value )
                    )
                `)
                .order('created_at', { ascending: false })
                .limit(50);
            
            if (error) throw error;

            return data?.map((inv: any) => {
                const parts = inv.job_cards?.job_parts || [];
                const labor = inv.job_cards?.job_labor || [];
                const summary = calcInvoiceSummary(
                    parts,
                    labor,
                    inv.job_cards ? { type: inv.job_cards.discount_type, value: inv.job_cards.discount_value } : null,
                    Number(inv.tax_lkr) || 0
                );

                const discountLabel = summary.jobDiscountAmount > 0 && summary.linesDiscount === 0
                    ? (inv.job_cards?.discount_type === 'percent' ? `Discount (${Number(inv.job_cards?.discount_value) || 0}%)` : 'Discount')
                    : 'Discount';

                return {
                    id: inv.id,
                    invoiceNumber: `INV-${inv.id.slice(0, 8).toUpperCase()}`,
                    customer: withTitle(inv.job_cards?.vehicles?.customers?.title, inv.job_cards?.vehicles?.customers?.name) || 'Unknown',
                    customerDetails: inv.job_cards?.vehicles?.customers,
                    vehicle: `${inv.job_cards?.vehicles?.make} ${inv.job_cards?.vehicles?.model} (${inv.job_cards?.vehicles?.license_plate})`,
                    vehicleDetails: inv.job_cards?.vehicles,
                    mileage: inv.job_cards?.mileage,
                    total: Number(inv.total_amount_lkr) || summary.totalAmount,
                    subtotal: summary.grossSubtotal || Number(inv.subtotal_lkr) || 0,
                    discount: summary.totalDiscount || Number(inv.discount_lkr) || 0,
                    linesDiscount: summary.linesDiscount,
                    jobDiscount: summary.jobDiscountAmount,
                    jobDiscountType: inv.job_cards?.discount_type,
                    jobDiscountValue: inv.job_cards?.discount_value,
                    discountLabel,
                    status: inv.status || 'Unpaid',
                    date: new Date(inv.created_at).toLocaleDateString('en-GB', { 
                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                    }),
                    rawDate: new Date(inv.created_at),
                    parts,
                    labor,
                };
            }) || [];
        }
    });

    // Deep link from the Finances receivables list: #/invoices?invoice=<id>
    // selects that invoice so its status can be updated straight away. Runs once
    // the list has loaded, then clears the parameter so a later refresh does not
    // yank the user back to the same row.
    useEffect(() => {
        if (invoices.length === 0) return;
        const wanted = new URLSearchParams(window.location.hash.split('?')[1] || '').get('invoice');
        if (!wanted) return;
        const match = invoices.find((i: any) => i.id === wanted);
        if (match) setSelectedInvoice(match);
        window.history.replaceState(null, '', window.location.hash.split('?')[0]);
    }, [invoices]);

    // 2. Fetch Tenant Details (Replaces generic Shop Settings)
    const { data: tenant } = useQuery({
        queryKey: ['tenant'],
        queryFn: async () => {
            if (!profile?.tenant_id) return null;
            const { data } = await supabase
                .from('tenants')
                .select('name, address, phone, email, brand_color, logo_url, terms_and_conditions, payment_qr_url, payment_link, bank_details')
                .eq('id', profile.tenant_id)
                .single();
            return data;
        },
        enabled: !!profile?.tenant_id
    });

    // 3. Filter Logic (Updated to include Date)
    const filteredInvoices = invoices.filter(inv => 
        inv.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.vehicle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.date.includes(searchTerm) // <--- Added Date Search
    );

    const refreshInvoices = () => queryClient.invalidateQueries({ queryKey: ['invoices'] });

    // 4. Status Update Logic
    const handleStatusUpdate = async (newStatus: string) => {
        if (!selectedInvoice) return;
        
        // Confirmation for payment status change
        if (!await confirm({ message: `Mark this invoice as ${newStatus}?`, confirmLabel: 'Update', confirmStyle: 'default' })) return;

        setUpdatingStatus(true);
        const { error } = await supabase
            .from('invoices')
            .update({ status: newStatus })
            .eq('id', selectedInvoice.id);
        
        if (error) {
            console.error("Error updating invoice:", error);
            console.error("Failed to update invoice status:", error.message);
        } else {
            const updatedInv = { ...selectedInvoice, status: newStatus };
            setSelectedInvoice(updatedInv);
            refreshInvoices();
        }
        setUpdatingStatus(false);
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Paid': return <CheckCircle size={14} />;
            case 'Unpaid': return <Clock size={14} />;
            default: return <AlertCircle size={14} />;
        }
    };

    // 5. PDF Generation (B&W / Minimalist / Professional)
    const buildInvoicePdf = async (inv: any): Promise<{ doc: jsPDF; filename: string }> => {
        const doc = new jsPDF();
        
        // --- Header ---
        const pageWidth = doc.internal.pageSize.getWidth();
        const marginLeft = 15;
        const marginRight = 15;

        // 1. Logo (Top Left)
        let headerY = 15;
        let leftColumnY = headerY;
        if (tenant?.logo_url) {
            try {
                const base64Img = await urlToBase64(tenant.logo_url);
                const imgProps = doc.getImageProperties(base64Img);
                const ratio = imgProps.height / imgProps.width;
                const width = 35; // Slightly larger for professional look
                const height = width * ratio;
                doc.addImage(base64Img, 'PNG', marginLeft, headerY, width, height); 
                leftColumnY = headerY + height + 8;
            } catch (e) {
                console.warn("Logo error", e);
                leftColumnY = headerY + 10;
            }
        } else {
            leftColumnY = headerY;
        }

        // 2. Invoice Label & Meta (Top Right)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(24);
        doc.setTextColor(0); // Black
        doc.text('INVOICE', pageWidth - marginRight, 25, { align: 'right' });
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80); // Dark Gray
        doc.text(`#${inv.invoiceNumber}`, pageWidth - marginRight, 32, { align: 'right' });
        doc.text(`Date: ${inv.date}`, pageWidth - marginRight, 37, { align: 'right' });
        
        // Status is stored capitalised ('Paid'), so a lowercase comparison never
        // matched and every paid invoice printed in the unpaid red.
        doc.setFont('helvetica', 'bold');
        if (inv.status?.toLowerCase() === 'paid') doc.setTextColor(34, 197, 94);
        else doc.setTextColor(239, 68, 68);
        doc.text(`STATUS: ${inv.status.toUpperCase()}`, pageWidth - marginRight, 42, { align: 'right' });
        
        doc.setTextColor(0); // Reset

        // 3. Shop Details (Left, below logo)
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        const shopName = tenant?.name || 'Service Center';
        doc.text(shopName, marginLeft, leftColumnY);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60);
        leftColumnY += 6;
        
        // Safety check for address/phone/email
        const tAddress = tenant?.address || '';
        const tPhone = tenant?.phone || '';
        const tEmail = tenant?.email || '';

        if (tAddress) { 
            const splitAddress = doc.splitTextToSize(tAddress, 80);
            doc.text(splitAddress, marginLeft, leftColumnY); 
            leftColumnY += (splitAddress.length * 5); 
        }
        if (tPhone) { doc.text(tPhone, marginLeft, leftColumnY); leftColumnY += 5; }
        if (tEmail) { doc.text(tEmail, marginLeft, leftColumnY); leftColumnY += 5; }

        // 4. Customer Details (Right side, below Invoice #)
        let customerY = 47;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Bill To:', pageWidth - marginRight, customerY, { align: 'right' });
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60);
        customerY += 5;

        const cName = withTitle(inv.customerDetails?.title, inv.customerDetails?.name) || 'Cash Customer';
        const cPhone = inv.customerDetails?.phone || '';
        const cAddress = inv.customerDetails?.address || '';
        
        doc.text(cName, pageWidth - marginRight, customerY, { align: 'right' });
        customerY += 4.5;

        if (cAddress) {
            const splitCAddress = doc.splitTextToSize(cAddress, 80);
            splitCAddress.forEach((line: string) => {
                doc.text(line, pageWidth - marginRight, customerY, { align: 'right' });
                customerY += 4.5;
            });
        }
        if (cPhone) {
            doc.text(cPhone, pageWidth - marginRight, customerY, { align: 'right' });
            customerY += 4.5;
        }
        
        // 5. Vehicle — the customer's first check is that the bill is for their car.
        let yPos = Math.max(leftColumnY, customerY) + 6;
        const veh = inv.vehicleDetails;
        if (veh) {
            doc.setFillColor(245, 247, 250);
            doc.rect(marginLeft, yPos, pageWidth - (marginLeft * 2), 16, 'F');
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
            const vehExtra = [
                veh.color && `Colour: ${veh.color}`,
                veh.vin && `VIN: ${veh.vin}`,
                inv.mileage && `Mileage: ${Number(inv.mileage).toLocaleString()} km`,
            ].filter(Boolean).join('    ');
            if (vehExtra) doc.text(vehExtra, marginLeft + 40, yPos + 11.5);
            doc.setTextColor(0);
            yPos += 20;
        }

        // 6. Items Table
        const colTotal = pageWidth - marginRight - 5;   // right edge
        const colQty   = colTotal - 26;                 // hours / qty
        const colUnit  = colQty - 26;                   // unit price
        const descWidth = colUnit - (marginLeft + 5) - 4;

        const pageHeight = doc.internal.pageSize.getHeight();
        const bottomLimit = pageHeight - 20; // clear of the footer line
        let repeatHeader: (() => void) | null = null;

        const ensureSpace = (needed: number) => {
            if (yPos + needed <= bottomLimit) return;
            doc.addPage();
            yPos = 20;
            if (repeatHeader) repeatHeader();
        };

        const drawSectionHeader = (label: string, unitLabel?: string, qtyLabel?: string) => {
            doc.setFillColor(245, 247, 250);
            doc.rect(marginLeft, yPos, pageWidth - (marginLeft * 2), 8, 'F');
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

        // unitLabel/qtyLabel omitted => description + total only, used for a
        // section whose rows are all flat-priced.
        const sectionHeader = (label: string, unitLabel?: string, qtyLabel?: string) => {
            repeatHeader = null; // a header must never start a page it also filled
            ensureSpace(22);     // no orphan header: room for the header and a row
            repeatHeader = () => drawSectionHeader(`${label} (continued)`, unitLabel, qtyLabel);
            drawSectionHeader(label, unitLabel, qtyLabel);
        };

        const row = (
            desc: string,
            netTotal: number,
            unit?: number,
            qty?: number | string,
            discount?: {
                off: number;
                gross: number;
                type?: string | null;
                value?: number | string | null;
            }
        ) => {
            const hasLineDiscount = !!discount && discount.off > 0;
            const width = unit === undefined ? colTotal - (marginLeft + 5) - 6 : descWidth;
            const lines = doc.splitTextToSize(desc, width);
            const lineBaseHeight = lines.length * 4.6;
            const height = hasLineDiscount ? Math.max(10, lineBaseHeight + 5) : Math.max(7.5, lineBaseHeight + 2.5);
            ensureSpace(height);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(50);
            doc.text(lines, marginLeft + 5, yPos);

            if (unit !== undefined) {
                doc.text(Number(unit).toLocaleString(), colUnit, yPos, { align: 'right' });
            }
            if (qty !== undefined) {
                doc.text(String(qty), colQty, yPos, { align: 'right' });
            }

            if (hasLineDiscount) {
                // Top line: Normal Gross Total in gray with clean strikethrough (Rate * Qty matches this!)
                const grossStr = discount.gross.toLocaleString();
                doc.setFontSize(8.5);
                doc.setTextColor(130);
                doc.text(grossStr, colTotal, yPos, { align: 'right' });
                const grossWidth = doc.getTextWidth(grossStr);
                doc.setDrawColor(130);
                doc.setLineWidth(0.3);
                doc.line(colTotal - grossWidth, yPos - 1.1, colTotal, yPos - 1.1);

                // Sub-line: Savings note on left, Net Discounted Total on right in bold
                const discY = yPos + 4.2;
                const discNote = discount.type === 'percent'
                    ? `${discount.value}% discount applied (-LKR ${discount.off.toLocaleString()})`
                    : `Discount applied (-LKR ${discount.off.toLocaleString()})`;
                
                doc.setFontSize(7.5);
                doc.setTextColor(16, 149, 105); // Emerald green for customer appreciation
                doc.text(discNote, marginLeft + 7, discY);

                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(0);
                doc.text(netTotal.toLocaleString(), colTotal, discY, { align: 'right' });
            } else {
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(50);
                doc.text(netTotal.toLocaleString(), colTotal, yPos, { align: 'right' });
            }

            yPos += height;
        };

        if (inv.labor.length) {
            // Hours/rate columns only appear when some labour is actually billed by
            // the clock; a fixed-price job has no hours worth printing.
            const anyHourly = inv.labor.some((l: any) => !l.is_fixed);
            sectionHeader('Labour / Description', anyHourly ? 'RATE' : undefined, anyHourly ? 'HOURS' : undefined);
            inv.labor.forEach((l: any) => {
                const gross = (Number(l.hours) || 0) * (Number(l.hourly_rate_lkr) || 0);
                const off = calcDiscount(gross, l.discount_type, l.discount_value);
                row(
                    l.description || 'Service',
                    Math.max(0, gross - off),
                    anyHourly && !l.is_fixed ? Number(l.hourly_rate_lkr) || 0 : undefined,
                    anyHourly && !l.is_fixed ? l.hours : undefined,
                    off > 0 ? { off, gross, type: l.discount_type, value: l.discount_value } : undefined,
                );
            });
            yPos += 2;
        }

        if (inv.parts.length) {
            sectionHeader('Materials / Parts', 'PRICE', 'QTY');
            inv.parts.forEach((p: any) => {
                const gross = (Number(p.quantity) || 0) * (Number(p.price_at_time_lkr) || 0);
                const off = calcDiscount(gross, p.discount_type, p.discount_value);
                row(
                    p.custom_name || p.parts?.name || 'Part',
                    Math.max(0, gross - off),
                    Number(p.price_at_time_lkr) || 0,
                    p.quantity,
                    off > 0 ? { off, gross, type: p.discount_type, value: p.discount_value } : undefined,
                );
            });
            yPos += 2;
        }

        if (!inv.labor.length && !inv.parts.length) {
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(120);
            doc.text('No items recorded for this job.', marginLeft + 5, yPos);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(50);
            yPos += 8;
        }
        
        // Totals must not be separated from the rule above them, so the whole
        // block is placed as one unit.
        repeatHeader = null;
        const totalDiscount = Number(inv.discount) || 0;
        const linesDiscount = Number(inv.linesDiscount) || 0;
        const jobDiscountAmount = Number(inv.jobDiscount) || 0;
        const hasBothDiscounts = linesDiscount > 0 && jobDiscountAmount > 0;

        ensureSpace(totalDiscount > 0 ? (hasBothDiscounts ? 36 : 28) : 16);

        // Draw Line
        doc.setDrawColor(220);
        doc.line(marginLeft, yPos + 2, pageWidth - marginRight, yPos + 2);

        // 7. Totals
        yPos += 8;
        if (totalDiscount > 0) {
            doc.setFontSize(9.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(80);
            doc.text('Subtotal (Normal Price)', pageWidth - marginRight - 65, yPos);
            doc.text(inv.subtotal.toLocaleString(), pageWidth - marginRight, yPos, { align: 'right' });
            yPos += 5.5;

            if (hasBothDiscounts) {
                doc.setTextColor(16, 149, 105);
                doc.text('Line Discounts', pageWidth - marginRight - 65, yPos);
                doc.text(`- ${linesDiscount.toLocaleString()}`, pageWidth - marginRight, yPos, { align: 'right' });
                yPos += 5.5;

                const jobLabel = inv.jobDiscountType === 'percent'
                    ? `Discount (${inv.jobDiscountValue}%)`
                    : 'Discount';
                doc.text(jobLabel, pageWidth - marginRight - 65, yPos);
                doc.text(`- ${jobDiscountAmount.toLocaleString()}`, pageWidth - marginRight, yPos, { align: 'right' });
                yPos += 6;
            } else {
                const label = jobDiscountAmount > 0
                    ? (inv.jobDiscountType === 'percent' ? `Discount (${inv.jobDiscountValue}%)` : 'Discount')
                    : 'Discount (You Save)';
                doc.setTextColor(16, 149, 105);
                doc.text(label, pageWidth - marginRight - 65, yPos);
                doc.text(`- ${totalDiscount.toLocaleString()}`, pageWidth - marginRight, yPos, { align: 'right' });
                yPos += 6;
            }
        }
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        
        doc.text('TOTAL', pageWidth - marginRight - 65, yPos);
        doc.setTextColor(6, 182, 212); // Cyan color
        const totalStr = `LKR ${inv.total.toLocaleString()}`;
        doc.text(totalStr, pageWidth - marginRight, yPos, { align: 'right' });

        if (totalDiscount > 0) {
            yPos += 5;
            doc.setFontSize(8);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(16, 149, 105);
            doc.text(`Total savings on this bill: LKR ${totalDiscount.toLocaleString()}`, pageWidth - marginRight, yPos, { align: 'right' });
        }
        
        // Payment QR / link — above Terms, since it's what the customer acts on
        if (tenant?.payment_qr_url || tenant?.payment_link) {
            yPos += 16;
            ensureSpace(45); // label + a 34mm QR
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0);
            doc.text('Payment', marginLeft, yPos);
            yPos += 5;

            let qrBottom = yPos;
            if (tenant.payment_qr_url) {
                try {
                    const qrImg = await urlToBase64(tenant.payment_qr_url);
                    const qrProps = doc.getImageProperties(qrImg);
                    const { width, height } = fitLogoBox(qrProps.width, qrProps.height, 34, 34);
                    doc.addImage(qrImg, 'PNG', marginLeft, yPos, width, height);
                    qrBottom = yPos + height;
                } catch (e) { console.warn('Payment QR error', e); }
            }

            if (tenant.payment_link) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(6, 182, 212);
                doc.textWithLink(tenant.payment_link, marginLeft + 40, yPos + 8, { url: tenant.payment_link });
            }

            doc.setTextColor(0);
            yPos = Math.max(qrBottom, yPos + 8);
        }

        // Bank details — boxed and tinted, because this is the block the customer
        // has to copy accurately to pay, and a mistyped account number costs the
        // workshop a reconciliation.
        if (tenant?.bank_details?.trim()) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            const bankLines = doc.splitTextToSize(tenant.bank_details.trim(), pageWidth - (marginLeft * 2) - 12);
            const boxHeight = 7 + (bankLines.length * 4) + 3;

            yPos += 6;
            ensureSpace(boxHeight + 3);

            doc.setFillColor(232, 246, 249);
            doc.setDrawColor(6, 182, 212);
            doc.setLineWidth(0.5);
            doc.rect(marginLeft, yPos, pageWidth - (marginLeft * 2), boxHeight, 'FD');
            // Accent bar: the eye finds the box before it reads the page.
            doc.setFillColor(6, 182, 212);
            doc.rect(marginLeft, yPos, 1.6, boxHeight, 'F');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(8, 108, 125);
            doc.text('BANK TRANSFER DETAILS', marginLeft + 6, yPos + 5.5);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(20);
            doc.text(bankLines, marginLeft + 6, yPos + 10.5);

            doc.setTextColor(0);
            doc.setLineWidth(0.2);
            yPos += boxHeight;
        }

        // Terms & Conditions
        if (tenant?.terms_and_conditions) {
            const splitTerms = doc.splitTextToSize(tenant.terms_and_conditions, pageWidth - marginLeft - marginRight);
            const termsHeight = 5 + (splitTerms.length * 3.5);
            ensureSpace(termsHeight + 5);

            yPos += 5;
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0);
            doc.text('Terms & Conditions:', marginLeft, yPos);
            yPos += 4.5;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(80);
            doc.text(splitTerms, marginLeft, yPos);
        }

        // Footer on every page. Page numbers only earn their place once the
        // invoice actually spans more than one.
        const pageCount = doc.getNumberOfPages();
        for (let page = 1; page <= pageCount; page++) {
            doc.setPage(page);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.setFont('helvetica', 'italic');
            if (page === pageCount) {
                doc.text('Thank you for your business!', pageWidth / 2, pageHeight - 15, { align: 'center' });
            }
            if (pageCount > 1) {
                doc.text(`Page ${page} of ${pageCount}`, pageWidth - marginRight, pageHeight - 15, { align: 'right' });
                doc.text(`Invoice #${inv.invoiceNumber}`, marginLeft, pageHeight - 15);
            }
        }

        const firstName = (inv.customerDetails?.name || 'Customer').split(' ')[0].replace(/[^a-z0-9]/gi, '_');
        
        const dateObj = inv.rawDate instanceof Date ? inv.rawDate : new Date(inv.rawDate || Date.now());
        const day = isNaN(dateObj.getTime()) ? '01' : String(dateObj.getDate()).padStart(2, '0');
        const month = isNaN(dateObj.getTime()) ? '01' : String(dateObj.getMonth() + 1).padStart(2, '0');
        return { doc, filename: `Invoice-${inv.invoiceNumber}-${firstName}-${day}${month}.pdf` };
    };

    // `unknown` is assignable to buildInvoicePdf's parameter; this only forwards.
    const generatePDF = async (inv: unknown) => {
        const { doc, filename } = await buildInvoicePdf(inv);
        doc.save(filename);
    };

    const shareOnWhatsApp = async (inv: ShareableInvoice) => {
        setSharing(true);
        try {
            const { doc, filename } = await buildInvoicePdf(inv);
            const file = new File([doc.output('blob')], filename, { type: 'application/pdf' });
            const text = invoiceMessage({
                invoiceNumber: inv.invoiceNumber,
                vehicle: inv.vehicle,
                total: inv.total,
                subtotal: inv.subtotal,
                discount: inv.discount,
                shopName: tenant?.name,
                paymentLink: tenant?.payment_link,
            });

            const result = await shareInvoice({
                file,
                title: `Invoice ${inv.invoiceNumber}`,
                text,
                phone: inv.customerDetails?.phone,
            });

            // Share sheet couldn't take the file, so WhatsApp only got the text —
            // save the PDF too so there's something to attach manually.
            if (result === 'fallback') doc.save(filename);
        } catch (e) {
            console.error('WhatsApp share failed:', e);
        } finally {
            setSharing(false);
        }
    };



    return (
        <div className="p-2 h-[calc(100dvh-100px)] flex flex-col">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Invoices</h1>
                    <p className="text-slate-400">Manage billing and payments.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => downloadCSV('invoices', filteredInvoices.map((inv: any) => ({
                            invoice_number: inv.invoiceNumber, customer: inv.customer,
                            vehicle: inv.vehicle, date: inv.date,
                            status: inv.status, total_lkr: inv.total,
                        })))}
                        className="p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors"
                        title="Export CSV"
                    >
                        <Download size={20} />
                    </button>
                    <button onClick={refreshInvoices} className="p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors">
                        <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative mb-6">
                <Search className="absolute left-3 top-3.5 text-slate-500" size={18} />
                <input 
                    type="text" 
                    placeholder="Search by customer, vehicle, or date (e.g., 12/25)..." 
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 text-white focus:outline-none focus:border-cyan-500 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="flex flex-col md:flex-row gap-6 h-full min-h-0">
                {/* LIST */}
                <div className={`w-full md:w-1/3 bg-slate-900/50 border border-slate-800 rounded-2xl p-4 overflow-y-auto ${selectedInvoice ? 'hidden md:block' : 'block'}`}>
                    <div className="space-y-3">
                        {filteredInvoices.map(inv => (
                            <div 
                                key={inv.id} 
                                onClick={() => setSelectedInvoice(inv)}
                                style={selectedInvoice?.id === inv.id ? { borderColor: profile?.tenants?.brand_color || '#06b6d4' } : {}}
                                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                                    selectedInvoice?.id === inv.id 
                                    ? 'bg-slate-800' 
                                    : 'bg-slate-800/30 border-slate-800 hover:bg-slate-800'
                                }`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <div className="font-bold text-white text-sm md:text-base">{inv.customer}</div>
                                    <div className="text-[10px] md:text-xs text-slate-500 whitespace-nowrap">{inv.date}</div>
                                </div>
                                <div className="text-sm text-slate-400 mb-2">{inv.vehicle}</div>
                                <div className="flex justify-between items-center">
                                    <span className={`text-xs px-2 py-1 rounded font-bold uppercase flex items-center gap-1 ${
                                        inv.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                                    }`}>
                                        {getStatusIcon(inv.status)}
                                        {inv.status}
                                    </span>
                                    <span className="font-mono text-white font-bold">LKR {inv.total.toLocaleString()}</span>
                                </div>
                            </div>
                        ))}
                        {filteredInvoices.length === 0 && <div className="text-center text-slate-500 py-10">No invoices found.</div>}
                    </div>
                </div>

                {/* PREVIEW */}
                <div className={`w-full flex-1 min-h-0 bg-slate-900 border border-slate-800 rounded-2xl md:p-6 flex flex-col overflow-hidden ${!selectedInvoice ? 'hidden md:flex' : 'flex'}`}>
                    {selectedInvoice ? (
                        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto relative">
                            {/* Mobile Back & Header */}
                            <div className="flex shrink-0 flex-col gap-4 mb-6 border-b border-slate-800 pb-4 p-4 md:p-0">
                                <button onClick={() => setSelectedInvoice(null)} className="md:hidden text-slate-400 flex items-center gap-2 self-start hover:text-white transition-colors print:hidden">
                                    ← Back to List
                                </button>
                                
                                {/* Company Header */}
                                <div className="flex flex-col gap-3 border-b border-slate-800 pb-4 mb-4 sm:flex-row sm:justify-between sm:items-start">
                                    <div className="min-w-0">
                                        <h1 className="text-lg font-black text-white uppercase tracking-tight leading-tight truncate" style={{ color: tenant?.brand_color || '#06b6d4' }}>
                                            {tenant?.name || 'Service Center'}
                                        </h1>
                                        <div className="text-xs text-slate-400 mt-1 space-y-0.5">
                                            <p className="truncate">{tenant?.address}</p>
                                            <p>{tenant?.phone}</p>
                                        </div>
                                    </div>
                                    <div className="text-left sm:text-right flex-shrink-0">
                                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Invoice</div>
                                        <div className="text-base font-mono text-white font-bold">{selectedInvoice.invoiceNumber}</div>
                                        <div className="text-xs text-slate-500 mt-0.5">{selectedInvoice.date}</div>
                                    </div>
                                </div>
                                    
                                    <div className="flex flex-col items-end gap-1 w-full md:w-auto">
                                        <label className="text-[10px] text-slate-400 font-bold uppercase">Payment Status</label>
                                        <div className="flex items-center gap-2 w-full md:w-auto">
                                            <div className="text-slate-400 hidden md:block">
                                                {getStatusIcon(selectedInvoice.status)}
                                            </div>
                                            <select 
                                                value={selectedInvoice.status}
                                                onChange={(e) => handleStatusUpdate(e.target.value)}
                                                disabled={updatingStatus}
                                                className="w-full md:w-auto bg-slate-950 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-cyan-500"
                                            >
                                                <option value="Unpaid">Pending Payment</option>
                                                <option value="Paid">Paid Fully</option>
                                                <option value="Refunded">Refunded</option>
                                                <option value="Cancelled">Cancelled</option>
                                            </select>
                                        </div>
                                    </div>

                            </div>

                            {/* Vehicle */}
                            <div className="shrink-0 bg-slate-950 rounded-xl border border-slate-800 p-4 mb-4">
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Vehicle</div>
                                <div className="text-white font-bold text-sm">
                                    {[selectedInvoice.vehicleDetails?.year, selectedInvoice.vehicleDetails?.make, selectedInvoice.vehicleDetails?.model].filter(Boolean).join(' ')}
                                    {' — '}
                                    <span className="font-mono">{selectedInvoice.vehicleDetails?.license_plate || 'No plate'}</span>
                                </div>
                                <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                                    {selectedInvoice.vehicleDetails?.color && <span>Colour: {selectedInvoice.vehicleDetails.color}</span>}
                                    {selectedInvoice.vehicleDetails?.vin && <span>VIN: {selectedInvoice.vehicleDetails.vin}</span>}
                                    {selectedInvoice.mileage && <span>Mileage: {Number(selectedInvoice.mileage).toLocaleString()} km</span>}
                                </div>
                            </div>

                            {/* PREVIEW BREAKDOWN TABLE - Responsive */}
                            <div className="w-full shrink-0 bg-slate-950 rounded-xl border border-slate-800 mb-4 overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <tbody className="divide-y divide-slate-800 text-slate-300">
                                        {/* Labour, then materials — grouped, each with its own
                                            columns, mirroring the PDF. */}
                                        {selectedInvoice.labor.length > 0 && (
                                            <tr className="bg-slate-900 text-slate-400 text-xs uppercase font-bold">
                                                <th className="px-3 py-2.5 md:px-6 text-left">Labour / Description</th>
                                                <th className="px-3 py-2.5 md:px-6 text-right">Total</th>
                                            </tr>
                                        )}
                                        {selectedInvoice.labor.map((l: any, i: number) => {
                                            const gross = (Number(l.hours) || 0) * (Number(l.hourly_rate_lkr) || 0);
                                            const off = calcDiscount(gross, l.discount_type, l.discount_value);
                                            return (
                                                <tr key={`l-${i}`} className="hover:bg-slate-900/50">
                                                    <td className="px-3 py-3 md:px-6 md:py-4">
                                                        <div className="font-medium text-white text-sm">{l.description}</div>
                                                        <div className="flex flex-wrap items-center gap-2 text-[10px] md:text-xs text-slate-400 mt-0.5">
                                                            {!l.is_fixed && (
                                                                <span>{l.hours} hrs &times; LKR {Number(l.hourly_rate_lkr).toLocaleString()}</span>
                                                            )}
                                                            {off > 0 && (
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                                                    {l.discount_type === 'percent' ? `${l.discount_value}% discount applied` : 'Discount applied'} (-LKR {off.toLocaleString()})
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 md:px-6 md:py-4 text-right font-mono text-sm">
                                                        {off > 0 ? (
                                                            <>
                                                                <span className="block text-[11px] text-slate-500 line-through">{gross.toLocaleString()}</span>
                                                                <span className="text-emerald-400 font-bold">{Math.max(0, gross - off).toLocaleString()}</span>
                                                            </>
                                                        ) : (
                                                            gross.toLocaleString()
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {selectedInvoice.parts.length > 0 && (
                                            <tr className="bg-slate-900 text-slate-400 text-xs uppercase font-bold">
                                                <th className="px-3 py-2.5 md:px-6 text-left">Materials / Parts</th>
                                                <th className="px-3 py-2.5 md:px-6 text-right">Total</th>
                                            </tr>
                                        )}
                                        {selectedInvoice.parts.map((p: any, i: number) => {
                                            const gross = (Number(p.quantity) || 0) * (Number(p.price_at_time_lkr) || 0);
                                            const off = calcDiscount(gross, p.discount_type, p.discount_value);
                                            return (
                                                <tr key={`p-${i}`} className="hover:bg-slate-900/50">
                                                    <td className="px-3 py-3 md:px-6 md:py-4">
                                                        <div className="font-medium text-white text-sm">{p.custom_name || p.parts?.name}</div>
                                                        <div className="flex flex-wrap items-center gap-2 text-[10px] md:text-xs text-slate-400 mt-0.5">
                                                            <span>{Number(p.price_at_time_lkr).toLocaleString()} &times; {p.quantity}</span>
                                                            {off > 0 && (
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                                                    {p.discount_type === 'percent' ? `${p.discount_value}% discount applied` : 'Discount applied'} (-LKR {off.toLocaleString()})
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 md:px-6 md:py-4 text-right font-mono text-sm">
                                                        {off > 0 ? (
                                                            <>
                                                                <span className="block text-[11px] text-slate-500 line-through">{gross.toLocaleString()}</span>
                                                                <span className="text-emerald-400 font-bold">{Math.max(0, gross - off).toLocaleString()}</span>
                                                            </>
                                                        ) : (
                                                            gross.toLocaleString()
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {selectedInvoice.parts.length === 0 && selectedInvoice.labor.length === 0 && (
                                            <tr>
                                                <td className="px-3 py-3 md:px-6 md:py-4 text-slate-500 italic">No breakdown items available.</td>
                                                <td className="px-3 py-3 md:px-6 md:py-4 text-right text-slate-500">-</td>
                                            </tr>
                                        )}
                                    </tbody>
                                    <tfoot className="bg-slate-900 font-bold text-white border-t border-slate-800">
                                        {selectedInvoice.discount > 0 && (
                                            <>
                                                <tr className="text-slate-400 font-normal">
                                                    <td className="px-3 py-2 md:px-6 text-right uppercase text-[10px] md:text-xs tracking-wider">Subtotal (Normal Price)</td>
                                                    <td className="px-3 py-2 md:px-6 text-right font-mono text-sm">{selectedInvoice.subtotal.toLocaleString()}</td>
                                                </tr>
                                                {selectedInvoice.linesDiscount > 0 && selectedInvoice.jobDiscount > 0 ? (
                                                    <>
                                                        <tr className="text-emerald-400 font-normal">
                                                            <td className="px-3 py-2 md:px-6 text-right uppercase text-[10px] md:text-xs tracking-wider">Line Discounts</td>
                                                            <td className="px-3 py-2 md:px-6 text-right font-mono text-sm">- {selectedInvoice.linesDiscount.toLocaleString()}</td>
                                                        </tr>
                                                        <tr className="text-amber-400 font-normal">
                                                            <td className="px-3 py-2 md:px-6 text-right uppercase text-[10px] md:text-xs tracking-wider">
                                                                {selectedInvoice.jobDiscountType === 'percent' ? `Discount (${selectedInvoice.jobDiscountValue}%)` : 'Discount'}
                                                            </td>
                                                            <td className="px-3 py-2 md:px-6 text-right font-mono text-sm">- {selectedInvoice.jobDiscount.toLocaleString()}</td>
                                                        </tr>
                                                    </>
                                                ) : (
                                                    <tr className="text-emerald-400 font-normal">
                                                        <td className="px-3 py-2 md:px-6 text-right uppercase text-[10px] md:text-xs tracking-wider">
                                                            {selectedInvoice.jobDiscount > 0 ? selectedInvoice.discountLabel : 'Discount (You Save)'}
                                                        </td>
                                                        <td className="px-3 py-2 md:px-6 text-right font-mono text-sm">- {selectedInvoice.discount.toLocaleString()}</td>
                                                    </tr>
                                                )}
                                            </>
                                        )}
                                        <tr>
                                            <td className="px-3 py-3 md:px-6 md:py-4 text-right uppercase text-[10px] md:text-xs tracking-wider text-slate-400">Total Due</td>
                                            <td className="px-3 py-3 md:px-6 md:py-4 text-right text-base md:text-lg text-emerald-400 font-mono">
                                                LKR {selectedInvoice.total.toLocaleString()}
                                            </td>
                                        </tr>
                                        {selectedInvoice.discount > 0 && (
                                            <tr className="border-t border-slate-800/80 bg-emerald-950/20">
                                                <td colSpan={2} className="px-3 py-2 md:px-6 text-right text-xs text-emerald-400 font-medium">
                                                    Customer saves LKR {selectedInvoice.discount.toLocaleString()} on this bill
                                                </td>
                                            </tr>
                                        )}
                                    </tfoot>
                                </table>
                            </div>

                            {/* Actions - Pinned Bottom */}
                            <div className="flex gap-3 p-4 mt-auto border-t border-slate-800 bg-slate-900 sticky bottom-0 z-20">
                                <button
                                    onClick={() => shareOnWhatsApp(selectedInvoice)}
                                    disabled={sharing}
                                    title="Send this invoice to the customer on WhatsApp"
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                                >
                                    <MessageCircle size={20} />
                                    <span className="hidden md:inline">{sharing ? 'Preparing…' : 'WhatsApp'}</span>
                                    <span className="md:hidden">{sharing ? '…' : 'WhatsApp'}</span>
                                </button>
                                <button onClick={() => generatePDF(selectedInvoice)} className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all active:scale-95">
                                    <Download size={20} /> <span className="hidden md:inline">Download PDF</span><span className="md:hidden">PDF</span>
                                </button>
                                <button onClick={() => window.print()} className="px-6 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold active:scale-95 transition-all">
                                    <Printer size={20} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 opacity-50">
                            <FileText size={64} className="mb-4" />
                            <p>Select an invoice to view details</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};