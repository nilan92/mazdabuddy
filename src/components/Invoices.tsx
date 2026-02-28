import { useState } from 'react';
import { 
    Printer, 
    Download, 
    FileText, 
    RefreshCcw, 
    Search, 
    CheckCircle, 
    Clock, 
    AlertCircle 
} from 'lucide-react';
import jsPDF from 'jspdf';
import { supabase } from '../lib/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { urlToBase64 } from '../utils/pdfHelpers';

export const Invoices = () => {
    const queryClient = useQueryClient();
    const { profile } = useAuth();
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [updatingStatus, setUpdatingStatus] = useState(false);

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
                        vehicles!inner (license_plate, make, model, year, customers!inner(name, address, phone, email)),
                        job_parts ( quantity, price_at_time_lkr, custom_name, parts(name) ),
                        job_labor ( description, hours, hourly_rate_lkr )
                    )
                `)
                .order('created_at', { ascending: false })
                .limit(50);
            
            if (error) throw error;

            return data?.map((inv: any) => ({
                id: inv.id,
                invoiceNumber: `INV-${inv.id.slice(0, 8).toUpperCase()}`,
                customer: inv.job_cards?.vehicles?.customers?.name || 'Unknown',
                customerDetails: inv.job_cards?.vehicles?.customers,
                vehicle: `${inv.job_cards?.vehicles?.make} ${inv.job_cards?.vehicles?.model} (${inv.job_cards?.vehicles?.license_plate})`,
                vehicleDetails: inv.job_cards?.vehicles,
                total: Number(inv.total_amount_lkr) || 0,
                status: inv.status || 'Unpaid',
                date: new Date(inv.created_at).toLocaleDateString('en-GB', { 
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                rawDate: new Date(inv.created_at),
                parts: inv.job_cards?.job_parts || [],
                labor: inv.job_cards?.job_labor || []
            })) || [];
        }
    });

    // 2. Fetch Tenant Details (Replaces generic Shop Settings)
    const { data: tenant } = useQuery({
        queryKey: ['tenant'],
        queryFn: async () => {
            if (!profile?.tenant_id) return null;
            const { data } = await supabase
                .from('tenants')
                .select('name, address, phone, email, brand_color, logo_url, terms_and_conditions')
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
        if (!window.confirm(`Are you sure you want to mark this invoice as ${newStatus}?`)) {
            return;
        }

        setUpdatingStatus(true);
        const { error } = await supabase
            .from('invoices')
            .update({ status: newStatus })
            .eq('id', selectedInvoice.id);
        
        if (error) {
            console.error("Error updating invoice:", error);
            alert(`Failed to update status: ${error.message}`);
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
    const generatePDF = async (inv: any) => {
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
        
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(inv.status === 'paid' ? 34 : 239, inv.status === 'paid' ? 197 : 68, inv.status === 'paid' ? 94 : 68);
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
        let customerY = 55;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Bill To:', pageWidth - marginRight, customerY, { align: 'right' });
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60);
        customerY += 6;

        const cName = inv.customerDetails?.name || 'Cash Customer';
        const cPhone = inv.customerDetails?.phone || '';
        const cAddress = inv.customerDetails?.address || '';
        
        doc.text(cName, pageWidth - marginRight, customerY, { align: 'right' });
        customerY += 5;

        if (cAddress) {
            const splitCAddress = doc.splitTextToSize(cAddress, 80);
            splitCAddress.forEach((line: string) => {
                doc.text(line, pageWidth - marginRight, customerY, { align: 'right' });
                customerY += 5;
            });
        }
        if (cPhone) {
            doc.text(cPhone, pageWidth - marginRight, customerY, { align: 'right' });
            customerY += 5;
        }
        
        // 5. Items Table
        let yPos = Math.max(leftColumnY, customerY) + 15; 
        
        // Table Headers
        doc.setFillColor(245, 247, 250);
        doc.rect(marginLeft, yPos, pageWidth - (marginLeft * 2), 10, 'F');
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text('ITEM / DESCRIPTION', marginLeft + 5, yPos + 7);
        doc.text('COST', pageWidth - marginRight - 5, yPos + 7, { align: 'right' });
        
        yPos += 15;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(50);
        
        // Items - Parts
        inv.parts.forEach((p: any) => {
            const name = p.custom_name || p.parts?.name || 'Part';
            const price = (p.quantity * p.price_at_time_lkr).toLocaleString();
            
            doc.text(`${name} (Qty: ${p.quantity})`, marginLeft + 5, yPos);
            doc.text(price, pageWidth - marginRight - 5, yPos, { align: 'right' });
            yPos += 8;
        });
        
        // Items - Labor
        inv.labor.forEach((l: any) => {
            const desc = l.description || 'Service';
            const price = (l.hours * l.hourly_rate_lkr).toLocaleString();
            
            doc.text(`${desc} (${l.hours} hrs)`, marginLeft + 5, yPos);
            doc.text(price, pageWidth - marginRight - 5, yPos, { align: 'right' });
            yPos += 8;
        });
        
        // Draw Line
        doc.setDrawColor(220);
        doc.line(marginLeft, yPos + 2, pageWidth - marginRight, yPos + 2);
        
        // 6. Totals
        yPos += 10;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        
        doc.text('TOTAL', pageWidth - marginRight - 50, yPos);
        doc.setTextColor(6, 182, 212); // Cyan color
        const totalStr = `LKR ${inv.total.toLocaleString()}`;
        doc.text(totalStr, pageWidth - marginRight, yPos, { align: 'right' });
        
        // Terms & Conditions
        if (tenant?.terms_and_conditions) {
            yPos += 20;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0);
            doc.text('Terms & Conditions:', marginLeft, yPos);
            yPos += 6;
            
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(80);
            
            const splitTerms = doc.splitTextToSize(tenant.terms_and_conditions, pageWidth - marginLeft - marginRight);
            doc.text(splitTerms, marginLeft, yPos);
        }

        // Footer
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.setFont('helvetica', 'italic');
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.text('Thank you for your business!', pageWidth / 2, pageHeight - 15, { align: 'center' });
        
        const firstName = (inv.customerDetails?.name || 'Customer').split(' ')[0].replace(/[^a-z0-9]/gi, '_');
        
        const dateObj = inv.rawDate || new Date(); 
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        doc.save(`Invoice-${inv.invoiceNumber}-${firstName}-${day}${month}.pdf`);
    };



    return (
        <div className="p-2 h-[calc(100vh-100px)] flex flex-col">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Invoices</h1>
                    <p className="text-slate-400">Manage billing and payments.</p>
                </div>
                <div className="flex gap-2">
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
                <div className={`w-full md:flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6 flex flex-col ${!selectedInvoice ? 'hidden md:flex' : 'flex'}`}>
                    {selectedInvoice ? (
                        <div className="flex-1 flex flex-col h-full overflow-y-auto pb-20 md:pb-0"> 
                            {/* Mobile Back & Header */}
                            <div className="flex flex-col gap-4 mb-6 border-b border-slate-800 pb-4">
                                <button onClick={() => setSelectedInvoice(null)} className="md:hidden text-slate-400 flex items-center gap-2 self-start hover:text-white transition-colors print:hidden">
                                    ← Back to List
                                </button>
                                
                                {/* Company Header (Visible in Preview & Print) */}
                                <div className="flex justify-between items-start border-b border-slate-800 pb-6 mb-6">
                                    <div>
                                         <h1 className="text-2xl font-black text-white uppercase tracking-tight" style={{ color: tenant?.brand_color || '#06b6d4' }}>
                                            {tenant?.name || 'Service Center'}
                                         </h1>
                                         <div className="text-sm text-slate-400 mt-1 space-y-0.5">
                                            <p>{tenant?.address}</p>
                                            <p>{tenant?.phone}</p>
                                            <p>{tenant?.email}</p>
                                         </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Invoice</div>
                                        <div className="text-xl font-mono text-white">{selectedInvoice.invoiceNumber}</div>
                                        <div className="text-xs text-slate-500 mt-1">{selectedInvoice.date}</div>
                                    </div>
                                </div>
                                    
                                    <div className="flex flex-col items-end gap-1 w-full md:w-auto">
                                        <label className="text-[10px] text-slate-500 font-bold uppercase">Payment Status</label>
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

                            {/* PREVIEW BREAKDOWN TABLE - Responsive */}
                            <div className="w-full mb-6 bg-slate-950 rounded-xl border border-slate-800">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-900 text-slate-400 text-xs uppercase font-bold sticky top-0 z-10">
                                        <tr>
                                            <th className="px-3 py-3 md:px-6 md:py-4">Item / Description</th>
                                            <th className="px-3 py-3 md:px-6 md:py-4 text-right">Cost</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800 text-slate-300">
                                        {/* Parts */}
                                        {selectedInvoice.parts.map((p: any, i: number) => (
                                            <tr key={`p-${i}`} className="hover:bg-slate-900/50">
                                                <td className="px-3 py-3 md:px-6 md:py-4">
                                                    <div className="font-medium text-white text-sm">{p.custom_name || p.parts?.name}</div>
                                                    <div className="text-[10px] md:text-xs text-slate-500">Part (Qty: {p.quantity})</div>
                                                </td>
                                                <td className="px-3 py-3 md:px-6 md:py-4 text-right font-mono text-sm">
                                                    {(p.quantity * p.price_at_time_lkr).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                        {/* Labor */}
                                        {selectedInvoice.labor.map((l: any, i: number) => (
                                            <tr key={`l-${i}`} className="hover:bg-slate-900/50">
                                                <td className="px-3 py-3 md:px-6 md:py-4">
                                                    <div className="font-medium text-white text-sm">{l.description}</div>
                                                    <div className="text-[10px] md:text-xs text-slate-500">Labor ({l.hours} hrs)</div>
                                                </td>
                                                <td className="px-3 py-3 md:px-6 md:py-4 text-right font-mono text-sm">
                                                    {(l.hours * l.hourly_rate_lkr).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                        {selectedInvoice.parts.length === 0 && selectedInvoice.labor.length === 0 && (
                                            <tr>
                                                <td className="px-3 py-3 md:px-6 md:py-4 text-slate-500 italic">No breakdown items available.</td>
                                                <td className="px-3 py-3 md:px-6 md:py-4 text-right text-slate-500">-</td>
                                            </tr>
                                        )}
                                    </tbody>
                                    <tfoot className="bg-slate-900 font-bold text-white border-t border-slate-800 sticky bottom-0 z-10">
                                        <tr>
                                            <td className="px-3 py-3 md:px-6 md:py-4 text-right uppercase text-[10px] md:text-xs tracking-wider text-slate-400">Total Due</td>
                                            <td className="px-3 py-3 md:px-6 md:py-4 text-right text-base md:text-lg text-emerald-400 font-mono">
                                                LKR {selectedInvoice.total.toLocaleString()}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-4 mt-auto sticky bottom-0 bg-slate-900 p-4 border-t border-slate-800 md:relative md:border-t-0 md:bg-transparent md:p-0">
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