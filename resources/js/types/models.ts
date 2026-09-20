export interface AuthUser {
    id: number;
    name: string;
    email: string;
    role: 'admin' | 'staff';
    phone: string | null;
    status: 'active' | 'on_leave' | 'inactive';
    location_id: number | null;
}

export interface Location {
    id: number;
    name: string;
    type: 'warehouse' | 'distribution_center' | 'shelter' | 'field_office';
    address: string;
    city: string;
    latitude: string | number | null;
    longitude: string | number | null;
    capacity: number;
    contact_person: string | null;
    contact_phone: string | null;
    status: 'active' | 'inactive' | 'maintenance';
    resources_count?: number;
    resources_sum_quantity?: number | null;
    completed_distributions_count?: number;
    beneficiaries_served?: number | null;
}

export interface ResourceItem {
    id: number;
    name: string;
    category: 'food' | 'water' | 'medical' | 'shelter' | 'clothing' | 'hygiene' | 'tools' | 'set' | 'other';
    sku: string;
    qr_code: string;
    quantity: number;
    unit: string;
    minimum_threshold: number;
    expiry_date: string | null;
    location_id: number | null;
    location?: { id: number; name: string; city?: string } | null;
    notes: string | null;
    status: 'in_stock' | 'low_stock' | 'out_of_stock';
}

export interface Distribution {
    id: number;
    qr_code: string | null;
    resource_id: number;
    additional_resource_id: number | null;
    location_id: number | null;
    distributed_by: number | null;
    quantity: number;
    additional_quantity: number | null;
    recipient_name: string;
    recipient_contact: string | null;
    beneficiary_count: number;
    distribution_date: string;
    status: 'pending' | 'in_transit' | 'completed' | 'cancelled';
    notes: string | null;
    resource?: { id: number; name: string; unit: string };
    additional_resource?: { id: number; name: string; unit: string } | null;
    location?: { id: number; name: string } | null;
    distributor?: { id: number; name: string } | null;
}

export interface QrScan {
    id: number;
    resource_id: number;
    location_id: number | null;
    scanned_by: number;
    scan_type: 'check_in' | 'check_out' | 'audit' | 'transfer';
    recipient_name: string | null;
    quantity_change: number;
    notes: string | null;
    scanned_at: string;
    resource?: { id: number; name: string; qr_code: string; unit: string };
    location?: { id: number; name: string } | null;
    scanner?: { id: number; name: string } | null;
}

export interface TeamMember {
    id: number;
    name: string;
    email: string;
    role: 'admin' | 'staff';
    phone: string | null;
    status: 'active' | 'on_leave' | 'inactive';
    location_id: number | null;
    responsibilities: string | null;
    location?: { id: number; name: string } | null;
}
