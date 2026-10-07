import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Calendar as CalendarIcon, 
    Clock, 
    Search, 
    Share2, 
    Copy, 
    Wrench, 
    X, 
    Check, 
    ChevronRight,
    MessageSquare,
    Eye
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { 
    SERVICE_TYPES, 
    BOOKING_STATUS_CONFIG, 
    generateTimeSlots, 
    buildBookingWhatsAppUrl,
    getPublicBookingUrl,
    getPublicBookingTrackingUrl,
} from '../lib/bookings';
import { type Booking, type BookingStatus } from '../types';

export const Bookings: React.FC = () => {
    const { profile } = useAuth();
    const { toast } = useToast();
    const confirm = useConfirm();
    const navigate = useNavigate();

    const tenantId = profile?.tenant_id;

    // Bookings Data State
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    // Filters State
    const [dateFilter, setDateFilter] = useState<'today' | 'tomorrow' | 'upcoming' | 'all'>('upcoming');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Modal States
    const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
    const [convertingId, setConvertingId] = useState<string | null>(null);

    // Manual Booking Form State
    const [manualPlate, setManualPlate] = useState<string>('');
    const [manualMake, setManualMake] = useState<string>('Mazda');
    const [manualModel, setManualModel] = useState<string>('');
    const [manualYear, setManualYear] = useState<string>('');
    const [manualMileage, setManualMileage] = useState<string>('');
    const [manualCustomerTitle, setManualCustomerTitle] = useState<string>('Mr.');
    const [manualCustomerName, setManualCustomerName] = useState<string>('');
    const [manualCustomerPhone, setManualCustomerPhone] = useState<string>('');
    const [manualServiceType, setManualServiceType] = useState<string>('routine_service');
    const [manualDate, setManualDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
    const [manualTime, setManualTime] = useState<string>('09:00 AM');
    const [manualNotes, setManualNotes] = useState<string>('');
    const [manualSubmitting, setManualSubmitting] = useState<boolean>(false);

    // Fetch Bookings
    const fetchBookings = async () => {
        if (!tenantId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('bookings')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('booking_date', { ascending: true })
                .order('booking_time', { ascending: true });

            if (error) throw error;
            setBookings(data || []);
        } catch (err: any) {
            console.error('Error fetching bookings:', err);
            toast('Failed to load bookings.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBookings();
    }, [tenantId]);

    // Filter Logic
    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrowObj = new Date();
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrowStr = tomorrowObj.toISOString().split('T')[0];

    const filteredBookings = bookings.filter(b => {
        // Date filter
        if (dateFilter === 'today' && b.booking_date !== todayStr) return false;
        if (dateFilter === 'tomorrow' && b.booking_date !== tomorrowStr) return false;
        if (dateFilter === 'upcoming' && b.booking_date < todayStr) return false;

        // Status filter
        if (statusFilter !== 'all' && b.status !== statusFilter) return false;

        // Search Query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            const plateMatch = b.vehicle_plate.toLowerCase().includes(q);
            const nameMatch = b.customer_name.toLowerCase().includes(q);
            const phoneMatch = b.customer_phone.includes(q);
            if (!plateMatch && !nameMatch && !phoneMatch) return false;
        }

        return true;
    });

    // Counts for stats
    const todayCount = bookings.filter(b => b.booking_date === todayStr && b.status !== 'cancelled').length;
    const pendingCount = bookings.filter(b => b.status === 'pending').length;
    const confirmedCount = bookings.filter(b => b.status === 'confirmed').length;
    const completedCount = bookings.filter(b => b.status === 'completed' || b.job_card_id).length;

    // Action: Confirm Booking
    const handleConfirmBooking = async (booking: Booking) => {
        try {
            const { error } = await supabase
                .from('bookings')
                .update({ status: 'confirmed' })
                .eq('id', booking.id);

            if (error) throw error;

            toast(`Booking for ${booking.vehicle_plate} confirmed.`, 'success');
            setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, status: 'confirmed' } : b));

            // Offer to send WhatsApp notification
            const waUrl = buildBookingWhatsAppUrl({
                customer_name: booking.customer_name,
                customer_phone: booking.customer_phone,
                vehicle_plate: booking.vehicle_plate,
                service_type: booking.service_type,
                booking_date: booking.booking_date,
                booking_time: booking.booking_time,
                public_token: booking.public_token,
                workshop_name: profile?.tenants?.name,
                workshop_phone: profile?.tenants?.phone,
            });

            window.open(waUrl, '_blank');
        } catch (err: any) {
            console.error('Error confirming booking:', err);
            toast('Failed to confirm booking.', 'error');
        }
    };

    // Action: Cancel Booking
    const handleCancelBooking = async (bookingId: string) => {
        const ok = await confirm({
            title: 'Cancel Booking',
            message: 'Are you sure you want to cancel this booking appointment?',
            confirmLabel: 'Yes, Cancel',
            cancelLabel: 'Keep Active',
            confirmStyle: 'danger',
        });
        if (!ok) return;

        try {
            const { error } = await supabase
                .from('bookings')
                .update({ status: 'cancelled' })
                .eq('id', bookingId);

            if (error) throw error;

            toast('Booking has been cancelled.', 'info');
            setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'cancelled' } : b));
        } catch (err: any) {
            console.error('Error cancelling booking:', err);
            toast('Failed to cancel booking.', 'error');
        }
    };

    // Action: Convert Booking to Job Card (1-Click Workflow)
    const handleConvertToJobCard = async (booking: Booking) => {
        if (!tenantId) return;
        setConvertingId(booking.id);

        try {
            // 1. Check or create Customer
            let customerId: string | null = null;
            const { data: existingCustomers, error: custSearchErr } = await supabase
                .from('customers')
                .select('id')
                .eq('tenant_id', tenantId)
                .or(`phone.eq.${booking.customer_phone},name.ilike.%${booking.customer_name}%`)
                .limit(1);

            if (custSearchErr) console.warn('Customer lookup error:', custSearchErr);

            if (existingCustomers && existingCustomers.length > 0) {
                customerId = existingCustomers[0].id;
            } else {
                // Insert new customer
                const { data: newCustomer, error: createCustErr } = await supabase
                    .from('customers')
                    .insert([{
                        tenant_id: tenantId,
                        title: booking.customer_title || 'Mr.',
                        name: booking.customer_name,
                        phone: booking.customer_phone,
                        email: booking.customer_email || null,
                    }])
                    .select('id')
                    .single();

                if (createCustErr) throw createCustErr;
                customerId = newCustomer.id;
            }

            // 2. Check or create Vehicle
            let vehicleId: string | null = null;
            const cleanPlate = booking.vehicle_plate.toUpperCase().trim();
            const { data: existingVehicles, error: vehSearchErr } = await supabase
                .from('vehicles')
                .select('id')
                .eq('tenant_id', tenantId)
                .ilike('license_plate', cleanPlate)
                .limit(1);

            if (vehSearchErr) console.warn('Vehicle lookup error:', vehSearchErr);

            if (existingVehicles && existingVehicles.length > 0) {
                vehicleId = existingVehicles[0].id;
            } else {
                // Insert new vehicle
                const { data: newVehicle, error: createVehErr } = await supabase
                    .from('vehicles')
                    .insert([{
                        tenant_id: tenantId,
                        customer_id: customerId,
                        license_plate: cleanPlate,
                        make: booking.vehicle_make || 'Mazda',
                        model: booking.vehicle_model || 'Unknown',
                        year: booking.vehicle_year ? String(booking.vehicle_year) : null,
                    }])
                    .select('id')
                    .single();

                if (createVehErr) throw createVehErr;
                vehicleId = newVehicle.id;
            }

            // 3. Create Job Card
            const serviceDef = SERVICE_TYPES.find(s => s.id === booking.service_type);
            const serviceLabel = serviceDef ? serviceDef.title : booking.service_type;
            const description = `Booking [${booking.booking_time}]: ${serviceLabel}${booking.notes ? ' — Notes: ' + booking.notes : ''}`;

            const { data: newJob, error: jobErr } = await supabase
                .from('job_cards')
                .insert([{
                    tenant_id: tenantId,
                    vehicle_id: vehicleId,
                    mileage: booking.mileage || null,
                    status: 'pending',
                    description: description,
                }])
                .select('id')
                .single();

            if (jobErr) throw jobErr;

            // 4. Update booking with job_card_id and status: 'completed'
            const { error: bookingUpdateErr } = await supabase
                .from('bookings')
                .update({
                    job_card_id: newJob.id,
                    status: 'completed',
                })
                .eq('id', booking.id);

            if (bookingUpdateErr) throw bookingUpdateErr;

            toast(`Job Card created for ${booking.vehicle_plate}! Opening jobs board...`, 'success');

            // Update local state
            setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, job_card_id: newJob.id, status: 'completed' } : b));

            // Navigate to Jobs
            setTimeout(() => {
                navigate('/jobs');
            }, 800);

        } catch (err: any) {
            console.error('Error converting booking to job card:', err);
            toast(err.message || 'Failed to convert to Job Card.', 'error');
        } finally {
            setConvertingId(null);
        }
    };

    // Action: Submit Manual / Phone Booking
    const handleCreateManualBooking = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tenantId) return;

        if (!manualPlate.trim() || !manualCustomerName.trim() || !manualCustomerPhone.trim()) {
            toast('Please fill in vehicle plate, customer name, and phone.', 'warning');
            return;
        }

        setManualSubmitting(true);
        try {
            const { data, error } = await supabase
                .from('bookings')
                .insert([{
                    tenant_id: tenantId,
                    customer_title: manualCustomerTitle,
                    customer_name: manualCustomerName.trim(),
                    customer_phone: manualCustomerPhone.trim(),
                    vehicle_plate: manualPlate.trim().toUpperCase(),
                    vehicle_make: manualMake.trim() || 'Mazda',
                    vehicle_model: manualModel.trim() || null,
                    vehicle_year: manualYear ? parseInt(manualYear) : null,
                    mileage: manualMileage ? parseInt(manualMileage) : null,
                    service_type: manualServiceType,
                    booking_date: manualDate,
                    booking_time: manualTime,
                    status: 'confirmed', // Manual bookings made by staff default to confirmed
                    notes: manualNotes.trim() || null,
                }])
                .select('*')
                .single();

            if (error) throw error;

            toast(`Booking for ${manualPlate.toUpperCase()} added!`, 'success');
            setBookings(prev => [data, ...prev]);
            setIsCreateModalOpen(false);

            // Reset Form
            setManualPlate('');
            setManualModel('');
            setManualCustomerName('');
            setManualCustomerPhone('');
            setManualNotes('');
        } catch (err: any) {
            console.error('Error creating manual booking:', err);
            toast(err.message || 'Failed to create booking.', 'error');
        } finally {
            setManualSubmitting(false);
        }
    };

    // Workshop Public Booking URL
    const publicBookingUrl = getPublicBookingUrl(tenantId);

    const handleCopyBookingLink = () => {
        navigator.clipboard.writeText(publicBookingUrl);
        toast('Public booking link copied to clipboard!', 'success');
    };

    const handleShareViaWhatsApp = () => {
        const text = `Book your vehicle service online with ${profile?.tenants?.name || 'our workshop'}! Choose your convenient date and time slot directly here:\n${publicBookingUrl}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    return (
        <div className="space-y-6">
            {/* Top Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
                        <CalendarIcon size={26} className="text-cyan-400" />
                        Customer Bookings &amp; Schedule
                    </h1>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Manage customer appointments, live slot availability, and 1-click conversion to Job Cards.
                    </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                        type="button"
                        onClick={() => setIsShareModalOpen(true)}
                        className="relative overflow-hidden inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-cyan-400 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-black text-xs shadow-lg shadow-cyan-500/25 border border-cyan-300 transition-all active:scale-95 group"
                    >
                        {/* Classy Shimmer Light Beam */}
                        <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer-sweep pointer-events-none" />
                        <Share2 size={15} className="text-slate-950 shrink-0 stroke-[2.5]" />
                        <span className="tracking-wide">Share Customer Booking Portal</span>
                    </button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Today's Appointments</span>
                    <div className="text-2xl font-black text-white mt-1">{todayCount}</div>
                    <span className="text-[10px] text-cyan-400 font-medium">Scheduled for today</span>
                </div>

                <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
                    <span className="text-[10px] uppercase font-bold text-amber-500 block">Pending Confirmation</span>
                    <div className="text-2xl font-black text-amber-400 mt-1">{pendingCount}</div>
                    <span className="text-[10px] text-slate-400">Online requests to confirm</span>
                </div>

                <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
                    <span className="text-[10px] uppercase font-bold text-emerald-500 block">Confirmed &amp; Upcoming</span>
                    <div className="text-2xl font-black text-emerald-400 mt-1">{confirmedCount}</div>
                    <span className="text-[10px] text-slate-400">Reserved arrivals</span>
                </div>

                <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
                    <span className="text-[10px] uppercase font-bold text-cyan-500 block">Converted to Jobs</span>
                    <div className="text-2xl font-black text-cyan-400 mt-1">{completedCount}</div>
                    <span className="text-[10px] text-slate-400">In workshop / completed</span>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Search */}
                <div className="relative flex-1 max-w-sm">
                    <Search size={15} className="absolute left-3 top-3 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search vehicle plate, customer name, phone..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-9 pr-3 py-2 text-xs focus:border-cyan-500 outline-none"
                    />
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Date filter pills */}
                    <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                        {(['upcoming', 'today', 'tomorrow', 'all'] as const).map(tab => (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => setDateFilter(tab)}
                                className={`px-3 py-1 rounded-lg font-bold capitalize transition-all ${
                                    dateFilter === tab
                                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Status filter dropdown */}
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs focus:border-cyan-500 outline-none"
                    >
                        <option value="all">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="completed">In Service / Completed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>
            </div>

            {/* Bookings List */}
            {loading ? (
                <div className="py-16 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <Clock size={16} className="animate-spin text-cyan-400" />
                    <span>Loading appointments…</span>
                </div>
            ) : filteredBookings.length === 0 ? (
                <div className="p-12 text-center bg-slate-900/30 border border-slate-800 rounded-3xl space-y-3">
                    <CalendarIcon size={36} className="mx-auto text-slate-600" />
                    <h3 className="text-base font-bold text-white">No Bookings Found</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        No appointments match your active filter criteria. Share your booking link or take a manual walk-in booking above.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {filteredBookings.map(b => {
                        const statusKey = (b.status || 'pending') as BookingStatus;
                        const statusMeta = BOOKING_STATUS_CONFIG[statusKey] || BOOKING_STATUS_CONFIG.pending;
                        const serviceDef = SERVICE_TYPES.find(s => s.id === b.service_type);
                        const isToday = b.booking_date === todayStr;

                        return (
                            <div
                                key={b.id}
                                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                                    isToday
                                        ? 'bg-slate-900/90 border-cyan-500/40 shadow-lg shadow-cyan-950/20'
                                        : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700'
                                }`}
                            >
                                <div className="space-y-3">
                                    {/* Header: Date, Time & Status */}
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-mono font-bold text-white px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                                                {b.booking_time}
                                            </span>
                                            <span className={`text-[11px] font-bold ${isToday ? 'text-cyan-400' : 'text-slate-400'}`}>
                                                {isToday ? 'Today' : new Date(b.booking_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                            </span>
                                        </div>

                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusMeta.badge}`}>
                                            {statusMeta.label}
                                        </span>
                                    </div>

                                    {/* Vehicle & Customer Info */}
                                    <div>
                                        <div className="flex items-baseline justify-between gap-2">
                                            <h3 className="text-base font-black font-mono tracking-wider text-white">
                                                {b.vehicle_plate}
                                            </h3>
                                            {(b.vehicle_make || b.vehicle_model) && (
                                                <span className="text-xs text-slate-400 truncate">
                                                    {b.vehicle_make} {b.vehicle_model}
                                                </span>
                                            )}
                                        </div>

                                        <div className="text-xs text-slate-300 font-medium mt-1 flex items-center justify-between">
                                            <span>
                                                {b.customer_title ? `${b.customer_title} ` : ''}{b.customer_name}
                                            </span>
                                            <a
                                                href={`tel:${b.customer_phone}`}
                                                className="text-cyan-400 hover:underline font-mono text-[11px]"
                                            >
                                                {b.customer_phone}
                                            </a>
                                        </div>
                                    </div>

                                    {/* Service Requested Badge */}
                                    <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1">
                                        <div className="text-[10px] uppercase font-bold text-slate-500">Service</div>
                                        <div className="text-xs font-bold text-slate-200">
                                            {serviceDef?.title || b.service_type}
                                        </div>
                                        {b.notes && (
                                            <p className="text-[11px] text-slate-400 italic line-clamp-2 mt-0.5">
                                                "{b.notes}"
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Actions Toolbar */}
                                <div className="pt-3 mt-3 border-t border-slate-800/80 space-y-2">
                                    {b.job_card_id ? (
                                        <button
                                            type="button"
                                            onClick={() => navigate('/jobs')}
                                            className="w-full py-2 px-3 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/40 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                                        >
                                            <Wrench size={13} />
                                            <span>Active Job Card Created</span>
                                            <ChevronRight size={13} />
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-1.5">
                                            {b.status === 'pending' && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleConfirmBooking(b)}
                                                    className="flex-1 py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1 transition-all active:scale-95"
                                                >
                                                    <Check size={13} />
                                                    <span>Confirm</span>
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                disabled={convertingId === b.id}
                                                onClick={() => handleConvertToJobCard(b)}
                                                title="Convert to Job Card"
                                                className="flex-1 py-2 px-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-sm transition-all active:scale-95"
                                            >
                                                <Wrench size={13} />
                                                <span>{convertingId === b.id ? 'Creating Job…' : 'Start Job'}</span>
                                            </button>

                                            {b.status !== 'cancelled' && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleCancelBooking(b.id)}
                                                    title="Cancel Booking"
                                                    className="p-2 rounded-xl bg-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-400 border border-slate-700 transition-colors"
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Tracking link & WhatsApp shortcut */}
                                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const url = getPublicBookingTrackingUrl(b.public_token);
                                                window.open(url, '_blank');
                                            }}
                                            className="hover:text-cyan-400 flex items-center gap-1 transition-colors"
                                        >
                                            <Eye size={12} />
                                            <span>Customer View</span>
                                        </button>

                                        <a
                                            href={buildBookingWhatsAppUrl({
                                                customer_name: b.customer_name,
                                                customer_phone: b.customer_phone,
                                                vehicle_plate: b.vehicle_plate,
                                                service_type: b.service_type,
                                                booking_date: b.booking_date,
                                                booking_time: b.booking_time,
                                                public_token: b.public_token,
                                                workshop_name: profile?.tenants?.name,
                                                workshop_phone: profile?.tenants?.phone,
                                            })}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="hover:text-emerald-400 flex items-center gap-1 transition-colors"
                                        >
                                            <MessageSquare size={12} />
                                            <span>WhatsApp</span>
                                        </a>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* MANUAL / PHONE BOOKING MODAL */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div>
                                <h2 className="text-lg font-black text-white">Manual / Phone Booking</h2>
                                <p className="text-xs text-slate-400">Record a customer booking taken via phone or walk-in</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsCreateModalOpen(false)}
                                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateManualBooking} className="space-y-4 text-xs">
                            {/* Vehicle fields */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                <div className="sm:col-span-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                                        License Plate *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="WP CAA-1234"
                                        value={manualPlate}
                                        onChange={e => setManualPlate(e.target.value.toUpperCase())}
                                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 font-mono uppercase focus:border-cyan-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                                        Make / Brand
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Mazda"
                                        value={manualMake}
                                        onChange={e => setManualMake(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 focus:border-cyan-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                                        Model Name
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Axela"
                                        value={manualModel}
                                        onChange={e => setManualModel(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 focus:border-cyan-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                                        Year
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="2018"
                                        value={manualYear}
                                        onChange={e => setManualYear(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 font-mono focus:border-cyan-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                                        Mileage (km)
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="85000"
                                        value={manualMileage}
                                        onChange={e => setManualMileage(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 font-mono focus:border-cyan-500 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Customer fields */}
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                                        Title
                                    </label>
                                    <select
                                        value={manualCustomerTitle}
                                        onChange={e => setManualCustomerTitle(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 focus:border-cyan-500 outline-none"
                                    >
                                        <option value="Mr.">Mr.</option>
                                        <option value="Mrs.">Mrs.</option>
                                        <option value="Ms.">Ms.</option>
                                        <option value="Dr.">Dr.</option>
                                        <option value="Rev.">Rev.</option>
                                        <option value="Company">Company</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                                        Customer Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Kasun Silva"
                                        value={manualCustomerName}
                                        onChange={e => setManualCustomerName(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 focus:border-cyan-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                                    Phone Number (WhatsApp) *
                                </label>
                                <input
                                    type="tel"
                                    required
                                    placeholder="077 123 4567"
                                    value={manualCustomerPhone}
                                    onChange={e => setManualCustomerPhone(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 focus:border-cyan-500 outline-none"
                                />
                            </div>

                            {/* Service Type */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                                    Service Type
                                </label>
                                <select
                                    value={manualServiceType}
                                    onChange={e => setManualServiceType(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 focus:border-cyan-500 outline-none"
                                >
                                    {SERVICE_TYPES.map(s => (
                                        <option key={s.id} value={s.id}>{s.title}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Date & Time */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                                        Date
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={manualDate}
                                        onChange={e => setManualDate(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 focus:border-cyan-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                                        Time Slot
                                    </label>
                                    <select
                                        value={manualTime}
                                        onChange={e => setManualTime(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 font-mono focus:border-cyan-500 outline-none"
                                    >
                                        {generateTimeSlots().map(slot => (
                                            <option key={slot} value={slot}>{slot}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                                    Notes / Customer Symptoms
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Any notes discussed with the customer..."
                                    value={manualNotes}
                                    onChange={e => setManualNotes(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 focus:border-cyan-500 outline-none"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={manualSubmitting}
                                    className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold shadow-md shadow-cyan-600/20"
                                >
                                    {manualSubmitting ? 'Saving…' : 'Save Booking'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* SHARE BOOKING LINK MODAL */}
            {isShareModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-2">
                                <Share2 size={18} className="text-cyan-400" />
                                <h2 className="text-base font-black text-white">Your Public Booking Link</h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsShareModalOpen(false)}
                                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">
                            Share this link with your customers via WhatsApp, SMS, or your social media pages. Customers can pick their preferred time and register their vehicle online.
                        </p>

                        <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-2">
                            <span className="text-xs font-mono text-cyan-400 truncate">
                                {publicBookingUrl}
                            </span>
                            <button
                                type="button"
                                onClick={handleCopyBookingLink}
                                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors shrink-0"
                                title="Copy Link"
                            >
                                <Copy size={14} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2">
                            <button
                                type="button"
                                onClick={handleCopyBookingLink}
                                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                            >
                                <Copy size={14} />
                                <span>Copy Link</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleShareViaWhatsApp}
                                className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all active:scale-95"
                            >
                                <MessageSquare size={14} />
                                <span>Share on WhatsApp</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
