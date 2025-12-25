import { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCw, Check, Loader2, RotateCcw, Plus, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { analyzeVehicleImage } from '../lib/ai';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const SmartScan = () => {
    const navigate = useNavigate();
    const webcamRef = useRef<Webcam>(null);
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<any>(null);
    const { profile } = useAuth();
    const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchApiKey = async () => {
            if (!profile?.tenant_id) return;
            const { data } = await supabase
                .from('tenants')
                .select('ai_api_key')
                .eq('id', profile.tenant_id)
                .single();
            if (data) setApiKey(data.ai_api_key);
        };
        fetchApiKey();
    }, [profile?.tenant_id]);

    const toggleCamera = () => {
        setFacingMode(prev => prev === "user" ? "environment" : "user");
    };

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            setImgSrc(imageSrc);
            analyze(imageSrc);
        }
    }, [webcamRef, apiKey]);

    const analyze = async (image: string) => {
        if (!apiKey) {
            setError("AI API Key not configured. Please add it in Settings.");
            return;
        }
        setIsAnalyzing(true);
        setError(null);
        try {
            const data = await analyzeVehicleImage(apiKey, image);
            setResult(data);
        } catch (err: any) {
            console.error(err);
            setError("Failed to analyze image. Please try again or check your API key.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const reset = () => {
        setImgSrc(null);
        setResult(null);
        setError(null);
    };

    const videoConstraints = {
        facingMode: facingMode,
        width: 1280,
        height: 720
    };

    const handleCreateJob = async () => {
        // Find existing vehicle or prompt to create?
        // For simplicity, let's just navigate to Jobs with parameters
        // Ideally we'd search Supabase for this plate first
        if (result?.licensePlate && result.licensePlate !== 'Unknown') {
            const { data: vehicle } = await supabase
                .from('vehicles')
                .select('id')
                .eq('license_plate', result.licensePlate)
                .single();
            
            if (vehicle) {
                // If vehicle exists, go to jobs and maybe open new job modal?
                // For now, simpler: pass as state
                navigate('/jobs', { state: { vehicleId: vehicle.id, initialPlate: result.licensePlate } });
            } else {
                // Should probably go to Customers to add this vehicle first
                alert("Vehicle not found in database. Create the customer and vehicle first.");
                navigate('/customers', { state: { initialPlate: result.licensePlate, make: result.make, model: result.model } });
            }
        }
    };

    return (
        <div className="p-2 h-[calc(100vh-100px)] flex flex-col items-center justify-center">
            
            <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Camera / Image Section */}
                <div className="bg-black rounded-3xl overflow-hidden aspect-video relative border-4 border-slate-800 shadow-2xl">
                    {!imgSrc ? (
                        <>
                            <Webcam
                                audio={false}
                                ref={webcamRef}
                                screenshotFormat="image/jpeg"
                                videoConstraints={videoConstraints}
                                className="w-full h-full object-cover"
                            />
                            
                            {/* Camera Overlay */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-72 h-44 border-2 border-brand/30 rounded-2xl relative">
                                    <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-brand rounded-tl-xl shadow-[0_0_15px_var(--brand-soft)]"></div>
                                    <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-brand rounded-tr-xl shadow-[0_0_15px_var(--brand-soft)]"></div>
                                    <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-brand rounded-bl-xl shadow-[0_0_15_var(--brand-soft)]"></div>
                                    <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-brand rounded-br-xl shadow-[0_0_15px_var(--brand-soft)]"></div>
                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-brand text-[10px] font-black uppercase tracking-widest bg-slate-900/80 px-3 py-1 rounded-full border border-brand/30 backdrop-blur-sm">Scan License Plate</div>
                                </div>
                            </div>

                            <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-6">
                                <button 
                                    onClick={toggleCamera}
                                    className="p-3 bg-slate-900/80 text-white rounded-full hover:bg-slate-800 transition-all border border-slate-700 backdrop-blur-md"
                                    title="Switch Camera"
                                >
                                    <RotateCcw size={24} />
                                </button>
                                
                                <button 
                                    onClick={capture}
                                    className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:scale-110 transition-all active:scale-90 group"
                                >
                                    <div className="w-16 h-16 rounded-full border-4 border-slate-100 flex items-center justify-center group-hover:bg-slate-50 transition-colors">
                                        <Camera size={32} className="text-slate-900" />
                                    </div>
                                </button>
                                
                                <div className="w-12 h-12" /> {/* Spacer to center the shutter */}
                            </div>
                        </>
                    ) : (
                        <div className="relative w-full h-full group">
                            <img src={imgSrc} alt="Captured" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                            <button 
                                onClick={reset}
                                className="absolute top-6 right-6 p-4 bg-black/60 text-white rounded-full hover:bg-black/80 transition-all backdrop-blur-md border border-white/20 shadow-xl"
                            >
                                <RefreshCw size={24} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Analysis Result Section */}
                <div className="flex flex-col justify-center">
                    <div className="mb-8 text-left">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-soft border border-brand/20 rounded-full mb-3">
                            <span className="w-2 h-2 rounded-full bg-brand animate-pulse"></span>
                            <span className="text-[10px] font-black text-brand uppercase tracking-widest">Active Intelligence</span>
                        </div>
                        <h1 className="text-5xl font-black text-white mb-2 leading-none">Smart<span className="text-brand">Scan</span></h1>
                        <p className="text-slate-400 font-medium">Automatic recognition and database lookup.</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3 text-rose-400">
                            <AlertTriangle size={20} className="flex-shrink-0" />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    {!imgSrc ? (
                         <div className="p-12 border-2 border-dashed border-slate-800 rounded-3xl text-center text-slate-500 bg-slate-900/20 backdrop-blur-sm group hover:border-cyan-500/30 transition-colors cursor-pointer" onClick={capture}>
                            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                                <Camera size={32} className="opacity-50 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <p className="text-lg font-bold text-slate-400 mb-1">Waiting for Camera</p>
                            <p className="text-sm opacity-60">Align the license plate within the frame</p>
                         </div>
                    ) : isAnalyzing ? (
                        <div className="flex flex-col items-center justify-center p-16 bg-slate-900 border border-slate-800 rounded-3xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-brand animate-[loading_2s_ease-in-out_infinite]"></div>
                            <Loader2 size={64} className="text-brand animate-spin mb-6" />
                            <p className="text-brand font-mono text-xl font-black animate-pulse tracking-tighter uppercase italic text-center">Analyzing Vehicle Data...</p>
                        </div>
                    ) : result ? (
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden animate-fade-in-up">
                            <div className="absolute top-0 right-0 p-8 opacity-5">
                                <Check size={120} className="text-emerald-500" />
                            </div>
                            
                            <div className="flex items-center gap-3 mb-8 pb-4 border-b border-white/5">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                                    <Check size={20} className="text-emerald-400" />
                                </div>
                                <div>
                                    <span className="text-emerald-400 text-xs font-black uppercase tracking-widest">Match Found</span>
                                    <div className="text-white font-bold leading-none">Vehicle Identified</div>
                                </div>
                            </div>

                            <div className="space-y-8">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-2">License Plate</label>
                                    <div className="text-4xl font-black text-white tracking-widest bg-black/40 px-5 py-3 rounded-2xl border border-white/10 shadow-inner group-hover:border-cyan-500/50">
                                        {result.licensePlate}
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-8">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-2">Model Identify</label>
                                        <div className="text-xl text-white font-bold tracking-tight">{result.make} {result.model}</div>
                                        <div className="text-xs text-slate-500 font-medium">Color: {result.color}</div>
                                    </div>
                                    <div className="text-right">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-2">Confidence</label>
                                        <div className="text-xl text-emerald-400 font-black tracking-tight italic">{(result.confidence || 0.99 * 100).toFixed(0)}%</div>
                                    </div>
                                </div>

                                <button 
                                    onClick={handleCreateJob}
                                    className="w-full btn-brand font-black py-5 rounded-2xl transition-all shadow-lg hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-3 uppercase tracking-widest shadow-brand-soft"
                                >
                                    <Plus size={24} /> Create Job Card
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};
