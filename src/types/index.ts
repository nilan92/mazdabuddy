export interface Tenant {
    id: string;
    name: string;
    logo_url?: string;
    address?: string;
    phone?: string;
    terms_and_conditions?: string;
    currency?: string;
    brand_color?: string;
    created_at: string;
    booking_enabled?: boolean;
    booking_slot_duration?: number;
    booking_start_time?: string;
    booking_end_time?: string;
    booking_max_concurrent?: number;
    booking_working_days?: string[];
}

export interface UserProfile {
    id: string;
    full_name: string;
    role: 'admin' | 'manager' | 'technician' | 'accountant' | 'super_admin';
    tenant_id: string;
    username?: string;
    is_super_admin?: boolean;
    tenants?: Tenant;
}

export interface SuperAdminTenant {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    currency: string;
    brand_color: string | null;
    logo_url: string | null;
    created_at: string;
    default_labor_rate: number;
    booking_enabled: boolean;
    staff_count: number;
    jobs_count: number;
    active_jobs_count: number;
    completed_jobs_count: number;
    customers_count: number;
    vehicles_count: number;
    total_revenue: number;
    total_invoiced: number;
}

export interface SuperAdminMetrics {
    total_tenants: number;
    total_staff: number;
    total_jobs: number;
    total_active_jobs: number;
    total_completed_jobs: number;
    total_customers: number;
    total_vehicles: number;
    total_revenue: number;
    total_invoiced: number;
}

export interface SuperAdminUser {
    id: string;
    full_name: string | null;
    username: string | null;
    role: string;
    is_super_admin: boolean;
    tenant_id: string | null;
    tenant_name: string | null;
    email: string | null;
    created_at: string;
}

export type JobStatus = 'pending' | 'in_progress' | 'waiting_parts' | 'completed' | 'cancelled';

export interface Customer {
    id: string;
    tenant_id: string;
    title?: string;
    name: string;
    phone: string;
    email?: string;
    address?: string;
}

export interface Supplier {
    id: string;
    tenant_id: string;
    name: string;
    contact_person?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    notes?: string | null;
    payment_terms?: string | null;
    created_at?: string;
}

export interface Vehicle {
    id: string;
    tenant_id: string;
    customer_id: string;
    make: string;
    model: string;
    year: string;
    license_plate: string;
    vin?: string;
    color?: string;
    customers?: Customer; // For joins
}

export interface Part {
    id: string;
    tenant_id: string;
    name: string;
    part_number?: string;
    stock_quantity: number;
    min_stock_level?: number;
    price_lkr: number;
    cost_lkr: number;
    location?: string;
}

export interface JobCard {
  id: string;
  tenant_id: string;
  vehicle_id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'waiting_parts' | 'completed' | 'cancelled';
  created_at: string;
  technician_notes?: string;
  estimated_cost_lkr?: number;
  mileage?: number;
  assigned_technician_id?: string; // legacy, superseded by assigned_staff_id
  assigned_staff_id?: string;
  is_outsourced?: boolean;
  outsourced_to?: string;
  archived?: boolean;
  estimated_hours?: number;
  
  // Efficiency Tracking
  started_at?: string;
  completed_at?: string;
  last_start_time?: string;
  total_labor_time?: number; // In minutes

  // Vehicle Health Inspection & Future Maintenance
  has_inspection?: boolean;
  next_service_mileage?: number;
  next_service_date?: string;
  inspection_notes?: string;

  // Joins
  vehicles?: Vehicle;
  parts?: JobPart[];
  profiles?: { full_name: string };
}

export interface JobPart {
    id: string;
    job_id: string;
    part_id: string | null;
    quantity: number;
    price_at_time_lkr: number;
    cost_at_time_lkr?: number;
    is_custom?: boolean;
    custom_name?: string;
    discount_type?: 'amount' | 'percent';
    discount_value?: number | string;
    parts?: Part; // Join
}

export interface JobLabor {
    id: string;
    job_id: string;
    mechanic_name?: string;
    quantity?: number;
    hours: number;
    description: string;
    hourly_rate_lkr: number;
    cost_at_time_lkr?: number | null;
    is_fixed?: boolean;
    discount_type?: 'amount' | 'percent';
    discount_value?: number | string;
    is_outsourced?: boolean;
    outsourced_to?: string;
    is_paid?: boolean;
    paid_at?: string | null;
}

export type InspectionStatus = 
    | 'checked'
    | 'adjusted'
    | 'clean'
    | 'replace'
    | 'problem'
    | 'na'
    | 'good'
    | 'advisory'
    | 'urgent';

export interface JobInspectionRecord {
    id?: string;
    job_id?: string;
    tenant_id?: string;
    category: string;
    item_name: string;
    status: InspectionStatus;
    notes?: string;
    estimated_cost_lkr?: number;
}

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export interface Booking {
    id: string;
    tenant_id: string;
    customer_name: string;
    customer_phone: string;
    customer_email?: string;
    customer_title?: string;
    vehicle_plate: string;
    vehicle_make?: string;
    vehicle_model?: string;
    vehicle_year?: number;
    mileage?: number;
    service_type: string;
    booking_date: string;
    booking_time: string;
    estimated_duration_minutes?: number;
    status: BookingStatus;
    notes?: string;
    internal_notes?: string;
    job_card_id?: string;
    public_token: string;
    created_at: string;
    updated_at: string;
    tenants?: Tenant;
    job_cards?: JobCard;
}
