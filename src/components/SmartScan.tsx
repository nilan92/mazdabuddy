import { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { createWorker } from 'tesseract.js';
import { Camera, RefreshCw, Check, Loader2, RotateCcw, Plus, AlertTriangle, Edit2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';

// Enhance image for better OCR: grayscale + contrast boost
function preprocessImage(imageSrc: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        // Contrast stretch
        const contrast = 1.8;
        const enhanced = Math.max(0, Math.min(255, contrast * (gray - 128) + 128));
        d[i] = d[i + 1] = d[i + 2] = enhanced;
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = imageSrc;
  });
}

// Extract the most plate-like string from raw OCR output
function extractPlate(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9]/g, ' ').trim().toUpperCase();
  // Sri Lankan new format: XX-NNNN or XXX-NNNN
  const newFmt = cleaned.match(/\b([A-Z]{2,3})\s*(\d{3,4})\b/);
  if (newFmt) return `${newFmt[1]}-${newFmt[2]}`;
  // Old numeric format: NNN NNNN
  const oldFmt = cleaned.match(/\b(\d{2,3})\s*(\d{3,4})\b/);
  if (oldFmt) return `${oldFmt[1]}-${oldFmt[2]}`;
  // Fallback: first 10 chars of cleaned
  return cleaned.replace(/\s+/g, '').slice(0, 10);
}

