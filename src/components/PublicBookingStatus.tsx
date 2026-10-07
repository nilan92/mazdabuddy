import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
    Clock, 
    Calendar, 
    Car, 
    Phone, 
    MapPin, 
    AlertCircle, 
    CalendarPlus
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { 
    SERVICE_TYPES, 
    BOOKING_STATUS_CONFIG, 
    downloadCalendarEvent, 
} from '../lib/bookings';
import { type BookingStatus } from '../types';

export const PublicBookingStatus: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const [booking, setBooking] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!token) {
            setError('Invalid booking link.');
            setLoading(false);
            return;
        }

        const fetchBooking = async () => {
            setLoading(true);
            try {
                const { data, error: rpcError } = await supabase.rpc('get_booking_by_token', {
                    p_token: token
                });

                if (rpcError) throw rpcError;

                if (!data || data.length === 0) {
                    setError('Booking record not found or link expired.');
                } else {
                    setBooking(data[0]);
                }
            } catch (err: any) {
                console.error('Error fetching booking by token:', err);
                setError(err.message || 'Unable to retrieve booking.');
            } finally {
                setLoading(false);
            }
        };

        fetchBooking();
    }, [token]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 animate-spin">
                    <Clock size={24} />
                </div>
                <p className="text-xs font-mono uppercase tracking-widest text-slate-400">Loading Booking Status…</p>
            </div>
        );
    }

    if (error || !booking) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
                    <AlertCircle size={28} />
                </div>
                <h1 className="text-xl font-bold text-white mb-2">Booking Not Found</h1>
                <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
                    {error || "We couldn't locate this booking record."}
                </p>
                <Link
                    to="/book"
                    className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-colors"
                >
                    Book a New Service
                </Link>
            </div>
        );
    }

    const statusKey = (booking.status || 'pending') as BookingStatus;
    const statusMeta = BOOKING_STATUS_CONFIG[statusKey] || BOOKING_STATUS_CONFIG.pending;
    const serviceDef = SERVICE_TYPES.find(s => s.id === booking.service_type);

    const formattedDate = new Date(booking.booking_date).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-cyan-500/30">
            {/* Header */}
            <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur sticky top-0 z-40">
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {booking.tenant_logo_url ? (
                            <img
                                src={booking.tenant_logo_url}
                                alt={booking.tenant_name}
                                className="w-9 h-9 object-contain rounded-xl bg-slate-900 p-1 border border-slate-800"
                            />
                        ) : (
                            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-black">
                                <Car size={18} />
                            </div>
                        )}
                        <div>
                            <h1 className="text-xs font-black text-white uppercase tracking-tight">
                                {booking.tenant_name}
                            </h1>
                            <p className="text-[10px] text-slate-400">Appointment Status</p>
                        </div>
                    </div>

                    <div className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${statusMeta.badge}`}>
                        <span className={`w-2 h-2 rounded-full ${statusMeta.dot}`} />
                        <span>{statusMeta.label}</span>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-2xl mx-auto px-4 py-8 w-full flex-grow space-y-6">
                {/* Appointment Card */}
                <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">
                                Appointment Time
                            </span>
                            <div className="text-2xl font-black text-white mt-1">
                                {booking.booking_time}
                            </div>
                            <div className="text-xs text-slate-300 font-medium mt-0.5 flex items-center gap-1.5">
                                <Calendar size={13} className="text-cyan-400" />
                                {formattedDate}
                            </div>
                        </div>

                        <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-slate-500 block">
                                Ref Number
                            </span>
                            <span className="text-xs font-mono font-bold text-slate-300">
                                #{booking.id.substring(0, 8).toUpperCase()}
                            </span>
                        </div>
                    </div>

                    {/* Vehicle & Customer Pills */}
                    <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800/80 space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                                <span className="text-[10px] uppercase text-slate-500 block mb-0.5">Vehicle</span>
                                <span className="font-bold text-white font-mono text-sm tracking-wide">
                                    {booking.vehicle_plate}
                                </span>
                                {(booking.vehicle_make || booking.vehicle_model) && (
                                    <div className="text-[11px] text-slate-400">
                                        {booking.vehicle_make} {booking.vehicle_model} {booking.vehicle_year || ''}
                                    </div>
                                )}
                            </div>

                            <div>
                                <span className="text-[10px] uppercase text-slate-500 block mb-0.5">Customer</span>
                                <span className="font-bold text-white">
                                    {booking.customer_title ? `${booking.customer_title} ` : ''}{booking.customer_name}
                                </span>
                                <div className="text-[11px] text-slate-400 font-mono">
                                    {booking.customer_phone}
                                </div>
                            </div>
                        </div>

                        <div className="pt-3 border-t border-slate-800/80 flex items-start gap-3">
                            {serviceDef?.imageUrl && (
                                <img
                                    src={serviceDef.imageUrl}
                                    alt={serviceDef.title}
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1625047509168-a7026f36de04?auto=format&fit=crop&w=600&q=80';
                                    }}
                                    className="w-14 h-14 rounded-xl object-cover shrink-0 border border-slate-800"
                                />
                            )}
                            <div className="flex-1 min-w-0">
                                <span className="text-[10px] uppercase text-slate-500 block mb-0.5">Service Requested</span>
                                <span className="text-xs font-bold text-cyan-300 block">
                                    {serviceDef?.title || booking.service_type}
                                </span>
                                {serviceDef?.description && (
                                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                                        {serviceDef.description}
                                    </p>
                                )}
                            </div>
                        </div>

                        {booking.notes && (
                            <div className="pt-3 border-t border-slate-800/80">
                                <span className="text-[10px] uppercase text-slate-500 block mb-0.5">Your Notes</span>
                                <p className="text-xs text-slate-300 italic">
                                    "{booking.notes}"
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                        <button
                            type="button"
                            onClick={() => downloadCalendarEvent({
                                customer_name: booking.customer_name,
                                vehicle_plate: booking.vehicle_plate,
                                service_type: booking.service_type,
                                booking_date: booking.booking_date,
                                booking_time: booking.booking_time,
                                workshop_name: booking.tenant_name,
                                workshop_address: booking.tenant_address,
                                notes: booking.notes
                            })}
                            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                            <CalendarPlus size={15} className="text-cyan-400" />
                            <span>Add to Calendar (.ics)</span>
                        </button>

                        {booking.tenant_phone && (
                            <a
                                href={`tel:${booking.tenant_phone}`}
                                className="py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-cyan-600/20 transition-all active:scale-95"
                            >
                                <Phone size={15} />
                                <span>Call Workshop ({booking.tenant_phone})</span>
                            </a>
                        )}
                    </div>
                </div>

                {/* Workshop Location */}
                {booking.tenant_address && (
                    <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-start gap-3 text-xs text-slate-300">
                        <MapPin size={18} className="text-cyan-400 shrink-0 mt-0.5" />
                        <div>
                            <strong className="text-white block mb-0.5">{booking.tenant_name}</strong>
                            <span className="text-slate-400 leading-relaxed block">{booking.tenant_address}</span>
                        </div>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-850 py-4 text-center text-[11px] text-slate-500">
                AutoPulse Service Operating System
            </footer>
        </div>
    );
};
