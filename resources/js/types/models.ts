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
    email: string | null;
    status: 'active' | 'inactive' | 'maintenance';
    resources_count?: number;
    resources_sum_quantity?: number | null;
    completed_distributions_count?: number;
    household_member_served?: number | null;
}

export interface ResourceItem {
    id: number;
    name: string;
    category:
        | 'food'
        | 'water'
        | 'medical'
        | 'shelter'
        | 'clothing'
        | 'hygiene'
        | 'tools'
        | 'set'
        | 'other';
    sku: string;
    qr_code: string;
    quantity: number;
    unit: string;
    minimum_threshold: number;
    expiry_date: string | null;
    location_id: number | null;
    location?: { id: number; name: string; city?: string } | null;
    notes: string | null;
    disaster: string | null;
    status: 'in_stock' | 'low_stock' | 'out_of_stock';
}

export interface Distribution {
    family_id?: number;
    family?: {
        id: number;
        family_id: string;
        family_name: string;
        head_name: string;
        phone?: string | null;
        household_member: number;
        purok_id: number;
    };
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
    household_member: number;
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

    resource_id?: number | null;
    destination_resource_id?: number | null;

    family_id?: number | null;

    location_id?: number | null;
    from_location_id?: number | null;
    to_location_id?: number | null;

    scanned_by?: number | null;

    scan_type: string;
    recipient_name?: string | null;
    quantity_change: number;
    notes?: string | null;
    scanned_at: string;

    scan_date?: string | null;
    scan_time?: string | null;

    family?: {
        id: number;
        family_id: string;
        family_name: string;
        head_name: string;
        purok?: string | null;
    } | null;

    resource?: ResourceItem | null;
    destination_resource?: ResourceItem | null;

    location?: Location | null;

    from_location?: Location | null;
    to_location?: Location | null;

    scanner?: {
        id: number;
        name: string;
    } | null;
}

export interface FamilyOption {
    id: number;
    family_id: string;
    family_name: string;
    head_name: string;
    purok?: string | null;
    latest_distribution?: {
        resource?: {
            id: number;
            name: string;
            unit: string;
        } | null;
    } | null;
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
    purok_id: number;
    location?: { id: number; name: string } | null;
}
