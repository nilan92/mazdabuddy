export type { BookingStatus } from '../types';

export interface ServiceTypeDefinition {
    id: string;
    title: string;
    shortTitle: string;
    description: string;
    estimatedMinutes: number;
    badgeColor: string;
}

export const SERVICE_TYPES: ServiceTypeDefinition[] = [
    {
        id: 'routine_service',
        title: 'Routine Maintenance & Periodic Service',
        shortTitle: 'Routine Service',
        description: 'Complete multi-point vehicle service, engine oil & filter change, fluid top-ups, and safety check.',
        estimatedMinutes: 60,
        badgeColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    },
    {
        id: 'oil_filter',
        title: 'Engine Oil & Filter Service',
        shortTitle: 'Oil & Filter',
        description: 'Engine oil drain & fresh refill with brand new oil filter and washer replacement.',
        estimatedMinutes: 45,
        badgeColor: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    },
    {
        id: 'brakes',
        title: 'Brake Inspection & Service',
        shortTitle: 'Brake Service',
        description: 'Brake pad thickness, disc rotor inspection, brake fluid moisture test, and caliper cleaning.',
        estimatedMinutes: 60,
        badgeColor: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    },
    {
        id: 'inspection',
        title: 'Full Vehicle Health Check & Pre-Purchase',
        shortTitle: 'Health Check',
        description: 'Comprehensive 40+ point bumper-to-bumper vehicle inspection with full digital health report.',
        estimatedMinutes: 45,
        badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    },
    {
        id: 'diagnostic',
        title: 'Computer Diagnostics / Check Engine Light',
        shortTitle: 'Diagnostic Scan',
        description: 'OBD-II computer scan, live sensor telemetry readout, and fault code troubleshooting.',
        estimatedMinutes: 60,
        badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    },
    {
        id: 'ac_service',
        title: 'Air Conditioning & Climate Service',
        shortTitle: 'A/C Service',
        description: 'Refrigerant pressure test, cabin blower/filter check, and cabin cooling performance test.',
        estimatedMinutes: 60,
        badgeColor: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
    },
    {
        id: 'wheel_alignment',
        title: 'Wheel Alignment & Suspension Check',
        shortTitle: 'Wheel Alignment',
        description: 'Suspension bushings inspection, steering tie-rods, and computer wheel alignment.',
        estimatedMinutes: 45,
        badgeColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
    },
    {
        id: 'general_repair',
        title: 'Mechanical Repair & Troubleshooting',
        shortTitle: 'Mechanical Repair',
        description: 'Engine, transmission, cooling system, belts, or running gear repair diagnosis.',
        estimatedMinutes: 90,
        badgeColor: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    },
    {
        id: 'other',
        title: 'Other Custom Request / Consultation',
        shortTitle: 'Custom Request',
        description: 'Specific noise, fluid leak, or custom mechanical inquiry. Describe your issue in the notes.',
        estimatedMinutes: 60,
        badgeColor: 'text-slate-300 bg-slate-500/10 border-slate-500/30',
    },
];

export const BOOKING_STATUS_CONFIG: Record<string, { label: string; badge: string; dot: string }> = {
    pending: {
        label: 'Pending Confirmation',
        badge: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
        dot: 'bg-amber-400',
    },
    confirmed: {
        label: 'Confirmed & Reserved',
        badge: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
        dot: 'bg-emerald-400',
    },
    completed: {
        label: 'In Service / Completed',
        badge: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
        dot: 'bg-cyan-400',
    },
    cancelled: {
        label: 'Cancelled',
        badge: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
        dot: 'bg-rose-400',
    },
    no_show: {
        label: 'No Show',
        badge: 'bg-slate-500/15 text-slate-400 border border-slate-500/30',
        dot: 'bg-slate-400',
    },
};

/**
 * Generate time slots between start and end time with given duration
 */
