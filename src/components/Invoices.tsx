import { useState } from 'react';
import { Printer, Download, FileText, RefreshCcw } from 'lucide-react';
import jsPDF from 'jspdf';
import { supabase } from '../lib/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';

export const Invoices = () => {
    const queryClient = useQueryClient();
    const { profile } = useAuth();
    const [selectedJob, setSelectedJob] = useState<any>(null);

    const { data: jobs = [], isLoading: loading } = useQuery({
        queryKey: ['invoices'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('job_cards')
                .select('*, vehicles(license_plate, make, model, customers(name))')
                .eq('status', 'completed')
                .order('created_at', { ascending: false })
                .limit(50);
            
            if (error) throw error;

            return data?.map(job => ({
                id: job.id,
                customer: job.vehicles?.customers?.name || 'Unknown',
                vehicle: `${job.vehicles?.make} ${job.vehicles?.model} (${job.vehicles?.license_plate})`,
                total: Number(job.estimated_cost_lkr) || 0,
                status: 'Completed',
                date: new Date(job.created_at).toLocaleDateString()
            })) || [];
        }
    });

    const refreshInvoices = () => queryClient.invalidateQueries({ queryKey: ['invoices'] });

    const brandColor = profile?.tenants?.brand_color || '#06b6d4';

    const generatePDF = (job: any) => {
        const doc = new jsPDF();
        const tenant = profile?.tenants;
        const shopName = tenant?.name || 'AUTOPULSE';
        const shopAddress = tenant?.address || '';
        const shopPhone = tenant?.phone || '';
        const shopTerms = tenant?.terms_and_conditions || 'All repairs carry professional warranty as per standards.';
        
        // Helper to convert hex to RGB for jspdf
        const hexToRgb = (hex: string) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return { r, g, b };
        };
        const rgb = hexToRgb(brandColor);

        // Header Left - Branding
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(rgb.r, rgb.g, rgb.b);
        
        // Handle long shop names with wrapping
        const wrappedName = doc.splitTextToSize(shopName.toUpperCase(), 100);
        doc.text(wrappedName, 20, 20);
        
        let headerY = 20 + (wrappedName.length * 7);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        
        if (shopAddress) {
            const wrappedAddress = doc.splitTextToSize(shopAddress, 80);
            doc.text(wrappedAddress, 20, headerY);
            headerY += (wrappedAddress.length * 4.5);
        }
        
        if (shopPhone) {
            doc.text(`Phone: ${shopPhone}`, 20, headerY);
            headerY += 5;
        }
        
        // Header Right - Invoice Meta
        doc.setFontSize(24);
        doc.setFont('helvetica', 'light');
        doc.setTextColor(200);
        doc.text('INVOICE', 140, 22);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text(`NO: INV-${job.id.slice(0, 8).toUpperCase()}`, 140, 32);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 140, 37);
        
        // Divider
        const dividerY = Math.max(headerY + 5, 45);
        doc.setDrawColor(230);
        doc.line(20, dividerY, 190, dividerY);
        
        // Bill To
        const billToY = dividerY + 10;
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('BILL TO:', 20, billToY);
        
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.setFont('helvetica', 'bold');
        doc.text(job.customer, 20, billToY + 7);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text(job.vehicle, 20, billToY + 13);
        
        // Status & Other Info
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('PAYMENT STATUS:', 140, billToY);
        doc.setFontSize(10);
        doc.setTextColor(0, 150, 0); // Emerald
        doc.text(job.status.toUpperCase(), 140, billToY + 7);
        
        // Table Header
        const tableY = billToY + 25;
        doc.setFillColor(248, 250, 252); // Slate-50
        doc.rect(20, tableY, 170, 10, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(50);
        doc.text('DESCRIPTION', 25, tableY + 6.5);
        doc.text('AMOUNT (LKR)', 160, tableY + 6.5);
        
        // Items
        let y = tableY + 20;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0);
        doc.text('Vehicle Repair Services & Maintenance', 25, y);
        doc.setFont('courier', 'bold');
        doc.text(job.total.toLocaleString() + '.00', 160, y);
        
        // Summary
        y = 150;
        doc.line(120, y, 190, y);
        y += 10;
        doc.setFont('helvetica', 'normal');
        doc.text('Subtotal:', 130, y);
        doc.text(job.total.toLocaleString() + '.00', 160, y);
        
        y += 6;
        doc.text('Tax (0%):', 130, y);
        doc.text('0.00', 160, y);
        
        y += 10;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(rgb.r, rgb.g, rgb.b);
        doc.text('TOTAL:', 130, y);
        doc.text('LKR ' + job.total.toLocaleString(), 160, y);
        
        // Terms Section
        const termsY = 220;
        doc.setDrawColor(240);
        doc.line(20, termsY, 190, termsY);
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100);
        doc.text('TERMS & CONDITIONS', 20, termsY + 8);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(150);
        const wrappedTerms = doc.splitTextToSize(shopTerms, 170);
        doc.text(wrappedTerms, 20, termsY + 13);
        
        // Footer Note
        doc.setFontSize(9);
        doc.setTextColor(180);
        doc.text(`Thank you for choosing ${shopName}!`, 105, 280, { align: 'center' });
        
        doc.save(`Invoice-${job.id.slice(0, 8)}.pdf`);
    };

    return (
        <div className="p-2 h-[calc(100vh-100px)] flex flex-col">
            <div className="flex items-center justify-between mb-2">
                <div>
                     <h1 className="text-3xl font-bold text-white mb-2">Invoices</h1>
                     <p className="text-slate-400 mb-8">Generate and manage invoices.</p>
                </div>
                 <button 
                    onClick={refreshInvoices}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors mr-2 mb-6"
                    title="Refresh"
                >
                    <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>
            
            <div className="flex flex-col md:flex-row gap-6 h-full">
                {/* List - Hidden on mobile when job is selected */}
                <div className={`w-full md:w-1/3 bg-slate-900/50 border border-slate-800 rounded-2xl p-4 overflow-y-auto ${selectedJob ? 'hidden md:block' : 'block'}`}>
                    <h2 className="text-sm font-semibold text-slate-400 uppercase mb-4 tracking-wider">Recent Jobs</h2>
                    <div className="space-y-3">
                        {jobs.map(job => (
                            <div 
                                key={job.id} 
                                onClick={() => setSelectedJob(job)}
                                className={`p-4 rounded-xl border cursor-pointer transition-all min-h-[44px] ${selectedJob?.id === job.id ? 'border-brand bg-brand/10' : 'bg-slate-800/30 border-slate-800 hover:bg-slate-800 active:bg-slate-700'}`}
                                style={selectedJob?.id === job.id ? { borderColor: brandColor, backgroundColor: `${brandColor}15` } : {}}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <div className="font-medium text-white">{job.customer}</div>
                                    <div className="text-xs text-slate-500">{job.date}</div>
                                </div>
                                <div className="text-sm text-slate-400 mb-2">{job.vehicle}</div>
                                <div className="flex justify-between items-center">
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${job.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                        {job.status}
                                    </span>
                                    <span className="font-mono text-white font-medium">LKR {job.total.toLocaleString()}</span>
                                </div>
                            </div>
                        ))}
                         {jobs.length === 0 && (
                             <div className="text-center py-10 text-slate-500">
                                 {loading ? 'Loading...' : 'No completed jobs found.'}
                             </div>
                         )}
                    </div>
                </div>

                {/* Preview - Hidden on mobile when no job selected */}
                <div className={`w-full md:flex-1 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center p-4 md:p-8 relative overflow-y-auto ${!selectedJob ? 'hidden md:flex' : 'flex'}`}>
                    {selectedJob ? (
                        <div className="flex flex-col xl:flex-row items-center xl:items-start gap-6 max-w-full animate-fade-in">
                            <div className="bg-white text-slate-900 w-full md:w-[600px] aspect-[1/1.41] shadow-2xl p-6 md:p-12 flex flex-col relative text-left">
                                {/* Mobile Back Button */}
                                <button 
                                    onClick={() => setSelectedJob(null)}
                                    className="md:hidden flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4 -ml-2 p-2 rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                    <span className="text-sm font-medium">Back to Jobs</span>
                                </button>
                                
                                {/* Paper UI */}
                                <div className="flex justify-between items-start mb-8">
                                    <div className="flex items-center gap-4 max-w-[70%]">
                                        {profile?.tenants?.logo_url ? (
                                            <img src={profile.tenants.logo_url} alt="Logo" className="h-12 w-auto object-contain flex-shrink-0" />
                                        ) : (
                                            <div className="w-12 h-12 rounded flex items-center justify-center text-white font-black text-2xl flex-shrink-0" style={{ backgroundColor: brandColor }}>{profile?.tenants?.name?.charAt(0) || 'A'}</div>
                                        )}
                                        <div className="min-w-0">
                                            <h1 className="text-xl font-black text-slate-900 tracking-tight leading-tight uppercase break-words">
                                                {profile?.tenants?.name || 'AUTOPULSE'}
                                            </h1>
                                            <div className="mt-2 space-y-0.5">
                                                {profile?.tenants?.address && (
                                                    <p className="text-[10px] text-slate-500 leading-tight uppercase font-medium line-clamp-2">
                                                        {profile.tenants.address}
                                                    </p>
                                                )}
                                                {profile?.tenants?.phone && (
                                                    <p className="text-[10px] text-slate-400 font-mono">
                                                        TEL: {profile.tenants.phone}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <h2 className="text-3xl font-light text-slate-200 tracking-tighter leading-none">INVOICE</h2>
                                        <p className="text-[10px] font-mono font-bold text-slate-400 mt-2">NO: {selectedJob.id.slice(0, 8).toUpperCase()}</p>
                                        <p className="text-[10px] text-slate-400 mt-1">{selectedJob.date}</p>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-8 mb-10 pb-8 border-b border-slate-100">
                                    <div>
                                        <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black mb-2 opacity-50">Customer Details</p>
                                        <p className="font-bold text-base text-slate-900 leading-tight">{selectedJob.customer}</p>
                                        <p className="text-xs text-slate-500 mt-1">{selectedJob.vehicle}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black mb-2 opacity-50">Payment Info</p>
                                        <p className="text-[10px] text-emerald-500 font-bold uppercase py-1 px-2 bg-emerald-50 rounded-md inline-block">
                                            Status: {selectedJob.status}
                                        </p>
                                    </div>
                                </div>
                                
                                {/* Desktop Table View */}
                                <div className="flex-1">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b-2 border-slate-900">
                                                <th className="py-3 text-left font-black uppercase text-[9px] tracking-widest">Description</th>
                                                <th className="py-3 text-right font-black uppercase text-[9px] tracking-widest">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            <tr>
                                                <td className="py-6">
                                                    <div className="font-bold text-slate-800">Vehicle Maintenance Services</div>
                                                    <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wide">Professional Labor & Genuine Parts</div>
                                                </td>
                                                <td className="py-6 text-right font-mono font-bold text-slate-900">
                                                    {selectedJob.total.toLocaleString()}.00
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                
                                <div className="mt-8 pt-6 border-t-2 border-slate-100">
                                    <div className="flex justify-between items-center mb-1 text-slate-400 text-xs">
                                        <span className="font-bold uppercase tracking-widest">Subtotal</span>
                                        <span className="font-mono">{selectedJob.total.toLocaleString()}.00</span>
                                    </div>
                                    <div className="flex justify-between items-center mb-4 text-slate-400 text-xs">
                                        <span className="font-bold uppercase tracking-widest">Tax (VAT 0%)</span>
                                        <span className="font-mono">0.00</span>
                                    </div>
                                    <div className="flex justify-between items-center text-2xl font-black text-slate-900 border-t-2 border-slate-900 pt-4">
                                        <span className="tracking-tighter">TOTAL DUE</span>
                                        <span className="font-mono" style={{ color: brandColor }}>LKR {selectedJob.total.toLocaleString()}</span>
                                    </div>
                                </div>

                                <div className="mt-10 pt-6 border-t border-slate-50">
                                    <p className="text-[8px] text-slate-400 font-bold uppercase mb-2 tracking-widest">Terms & Conditions</p>
                                    <p className="text-[8px] text-slate-400 leading-relaxed italic line-clamp-3">
                                        {profile?.tenants?.terms_and_conditions || '1. All repairs carry professional warranty. 2. Parts warranty as per manufacturer. 3. Vehicle is left at owners risk.'}
                                    </p>
                                </div>

                                <div className="mt-6 text-[8px] text-slate-300 text-center uppercase tracking-[0.4em] font-bold">
                                    Thank you for choosing {profile?.tenants?.name || 'AutoPulse'}
                                </div>
                            </div>

                            {/* Action Buttons - Now flexible in layout */}
                            <div className="flex flex-row xl:flex-col gap-4 w-full xl:w-64">
                                <button 
                                    onClick={() => generatePDF(selectedJob)}
                                    className="group flex-1 xl:flex-none flex items-center gap-4 p-4 bg-slate-800 border border-slate-700 text-white rounded-2xl shadow-xl transition-all duration-300 active:scale-95 hover-brand" 
                                >
                                    <div className="w-12 h-12 bg-white/10 group-hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors">
                                        <Download size={24} />
                                    </div>
                                    <div className="text-left">
                                        <div className="text-xs font-black uppercase tracking-widest opacity-60">Download</div>
                                        <div className="text-sm font-bold">PDF Document</div>
                                    </div>
                                </button>
                                
                                <button 
                                    onClick={() => window.print()}
                                    className="group flex-1 xl:flex-none flex items-center gap-4 p-4 bg-slate-800 border border-slate-700 text-white rounded-2xl shadow-xl hover:bg-slate-700 hover:border-slate-500 transition-all duration-300 active:scale-95" 
                                >
                                    <div className="w-12 h-12 bg-white/10 group-hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors">
                                        <Printer size={24} />
                                    </div>
                                    <div className="text-left">
                                        <div className="text-xs font-black uppercase tracking-widest opacity-60">Print</div>
                                        <div className="text-sm font-bold">Paper Copy</div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-slate-500">
                            <FileText size={48} className="mx-auto mb-4 opacity-50" />
                            <p>Select a job to view invoice preview</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
