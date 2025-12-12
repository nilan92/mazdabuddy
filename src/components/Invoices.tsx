import { useState, useEffect } from 'react';
import { Printer, Download, FileText, RefreshCcw } from 'lucide-react';
import jsPDF from 'jspdf';
import { supabase } from '../lib/supabase';

export const Invoices = () => {
    const [jobs, setJobs] = useState<any[]>([]);
    const [selectedJob, setSelectedJob] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchCompletedJobs = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('job_cards')
            .select('*, vehicles(license_plate, make, model, customers(name))')
            .eq('status', 'completed')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error fetching jobs:', error);
        } else {
            // Transform data to match UI expectations
            const formatted = data?.map(job => ({
                id: job.id,
                customer: job.vehicles?.customers?.name || 'Unknown',
                vehicle: `${job.vehicles?.make} ${job.vehicles?.model} (${job.vehicles?.license_plate})`,
                total: job.estimated_cost_lkr || 0,
                status: 'Completed',
                date: new Date(job.created_at).toLocaleDateString()
            }));
            setJobs(formatted || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchCompletedJobs();
    }, []);

    const generatePDF = (job: any) => {
        const doc = new jsPDF();
        
        // Header
        doc.setFontSize(22);
        doc.setTextColor(0, 150, 255); // Cyan-like
        doc.text('MAZDABUDDY', 20, 20);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text('123 Auto Repair Drive, Colombo 05', 20, 26);
        doc.text('Phone: 077 123 4567', 20, 31);
        
        // Invoice Details
        doc.setFontSize(16);
        doc.setTextColor(0);
        doc.text('INVOICE', 140, 20);
        
        doc.setFontSize(10);
        doc.text(`Invoice #: INV-${job.id.slice(0, 8)}`, 140, 30);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 140, 35);
        
        // Customer Info
        doc.line(20, 45, 190, 45); // Horizontal line
        doc.text('BILL TO:', 20, 55);
        doc.setFontSize(12);
        doc.text(job.customer, 20, 62);
        doc.setFontSize(10);
        doc.text(job.vehicle, 20, 68);
        
        // Items Table Header
        doc.setFillColor(240, 240, 240);
        doc.rect(20, 80, 170, 10, 'F');
        doc.text('DESCRIPTION', 25, 86);
        doc.text('AMOUNT (LKR)', 160, 86);
        
        // Items (Mock)
        let y = 100;
        doc.text('Repair Services & Parts', 25, y);
        doc.text(job.total.toLocaleString() + '.00', 160, y);
        
        // Totals
        y += 20;
        doc.line(20, y, 190, y);
        y += 10;
        doc.text('Subtotal:', 130, y);
        doc.text(job.total.toLocaleString() + '.00', 160, y);
        y += 6;
        doc.text('Tax (0%):', 130, y);
        doc.text('0.00', 160, y);
        y += 8;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('TOTAL:', 130, y);
        doc.text('LKR ' + job.total.toLocaleString() + '.00', 160, y);
        
        // Footer
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150);
        doc.text('Thank you for your business!', 20, 270);
        
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
                    onClick={fetchCompletedJobs}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors mr-2 mb-6"
                    title="Refresh"
                >
                    <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>
            
            <div className="flex gap-6 h-full">
                {/* List */}
                <div className="w-1/3 bg-slate-900/50 border border-slate-800 rounded-2xl p-4 overflow-y-auto">
                    <h2 className="text-sm font-semibold text-slate-400 uppercase mb-4 tracking-wider">Recent Jobs</h2>
                    <div className="space-y-3">
                        {jobs.map(job => (
                            <div 
                                key={job.id} 
                                onClick={() => setSelectedJob(job)}
                                className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedJob?.id === job.id ? 'bg-cyan-900/20 border-cyan-500/50' : 'bg-slate-800/30 border-slate-800 hover:bg-slate-800'}`}
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

                {/* Preview */}
                <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center p-8 relative">
                    {selectedJob ? (
                        <div className="bg-white text-slate-900 aspect-[1/1.4] h-full shadow-2xl p-8 flex flex-col relative animate-fade-in">
                            {/* Paper UI */}
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h1 className="text-2xl font-bold text-cyan-600">MazdaBuddy</h1>
                                    <p className="text-xs text-slate-500">123 Auto Repair Drive, Colombo</p>
                                </div>
                                <div className="text-right">
                                    <h2 className="text-3xl font-light text-slate-300">INVOICE</h2>
                                    <p className="text-sm font-medium">#{selectedJob.id.slice(0, 8)}</p>
                                </div>
                            </div>
                            
                            <div className="mb-8 p-4 bg-slate-50 rounded-lg">
                                <p className="text-xs text-slate-400 uppercase">Bill To</p>
                                <p className="font-bold text-lg">{selectedJob.customer}</p>
                                <p className="text-sm">{selectedJob.vehicle}</p>
                            </div>
                            
                            <div className="flex-1">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200">
                                            <th className="py-2 text-left">Description</th>
                                            <th className="py-2 text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-b border-slate-100">
                                            <td className="py-4">Full Service & Repair Charges</td>
                                            <td className="py-4 text-right">{selectedJob.total.toLocaleString()}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            
                            <div className="border-t-2 border-slate-100 pt-4">
                                <div className="flex justify-between items-center text-xl font-bold">
                                    <span>Total</span>
                                    <span>LKR {selectedJob.total.toLocaleString()}</span>
                                </div>
                            </div>
                            
                            {/* Valid actions */}
                            <div className="absolute -right-20 top-0 flex flex-col gap-2">
                                <button 
                                    onClick={() => generatePDF(selectedJob)}
                                    className="p-3 bg-cyan-600 text-white rounded-full shadow-lg hover:bg-cyan-500 transition-transform hover:scale-105" 
                                    title="Download PDF"
                                >
                                    <Download size={20} />
                                </button>
                                <button className="p-3 bg-slate-700 text-white rounded-full shadow-lg hover:bg-slate-600 transition-transform hover:scale-105" title="Print">
                                    <Printer size={20} />
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
