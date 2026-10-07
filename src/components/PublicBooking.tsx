import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Calendar as CalendarIcon, 
    Car, 
    User, 
    Phone, 
    CheckCircle2, 
    AlertCircle, 
    ChevronRight, 
    ChevronLeft, 
    Building2, 
    Share2, 
    CalendarPlus, 
    MapPin,
    ArrowRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { 
    SERVICE_TYPES, 
    generateTimeSlots, 
    buildBookingWhatsAppUrl, 
    downloadCalendarEvent,
} from '../lib/bookings';

interface PublicTenant {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    logo_url?: string;
    brand_color?: string;
    booking_enabled?: boolean;
    booking_slot_duration?: number;
    booking_start_time?: string;
    booking_end_time?: string;
    booking_max_concurrent?: number;
    booking_working_days?: string[];
}

export const PublicBooking: React.FC = () => {
    const { tenantId: routeTenantId } = useParams<{ tenantId?: string }>();
    const navigate = useNavigate();

    // Workshop State
    const [selectedTenantId, setSelectedTenantId] = useState<string>(routeTenantId || '');
    const [availableTenants, setAvailableTenants] = useState<PublicTenant[]>([]);
    const [tenantInfo, setTenantInfo] = useState<PublicTenant | null>(null);
    const [loadingTenant, setLoadingTenant] = useState<boolean>(true);

    // Booking Form Wizard Steps: 1: Service, 2: Date & Time, 3: Vehicle & Contact, 4: Confirmed
    const [step, setStep] = useState<number>(1);

    // Form Data State
    const [selectedService, setSelectedService] = useState<string>('routine_service');
    const [bookingDate, setBookingDate] = useState<string>(() => {
        // Default tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    });
    const [bookingTime, setBookingTime] = useState<string>('');
    const [slotCounts, setSlotCounts] = useState<Record<string, number>>({});
    const [loadingSlots, setLoadingSlots] = useState<boolean>(false);

    // Vehicle details
    const [vehiclePlate, setVehiclePlate] = useState<string>('');
    const [vehicleMake, setVehicleMake] = useState<string>('Mazda');
    const [vehicleModel, setVehicleModel] = useState<string>('');
    const [vehicleYear, setVehicleYear] = useState<string>('');
    const [mileage, setMileage] = useState<string>('');

    // Customer details
    const [customerTitle, setCustomerTitle] = useState<string>('Mr.');
    const [customerName, setCustomerName] = useState<string>('');
    const [customerPhone, setCustomerPhone] = useState<string>('');
    const [customerEmail, setCustomerEmail] = useState<string>('');
    const [notes, setNotes] = useState<string>('');

    // Submission & Confirmation State
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [confirmedBooking, setConfirmedBooking] = useState<any>(null);

    // 1. Load tenant list or specific tenant info
    useEffect(() => {
        const initTenants = async () => {
            setLoadingTenant(true);
            try {
                if (routeTenantId) {
                    setSelectedTenantId(routeTenantId);
                    const { data, error } = await supabase.rpc('get_public_tenant_booking_info', {
                        p_tenant_id: routeTenantId
                    });
                    if (error) throw error;
                    if (data && data.length > 0) {
                        setTenantInfo(data[0]);
                    }
                } else {
                    // Fetch list of active booking tenants
                    const { data, error } = await supabase.rpc('list_public_booking_tenants');
                    if (error) throw error;
                    if (data && data.length > 0) {
                        setAvailableTenants(data);
                        // If only 1 tenant exists, auto-select it
                        if (data.length === 1) {
                            setSelectedTenantId(data[0].id);
                            const infoRes = await supabase.rpc('get_public_tenant_booking_info', {
                                p_tenant_id: data[0].id
                            });
                            if (infoRes.data && infoRes.data.length > 0) {
                                setTenantInfo(infoRes.data[0]);
                            }
                        }
                    }
                }
            } catch (err: any) {
                console.error('Error fetching tenant booking info:', err);
            } finally {
                setLoadingTenant(false);
            }
        };

        initTenants();
    }, [routeTenantId]);

    // When tenant changes in dropdown (if no route param)
    const handleSelectTenant = async (tId: string) => {
        setSelectedTenantId(tId);
        if (!tId) {
            setTenantInfo(null);
            return;
        }
        setLoadingTenant(true);
        try {
            const { data, error } = await supabase.rpc('get_public_tenant_booking_info', {
                p_tenant_id: tId
            });
            if (error) throw error;
            if (data && data.length > 0) {
                setTenantInfo(data[0]);
            }
        } catch (err) {
            console.error('Error loading selected workshop:', err);
        } finally {
            setLoadingTenant(false);
        }
    };

    // 2. Fetch slot counts whenever date or tenant changes
    useEffect(() => {
        if (!selectedTenantId || !bookingDate) return;

        const fetchSlotAvailability = async () => {
            setLoadingSlots(true);
            try {
                const { data, error } = await supabase.rpc('get_booking_slot_counts', {
                    p_tenant_id: selectedTenantId,
                    p_date: bookingDate
                });
                if (error) throw error;

                const countsMap: Record<string, number> = {};
                (data || []).forEach((row: any) => {
                    countsMap[row.booking_time] = Number(row.booked_count);
                });
                setSlotCounts(countsMap);
            } catch (err) {
                console.error('Error fetching slot counts:', err);
            } finally {
                setLoadingSlots(false);
            }
        };

        fetchSlotAvailability();
    }, [selectedTenantId, bookingDate]);

    // Generated available slots
    const slots = generateTimeSlots(
        tenantInfo?.booking_start_time || '08:30',
        tenantInfo?.booking_end_time || '17:30',
        tenantInfo?.booking_slot_duration || 60
    );

    const maxConcurrent = tenantInfo?.booking_max_concurrent || 2;

    // Minimum date: today
    const todayStr = new Date().toISOString().split('T')[0];

    // Handle Submission
    const handleSubmitBooking = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError(null);

        if (!selectedTenantId) {
            setSubmitError('Please select a workshop.');
            return;
        }
        if (!bookingDate) {
            setSubmitError('Please choose an appointment date.');
            return;
        }
        if (!bookingTime) {
            setSubmitError('Please select an available time slot.');
            return;
        }
        if (!vehiclePlate.trim()) {
            setSubmitError('Please enter your vehicle license plate number.');
            return;
        }
        if (!customerName.trim()) {
            setSubmitError('Please enter your name.');
            return;
        }
        if (!customerPhone.trim()) {
            setSubmitError('Please provide a contact phone number.');
            return;
        }

        setSubmitting(true);
        try {
            const newRecord = {
                tenant_id: selectedTenantId,
                customer_title: customerTitle,
                customer_name: customerName.trim(),
                customer_phone: customerPhone.trim(),
                customer_email: customerEmail.trim() || null,
                vehicle_plate: vehiclePlate.trim().toUpperCase(),
                vehicle_make: vehicleMake.trim() || null,
                vehicle_model: vehicleModel.trim() || null,
                vehicle_year: vehicleYear ? parseInt(vehicleYear) : null,
                mileage: mileage ? parseInt(mileage) : null,
                service_type: selectedService,
                booking_date: bookingDate,
                booking_time: bookingTime,
                estimated_duration_minutes: tenantInfo?.booking_slot_duration || 60,
                status: 'pending',
                notes: notes.trim() || null,
            };

            const { data, error } = await supabase
                .from('bookings')
                .insert([newRecord])
                .select('*')
                .single();

            if (error) throw error;

            setConfirmedBooking({
                ...data,
                workshop_name: tenantInfo?.name || 'Workshop',
                workshop_phone: tenantInfo?.phone,
                workshop_address: tenantInfo?.address,
            });
            setStep(4); // Move to Confirmation Screen
        } catch (err: any) {
            console.error('Error submitting booking:', err);
            setSubmitError(err.message || 'Unable to schedule booking. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loadingTenant && routeTenantId) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 animate-spin">
                    <CalendarIcon size={24} />
                </div>
                <p className="text-xs font-mono uppercase tracking-widest text-slate-400">Loading Workshop Portal…</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-cyan-500/30">
            {/* Header */}
            <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur sticky top-0 z-40">
                <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {tenantInfo?.logo_url ? (
                            <img
                                src={tenantInfo.logo_url}
                                alt={tenantInfo.name}
                                className="w-10 h-10 object-contain rounded-xl bg-slate-900 p-1 border border-slate-800"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-black">
                                <Car size={20} />
                            </div>
                        )}
                        <div>
                            <h1 className="text-sm font-black text-white uppercase tracking-tight">
                                {tenantInfo?.name || 'Online Workshop Booking'}
                            </h1>
                            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                                <CalendarIcon size={12} className="text-cyan-400" />
                                Schedule Routine Maintenance &amp; Repairs
                            </p>
                        </div>
                    </div>

                    {tenantInfo?.phone && (
                        <a
                            href={`tel:${tenantInfo.phone}`}
                            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                        >
                            <Phone size={13} className="text-cyan-400" />
                            <span>{tenantInfo.phone}</span>
                        </a>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-4xl mx-auto px-4 py-8 w-full flex-grow">
                {/* Workshop selector if not selected */}
                {!routeTenantId && availableTenants.length > 1 && !tenantInfo && (
                    <div className="mb-8 p-6 bg-slate-900/80 border border-slate-800 rounded-3xl text-center space-y-4">
                        <Building2 size={36} className="mx-auto text-cyan-400" />
                        <div>
                            <h2 className="text-lg font-bold text-white">Select Your Workshop</h2>
                            <p className="text-xs text-slate-400">Choose the service center you would like to book with</p>
                        </div>
                        <div className="max-w-md mx-auto">
                            <select
                                value={selectedTenantId}
                                onChange={e => handleSelectTenant(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm focus:border-cyan-500 outline-none"
                            >
                                <option value="">-- Choose Workshop --</option>
                                {availableTenants.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}

                {/* Wizard Progress Bar */}
                {step < 4 && (
                    <div className="mb-8">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-2">
                            <span className={step >= 1 ? 'text-cyan-400 font-black' : ''}>1. Select Service</span>
                            <span className={step >= 2 ? 'text-cyan-400 font-black' : ''}>2. Date &amp; Time</span>
                            <span className={step >= 3 ? 'text-cyan-400 font-black' : ''}>3. Vehicle &amp; Contact</span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                            <div
                                className="h-full bg-cyan-500 transition-all duration-300"
                                style={{ width: `${(step / 3) * 100}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* STEP 1: SELECT SERVICE */}
                {step === 1 && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-xl font-black text-white tracking-tight">Choose Service Package</h2>
                            <p className="text-xs text-slate-400 mt-1">
                                Select the primary service you require for your vehicle today.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {SERVICE_TYPES.map(svc => {
                                const isSelected = selectedService === svc.id;
                                return (
                                    <button
                                        type="button"
                                        key={svc.id}
                                        onClick={() => setSelectedService(svc.id)}
                                        className={`p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                                            isSelected
                                                ? 'bg-cyan-950/30 border-cyan-500/80 ring-1 ring-cyan-500/50 shadow-lg shadow-cyan-900/20'
                                                : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'
                                        }`}
                                    >
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${svc.badgeColor}`}>
                                                    ~{svc.estimatedMinutes} mins
                                                </span>
                                                {isSelected && (
                                                    <CheckCircle2 size={16} className="text-cyan-400 shrink-0" />
                                                )}
                                            </div>
                                            <h3 className="text-sm font-bold text-white mb-1.5">
                                                {svc.title}
                                            </h3>
                                            <p className="text-xs text-slate-400 leading-relaxed">
                                                {svc.description}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex justify-end pt-4">
                            <button
                                type="button"
                                onClick={() => setStep(2)}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm shadow-lg shadow-cyan-600/20 transition-all active:scale-95"
                            >
                                <span>Continue to Date &amp; Time</span>
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 2: DATE & TIME */}
                {step === 2 && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-black text-white tracking-tight">Pick Date &amp; Available Slot</h2>
                                <p className="text-xs text-slate-400 mt-1">
                                    Choose your preferred day and available arrival time slot.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-medium transition-colors"
                            >
                                <ChevronLeft size={14} /> Back
                            </button>
                        </div>

                        {/* Date Picker Input */}
                        <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-2">
                            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                                Appointment Date
                            </label>
                            <input
                                type="date"
                                min={todayStr}
                                value={bookingDate}
                                onChange={e => {
                                    setBookingDate(e.target.value);
                                    setBookingTime(''); // reset slot selection
                                }}
                                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm focus:border-cyan-500 outline-none"
                            />
                        </div>

                        {/* Slots Grid */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                    Available Arrival Slots ({slots.length})
                                </label>
                                {loadingSlots && (
                                    <span className="text-[11px] text-cyan-400 font-medium animate-pulse">
                                        Checking live slot capacity…
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                                {slots.map(slot => {
                                    const booked = slotCounts[slot] || 0;
                                    const isFull = booked >= maxConcurrent;
                                    const isSelected = bookingTime === slot;
                                    const remaining = maxConcurrent - booked;

                                    return (
                                        <button
                                            type="button"
                                            key={slot}
                                            disabled={isFull}
                                            onClick={() => setBookingTime(slot)}
                                            className={`p-3 rounded-xl border text-center transition-all ${
                                                isFull
                                                    ? 'bg-slate-900/30 border-slate-800/40 text-slate-600 cursor-not-allowed opacity-60'
                                                    : isSelected
                                                    ? 'bg-cyan-500 text-white border-cyan-400 font-bold shadow-md shadow-cyan-500/20'
                                                    : 'bg-slate-900/70 border-slate-800 text-slate-200 hover:border-slate-700 hover:bg-slate-850'
                                            }`}
                                        >
                                            <div className="text-sm font-mono font-bold">{slot}</div>
                                            <div className="text-[10px] mt-1 font-sans">
                                                {isFull ? (
                                                    <span className="text-rose-400 font-semibold">Fully Booked</span>
                                                ) : isSelected ? (
                                                    <span className="text-cyan-100 font-semibold">Selected</span>
                                                ) : remaining === 1 ? (
                                                    <span className="text-amber-400">1 Spot Left</span>
                                                ) : (
                                                    <span className="text-emerald-400 font-medium">Available</span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-slate-800/60">
                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="px-4 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white text-xs font-bold transition-colors"
                            >
                                Back to Services
                            </button>
                            <button
                                type="button"
                                disabled={!bookingTime}
                                onClick={() => setStep(3)}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm shadow-lg shadow-cyan-600/20 transition-all active:scale-95"
                            >
                                <span>Continue to Vehicle &amp; Contact</span>
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 3: VEHICLE & CONTACT DETAILS */}
                {step === 3 && (
                    <form onSubmit={handleSubmitBooking} className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-black text-white tracking-tight">Vehicle &amp; Customer Information</h2>
                                <p className="text-xs text-slate-400 mt-1">
                                    Please enter your vehicle specifications and contact details.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setStep(2)}
                                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-medium transition-colors"
                            >
                                <ChevronLeft size={14} /> Back
                            </button>
                        </div>

                        {/* Error Alert */}
                        {submitError && (
                            <div className="p-4 bg-red-950/40 border border-red-500/30 rounded-2xl flex items-start gap-3 text-red-200 text-xs">
                                <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                                <div>{submitError}</div>
                            </div>
                        )}

                        {/* Vehicle Section */}
                        <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-4">
                            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Car size={14} /> Vehicle Details
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                                        Vehicle Plate Number *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. WP CAA-1234 or 19-8902"
                                        value={vehiclePlate}
                                        onChange={e => setVehiclePlate(e.target.value.toUpperCase())}
                                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm font-mono tracking-wider focus:border-cyan-500 outline-none uppercase"
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                                        Vehicle Make
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Mazda, Toyota, Honda"
                                        value={vehicleMake}
                                        onChange={e => setVehicleMake(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm focus:border-cyan-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                                        Model Name
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Axela, CX-5, Civic, Prius"
                                        value={vehicleModel}
                                        onChange={e => setVehicleModel(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm focus:border-cyan-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                                        Manufacture Year (Optional)
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="e.g. 2018"
                                        value={vehicleYear}
                                        onChange={e => setVehicleYear(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm font-mono focus:border-cyan-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                                        Current Mileage (km)
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="e.g. 85000"
                                        value={mileage}
                                        onChange={e => setMileage(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm font-mono focus:border-cyan-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Customer Contact Section */}
                        <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-4">
                            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                                <User size={14} /> Customer Contact
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                                        Title
                                    </label>
                                    <select
                                        value={customerTitle}
                                        onChange={e => setCustomerTitle(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm focus:border-cyan-500 outline-none"
                                    >
                                        <option value="Mr.">Mr.</option>
                                        <option value="Mrs.">Mrs.</option>
                                        <option value="Ms.">Ms.</option>
                                        <option value="Dr.">Dr.</option>
                                        <option value="Rev.">Rev.</option>
                                        <option value="Company">Company / Fleet</option>
                                    </select>
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                                        Full Name / Company Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Nilan Perera"
                                        value={customerName}
                                        onChange={e => setCustomerName(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm focus:border-cyan-500 outline-none"
                                    />
                                </div>

                                <div className="sm:col-span-1">
                                    <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                                        Mobile Phone (WhatsApp) *
                                    </label>
                                    <input
                                        type="tel"
                                        required
                                        placeholder="e.g. 077 123 4567"
                                        value={customerPhone}
                                        onChange={e => setCustomerPhone(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm focus:border-cyan-500 outline-none"
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                                        Email Address (Optional)
                                    </label>
                                    <input
                                        type="email"
                                        placeholder="e.g. nilan@example.com"
                                        value={customerEmail}
                                        onChange={e => setCustomerEmail(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm focus:border-cyan-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                                    Special Notes / Symptoms (Optional)
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Any specific noise, vibration, warning lights, or instructions for the technicians..."
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-xs focus:border-cyan-500 outline-none leading-relaxed"
                                />
                            </div>
                        </div>

                        {/* Booking Summary Box */}
                        <div className="p-4 bg-cyan-950/20 border border-cyan-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                            <div>
                                <span className="text-[10px] uppercase font-bold text-cyan-400 block">Selected Slot Summary</span>
                                <div className="font-bold text-white mt-0.5">
                                    {new Date(bookingDate).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })} at {bookingTime}
                                </div>
                                <div className="text-slate-400 mt-0.5">
                                    {SERVICE_TYPES.find(s => s.id === selectedService)?.title}
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-8 py-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm shadow-xl shadow-cyan-600/30 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {submitting ? 'Confirming Appointment…' : 'Schedule My Booking'}
                            </button>
                        </div>
                    </form>
                )}

                {/* STEP 4: CONFIRMATION SCREEN */}
                {step === 4 && confirmedBooking && (
                    <div className="max-w-xl mx-auto space-y-6">
                        <div className="p-6 bg-slate-900 border border-emerald-500/30 rounded-3xl text-center space-y-3 relative overflow-hidden">
                            <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto mb-2">
                                <CheckCircle2 size={36} />
                            </div>
                            <h2 className="text-2xl font-black text-white tracking-tight">
                                Booking Confirmed!
                            </h2>
                            <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                                Thank you, <strong className="text-white">{confirmedBooking.customer_name}</strong>. Your appointment has been successfully received by <strong className="text-cyan-400">{confirmedBooking.workshop_name}</strong>.
                            </p>

                            {/* Booking Reference Card */}
                            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800/80 text-left space-y-3 mt-4">
                                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                                    <span className="text-[10px] uppercase font-bold text-slate-500">Booking Ref</span>
                                    <span className="text-xs font-mono font-bold text-cyan-400">
                                        #{confirmedBooking.id.substring(0, 8).toUpperCase()}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <span className="text-[10px] uppercase text-slate-500 block">Date &amp; Time</span>
                                        <span className="font-bold text-white">
                                            {new Date(confirmedBooking.booking_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </span>
                                        <div className="text-xs font-mono text-cyan-400">{confirmedBooking.booking_time}</div>
                                    </div>
                                    <div>
                                        <span className="text-[10px] uppercase text-slate-500 block">Vehicle</span>
                                        <span className="font-bold text-white font-mono">
                                            {confirmedBooking.vehicle_plate}
                                        </span>
                                        <div className="text-[11px] text-slate-400">
                                            {confirmedBooking.vehicle_make} {confirmedBooking.vehicle_model}
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-slate-800/80 pt-2 text-xs">
                                    <span className="text-[10px] uppercase text-slate-500 block">Service Requested</span>
                                    <span className="font-bold text-slate-200">
                                        {SERVICE_TYPES.find(s => s.id === confirmedBooking.service_type)?.title || confirmedBooking.service_type}
                                    </span>
                                </div>
                            </div>

                            {/* Quick Action Buttons */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                                <a
                                    href={buildBookingWhatsAppUrl(confirmedBooking)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
                                >
                                    <Share2 size={15} />
                                    <span>Open WhatsApp Update</span>
                                </a>

                                <button
                                    type="button"
                                    onClick={() => downloadCalendarEvent(confirmedBooking)}
                                    className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
                                >
                                    <CalendarPlus size={15} className="text-cyan-400" />
                                    <span>Add to Calendar (.ics)</span>
                                </button>
                            </div>

                            {/* Live Tracking Link */}
                            <div className="pt-3">
                                <button
                                    type="button"
                                    onClick={() => navigate(`/booking/${confirmedBooking.public_token}`)}
                                    className="w-full py-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-cyan-400 hover:text-cyan-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                                >
                                    <span>View Live Booking Tracker</span>
                                    <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Workshop Contact Details */}
                        {confirmedBooking.workshop_address && (
                            <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl flex items-start gap-3 text-xs text-slate-400">
                                <MapPin size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                                <div>
                                    <strong className="text-slate-200 block mb-0.5">{confirmedBooking.workshop_name}</strong>
                                    <span>{confirmedBooking.workshop_address}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-850 py-4 text-center text-[11px] text-slate-500">
                Powered by AutoPulse Automotive Service OS
            </footer>
        </div>
    );
};