export const SmartScan = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const webcamRef = useRef<Webcam>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [plate, setPlate] = useState('');
  const [editingPlate, setEditingPlate] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [dbVehicle, setDbVehicle] = useState<any>(null);
  const [dbChecked, setDbChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  const reset = () => {
    setImgSrc(null);
    setPlate('');
    setConfidence(0);
    setDbVehicle(null);
    setDbChecked(false);
    setError(null);
    setProgress(0);
    setEditingPlate(false);
  };

  const lookupPlate = async (plateText: string) => {
    if (!plateText || plateText.length < 3) return;
    const { data } = await supabase
      .from('vehicles')
      .select('id, make, model, license_plate, customers(name, phone)')
      .ilike('license_plate', `%${plateText.replace('-', '')}%`)
      .limit(1)
      .single();
    setDbVehicle(data || null);
    setDbChecked(true);
  };

  const analyze = async (image: string) => {
    setIsAnalyzing(true);
    setError(null);
    setProgress(0);
    setDbChecked(false);
    setDbVehicle(null);

    try {
      setProgressLabel('Enhancing image...');
      setProgress(10);
      const processed = await preprocessImage(image);

      setProgressLabel('Loading OCR engine...');
      setProgress(20);

      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(20 + Math.round(m.progress * 70));
            setProgressLabel('Reading plate...');
          }
        },
      });

      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
        // @ts-ignore – PSM.SINGLE_LINE = 7
        tessedit_pageseg_mode: '7',
      });

      setProgressLabel('Running OCR...');
      const { data: { text, confidence: conf } } = await worker.recognize(processed);
      await worker.terminate();

      setProgress(95);
      const detected = extractPlate(text);

      if (!detected || detected.length < 3) {
        setError("Couldn't read the plate. Try better lighting or hold the camera steadier.");
        return;
      }

      setPlate(detected);
      setConfidence(Math.round(conf));
      setProgress(100);
      setProgressLabel('Done');

      await lookupPlate(detected);
    } catch (err: any) {
      setError('Scan failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setImgSrc(imageSrc);
      analyze(imageSrc);
    }
  }, [webcamRef]);

  const handleCreateJob = () => {
    if (dbVehicle) {
      navigate('/jobs', { state: { vehicleId: dbVehicle.id, initialPlate: plate } });
    } else {
      navigate('/customers', { state: { initialPlate: plate } });
    }
  };

  const handlePlateEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditingPlate(false);
    await lookupPlate(plate);
  };

  return (
    <div className="p-2 h-[calc(100vh-100px)] flex flex-col items-center justify-center">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* Camera */}
        <div className="bg-black rounded-3xl overflow-hidden aspect-video relative border-4 border-slate-800 shadow-2xl">
          {!imgSrc ? (
            <>
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode, width: 1280, height: 720 }}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-72 h-44 border-2 border-brand/30 rounded-2xl relative">
                  <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-brand rounded-tl-xl" />
                  <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-brand rounded-tr-xl" />
                  <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-brand rounded-bl-xl" />
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-brand rounded-br-xl" />
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-brand text-[10px] font-black uppercase tracking-widest bg-slate-900/80 px-3 py-1 rounded-full border border-brand/30">
                    Align License Plate
                  </div>
                </div>
              </div>
              <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-6">
                <button onClick={() => setFacingMode(p => p === 'user' ? 'environment' : 'user')} className="p-3 bg-slate-900/80 text-white rounded-full border border-slate-700 backdrop-blur-md">
                  <RotateCcw size={24} />
                </button>
                <button onClick={capture} className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:scale-110 transition-all active:scale-90 group">
                  <div className="w-16 h-16 rounded-full border-4 border-slate-100 flex items-center justify-center">
                    <Camera size={32} className="text-slate-900" />
                  </div>
                </button>
                <div className="w-12 h-12" />
              </div>
            </>
          ) : (
            <div className="relative w-full h-full">
              <img src={imgSrc} alt="Captured" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <button onClick={reset} className="absolute top-6 right-6 p-4 bg-black/60 text-white rounded-full backdrop-blur-md border border-white/20">
                <RefreshCw size={24} />
              </button>
            </div>
          )}
        </div>

        {/* Result Panel */}
        <div className="flex flex-col justify-center">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-soft border border-brand/20 rounded-full mb-3">
              <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
              <span className="text-[10px] font-black text-brand uppercase tracking-widest">On-Device OCR</span>
            </div>
            <h1 className="text-5xl font-black text-white mb-2 leading-none">Smart<span className="text-brand">Scan</span></h1>
            <p className="text-slate-400 font-medium">Instant plate recognition — no internet required.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3 text-rose-400">
              <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {!imgSrc ? (
            <div className="p-12 border-2 border-dashed border-slate-800 rounded-3xl text-center text-slate-500 bg-slate-900/20 cursor-pointer hover:border-brand/30 transition-colors group" onClick={capture}>
              <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <Camera size={32} className="opacity-50 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-lg font-bold text-slate-400 mb-1">Waiting for Camera</p>
              <p className="text-sm opacity-60">Align the license plate within the frame</p>
            </div>

          ) : isAnalyzing ? (
            <div className="flex flex-col items-center justify-center p-12 bg-slate-900 border border-slate-800 rounded-3xl relative overflow-hidden">
              <Loader2 size={48} className="text-brand animate-spin mb-4" />
              <p className="text-brand font-mono font-black text-lg uppercase tracking-tighter animate-pulse mb-4">{progressLabel}</p>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="h-full bg-brand rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-slate-500 text-xs mt-2">{progress}%</p>
            </div>

          ) : plate ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl animate-fade-in">
              {/* Plate Display */}
              <div className="mb-6">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Detected Plate</label>
                {editingPlate ? (
                  <form onSubmit={handlePlateEdit} className="flex gap-2">
                    <input
                      autoFocus
                      value={plate}
                      onChange={e => setPlate(e.target.value.toUpperCase())}
                      className="flex-1 text-2xl font-black bg-slate-800 border border-brand rounded-xl px-4 py-2 text-white font-mono tracking-widest focus:outline-none uppercase"
                    />
                    <button type="submit" className="btn-brand px-4 rounded-xl font-bold">OK</button>
                  </form>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 text-4xl font-black text-white tracking-widest bg-black/40 px-5 py-3 rounded-2xl border border-white/10 font-mono">
                      {plate}
                    </div>
                    <button onClick={() => setEditingPlate(true)} className="p-2 text-slate-500 hover:text-brand transition-colors" title="Edit plate">
                      <Edit2 size={18} />
                    </button>
                  </div>
                )}
                <div className="flex gap-4 mt-2">
                  <span className="text-xs text-slate-500">Confidence: <span className={confidence > 70 ? 'text-emerald-400' : 'text-amber-400'}>{confidence}%</span></span>
                </div>
              </div>

              {/* DB Match */}
              {dbChecked && (
                <div className={`p-4 rounded-xl border mb-6 ${dbVehicle ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
                  {dbVehicle ? (
                    <div className="flex items-start gap-3">
                      <Check size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-emerald-400 text-xs font-black uppercase tracking-wider mb-1">Vehicle Found</p>
                        <p className="text-white font-bold">{dbVehicle.make} {dbVehicle.model}</p>
                        <p className="text-slate-400 text-sm">{(dbVehicle.customers as any)?.name} · {(dbVehicle.customers as any)?.phone}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-amber-400 text-xs font-black uppercase tracking-wider mb-1">Not in Database</p>
                        <p className="text-slate-300 text-sm">This plate isn't registered yet. You'll be taken to Customers to add it.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button onClick={handleCreateJob} className="w-full btn-brand font-black py-4 rounded-2xl flex items-center justify-center gap-3 uppercase tracking-widest shadow-lg">
                <Plus size={22} />
                {dbVehicle ? 'Create Job Card' : 'Register & Create Job'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
