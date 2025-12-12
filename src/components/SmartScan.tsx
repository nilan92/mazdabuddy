import { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCw, Check, Loader2 } from 'lucide-react';

export const SmartScan = () => {
    const webcamRef = useRef<Webcam>(null);
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<any>(null);

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            setImgSrc(imageSrc);
            analyzeImage(imageSrc);
        }
    }, [webcamRef]);

    const analyzeImage = (_imageSrc: string) => {
        setIsAnalyzing(true);
        // Simulate AI Latency
        setTimeout(() => {
            // Mock AI Result
            const mockResult = {
                licensePlate: 'WP CAB-1234',
                make: 'Mazda',
                model: 'Axela',
                color: 'Soul Red',
                confidence: 0.98
            };
            setResult(mockResult);
            setIsAnalyzing(false);
        }, 2000);
    };

    const reset = () => {
        setImgSrc(null);
        setResult(null);
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
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-64 h-40 border-2 border-cyan-500/50 rounded-lg relative">
                                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400"></div>
                                    <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400"></div>
                                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400"></div>
                                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400"></div>
                                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-cyan-400 text-xs font-mono bg-black/50 px-2 rounded">ALIGN PLATE</div>
                                </div>
                            </div>
                            <button 
                                onClick={capture}
                                className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform active:scale-95 group"
                            >
                                <div className="w-14 h-14 rounded-full border-2 border-black group-hover:bg-slate-100"></div>
                            </button>
                        </>
                    ) : (
                        <div className="relative w-full h-full">
                            <img src={imgSrc} alt="Captured" className="w-full h-full object-cover opacity-80" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                            <button 
                                onClick={reset}
                                className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                            >
                                <RefreshCw size={20} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Analysis Result Section */}
                <div className="flex flex-col justify-center">
                    <div className="mb-6">
                        <h1 className="text-4xl font-bold text-white mb-2">Smart Scan</h1>
                        <p className="text-slate-400">AI-Powered Vehicle Recognition</p>
                    </div>

                    {!imgSrc ? (
                         <div className="p-8 border border-dashed border-slate-700 rounded-2xl text-center text-slate-500 bg-slate-900/30">
                            <Camera size={48} className="mx-auto mb-4 opacity-50" />
                            <p>Capture a vehicle image to start analysis.</p>
                         </div>
                    ) : isAnalyzing ? (
                        <div className="flex flex-col items-center justify-center p-12 bg-slate-900/50 rounded-2xl border border-slate-800">
                            <Loader2 size={48} className="text-cyan-400 animate-spin mb-4" />
                            <p className="text-cyan-400 font-mono animate-pulse">ANALYZING VEHICLE...</p>
                        </div>
                    ) : result ? (
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-cyan-900/10">
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                    <Check size={16} className="text-emerald-400" />
                                </div>
                                <span className="text-emerald-400 font-medium">Analysis Complete</span>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">License Plate</label>
                                    <div className="text-3xl font-mono font-bold text-white tracking-wide bg-black/30 p-2 rounded border border-slate-700/50 inline-block">
                                        {result.licensePlate}
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Make</label>
                                        <div className="text-xl text-white font-medium">{result.make}</div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Model</label>
                                        <div className="text-xl text-white font-medium">{result.model}</div>
                                    </div>
                                </div>

                                <button className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-medium py-3 rounded-xl transition-colors shadow-lg shadow-cyan-500/20">
                                    Create Job Card
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};
