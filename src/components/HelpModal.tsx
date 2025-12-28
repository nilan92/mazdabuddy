import { Modal } from './Modal';
import { 
  LayoutDashboard, 
  Scan, 
  Wrench, 
  Users, 
  Package, 
  FileText, 
  PieChart, 
  Settings,
  HelpCircle
} from 'lucide-react';

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const HelpModal = ({ isOpen, onClose }: HelpModalProps) => {
    const workflow = [
        { step: "1", title: "Smart Scan", desc: "Scan plate to create customer & job instantly." },
        { step: "2", title: "Assign & Repair", desc: "Drag job to 'In Progress' & add notes." },
        { step: "3", title: "Parts & Labor", desc: "Add items used to track costs & billing." },
        { step: "4", title: "Complete & Invoice", desc: "Move to 'Done' & generate professional PDF." }
    ];

    const sections = [
        {
            title: "Dashboard",
            icon: LayoutDashboard,
            desc: "See how your shop is doing. Check total money made and active jobs in one view.",
            color: "text-cyan-400"
        },
        {
            title: "Smart Scan",
            icon: Scan,
            desc: "Take a photo of a car plate. It automatically tells you car make and model.",
            color: "text-purple-400"
        },
        {
            title: "Job Board",
            icon: Wrench,
            desc: "Manage work here. Drag jobs to 'In Progress' or 'Done'. Add parts and labor easily.",
            color: "text-emerald-400"
        },
        {
            title: "Customers",
            icon: Users,
            desc: "List of all your clients. Search for any customer or car to see past work.",
            color: "text-blue-400"
        },
        {
            title: "Inventory",
            icon: Package,
            desc: "Keep track of parts. See what you have and get alerts when stock is low.",
            color: "text-amber-400"
        },
        {
            title: "Invoices",
            icon: FileText,
            desc: "Make bills for finished jobs. Print or download them as PDF for customers.",
            color: "text-rose-400"
        },
        {
            title: "Finances",
            icon: PieChart,
            desc: "Check workshop profitability. Auto-calculates revenue vs material & labor costs.",
            color: "text-indigo-400"
        },
        {
            title: "Settings",
            icon: Settings,
            desc: "Change shop name, upload logo, and invite your team members.",
            color: "text-slate-400"
        }
    ];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="AutoPulse System Guide">
            <div className="space-y-8 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">
                
                {/* Workflow Section */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-white font-black text-xs uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <Wrench size={14} className="text-emerald-400" /> Optimal Workshop Workflow
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {workflow.map((w) => (
                            <div key={w.step} className="flex gap-3 items-start">
                                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-black shrink-0 border border-emerald-500/30">
                                    {w.step}
                                </div>
                                <div className="space-y-0.5">
                                    <div className="text-white text-xs font-bold">{w.title}</div>
                                    <div className="text-[10px] text-slate-500 leading-tight">{w.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-slate-500 font-bold text-[10px] uppercase tracking-widest ml-1">Feature Directory</h3>
                    <div className="grid grid-cols-1 gap-4">
                        {sections.map((section) => (
                            <div key={section.title} className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl flex gap-4 items-start hover:border-slate-700 transition-colors">
                                <div className={`p-2 rounded-xl bg-slate-800 ${section.color}`}>
                                    <section.icon size={20} />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold mb-1 font-mono uppercase tracking-tight text-sm">{section.title}</h4>
                                    <p className="text-xs text-slate-400 leading-relaxed font-medium">{section.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl">
                    <h4 className="text-cyan-400 font-bold mb-2 flex items-center gap-2">
                        <HelpCircle size={16} /> Quick Tip
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                        Use <strong>Smart Scan</strong> as soon as a car arrives. It fills in details for you and saves a lot of time!
                    </p>
                </div>
            </div>
            
            <button 
                onClick={onClose}
                className="w-full mt-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-cyan-500/20 active:scale-95"
            >
                Got it, let's work!
            </button>
        </Modal>
    );
};