export function generateTimeSlots(
    startTimeStr: string = '08:30',
    endTimeStr: string = '17:30',
    durationMinutes: number = 60
): string[] {
    const slots: string[] = [];

    const parseMinutes = (time: string) => {
        const [h, m] = time.split(':').map(Number);
        return (isNaN(h) ? 8 : h) * 60 + (isNaN(m) ? 30 : m);
    };

    const formatTime = (totalMinutes: number) => {
        const hours24 = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        const period = hours24 >= 12 ? 'PM' : 'AM';
        const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
        const minsStr = mins < 10 ? `0${mins}` : `${mins}`;
        return `${hours12}:${minsStr} ${period}`;
    };

    let current = parseMinutes(startTimeStr);
    const end = parseMinutes(endTimeStr);

    while (current + durationMinutes <= end) {
        slots.push(formatTime(current));
        current += durationMinutes;
    }

    // Fallback if empty
    if (slots.length === 0) {
        return ['08:30 AM', '09:30 AM', '10:30 AM', '11:30 AM', '01:30 PM', '02:30 PM', '03:30 PM', '04:30 PM'];
    }

    return slots;
}

/**
 * Build WhatsApp confirmation URL / text for a customer booking
 */
export function buildBookingWhatsAppUrl(booking: {
    customer_name: string;
    customer_phone: string;
    vehicle_plate: string;
    service_type: string;
    booking_date: string;
    booking_time: string;
    public_token: string;
    workshop_name?: string;
    workshop_phone?: string;
}): string {
    const serviceDef = SERVICE_TYPES.find(s => s.id === booking.service_type);
    const serviceLabel = serviceDef ? serviceDef.shortTitle : booking.service_type;
    const formattedDate = new Date(booking.booking_date).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });

    const origin = window.location.origin;
    const trackingUrl = `${origin}/#/booking/${booking.public_token}`;

    const text = `🚗 *SERVICE BOOKING CONFIRMATION* 🚗\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `Hello ${booking.customer_name},\n\n` +
        `Your appointment at *${booking.workshop_name || 'the Workshop'}* has been recorded:\n\n` +
        `📅 *Date:* ${formattedDate}\n` +
        `⏰ *Time Slot:* ${booking.booking_time}\n` +
        `🚘 *Vehicle:* ${booking.vehicle_plate.toUpperCase()}\n` +
        `🔧 *Service:* ${serviceLabel}\n\n` +
        `🔗 *Live Booking Tracker & Details:*\n${trackingUrl}\n\n` +
        `If you need to reschedule, please reply here or contact us directly. Thank you!`;

    // Strip non-digit characters from customer phone
    let phone = booking.customer_phone.replace(/\D/g, '');
    if (phone.startsWith('0') && phone.length === 10) {
        phone = '94' + phone.substring(1);
    }

    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

/**
 * Generate iCalendar (.ics) download for the customer's calendar
 */
export function downloadCalendarEvent(booking: {
    customer_name: string;
    vehicle_plate: string;
    service_type: string;
    booking_date: string;
    booking_time: string;
    workshop_name?: string;
    workshop_address?: string;
    notes?: string;
}) {
    const serviceDef = SERVICE_TYPES.find(s => s.id === booking.service_type);
    const serviceLabel = serviceDef ? serviceDef.title : booking.service_type;

    // Convert date + time to basic start date string
    // e.g. "2026-10-10" and "09:30 AM"
    const dateParts = booking.booking_date.split('-');
    const year = dateParts[0];
    const month = dateParts[1];
    const day = dateParts[2];

    let hour = 9;
    let min = 0;
    const timeMatch = booking.booking_time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (timeMatch) {
        hour = parseInt(timeMatch[1], 10);
        min = parseInt(timeMatch[2], 10);
        const period = (timeMatch[3] || '').toUpperCase();
        if (period === 'PM' && hour < 12) hour += 12;
        if (period === 'AM' && hour === 12) hour = 0;
    }

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const dtStart = `${year}${month}${day}T${pad(hour)}${pad(min)}00`;
    
    // Default 1.5 hr duration
    const endMinutes = hour * 60 + min + 90;
    const endHour = Math.floor(endMinutes / 60);
    const endMin = endMinutes % 60;
    const dtEnd = `${year}${month}${day}T${pad(endHour)}${pad(endMin)}00`;

    const summary = `${serviceLabel} - ${booking.vehicle_plate.toUpperCase()}`;
    const description = `Vehicle Service Appointment at ${booking.workshop_name || 'Workshop'}. Vehicle: ${booking.vehicle_plate}. ${booking.notes ? 'Notes: ' + booking.notes : ''}`;
    const location = booking.workshop_address || booking.workshop_name || 'Workshop';

    const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//AutoPulse//Workshop Service Booking//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:booking-${Date.now()}@autopulse.io`,
        `DTSTAMP:${dtStart}Z`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        `LOCATION:${location}`,
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `service-booking-${booking.vehicle_plate}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
