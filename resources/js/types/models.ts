export interface AuthUser {
    id: number;
    name: string;
    email: string;
    role: 'admin' | 'staff';
    phone: string | null;
    status: 'active' | 'on_leave' | 'inactive';
    location_id: number | null;
}

export interface FamilyMember {
    id: number;
    household_member_number: number;
    name?: string | null;
}

export interface FamilyModel {
    id: number;
    family_id: string;
    head_name: string;
    email?: string | null;
    phone?: string | null;
    household_member: number;
    purok_id: number;
    location_id?: number | null;
    pin?: string;
    status: string;
    purok?: { id: number; name: string; code?: string };
    location?: { id: number; name: string; status: string };
    household_member_list?: FamilyMember[];
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
    families_coverable?: number | null;
    families_at_location?: number | null;
    is_expired?: boolean;
    expiring_soon?: boolean;
    days_until_expiry?: number | null;
}

export interface Distribution {
    family_id?: number;
    family?: {
        id: number;
        family_id: string;
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
    assignment_mode?: 'set' | 'individual' | null;
    resource_set_id?: number | null;
    resource_set?: ResourceSet | null;
    items?: DistributionItem[];
    excluded?: boolean;
    exclusion_reason?: string | null;
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
    receiver?: string | null;

    family?: {
        id: number;
        family_id: string;
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
    staff_id: string | null;
    name: string;
    email: string;
    role: 'admin' | 'staff';
    phone: string | null;
    status: 'active' | 'on_leave' | 'inactive' | 'pending';
    location_id: number | null;
    responsibilities: string | null;
    purok_id: number;
    birthdate: string | null;
    home_address: string | null;
    location?: { id: number; name: string } | null;
    purok?: { id: number; name: string } | null;
}

export interface PendingStaff {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    purok_id: number | null;
    purok: { id: number; name: string } | null;
    location_id: number | null;
    location: { id: number; name: string } | null;
    preferred_purok_ids: number[] | null;
    created_at: string;
}

export interface ResourceSetItem {
    id: number;
    resource_set_id: number;
    resource_id: number;
    quantity: number;
    resource?: { id: number; name: string; unit: string } | null;
}

export interface ResourceSet {
    id: number;
    name: string;
    description: string | null;
    location_id: number | null;
    disaster: string | null;
    created_by: number | null;
    num_sets?: number;
    sets_remaining?: number | null;
    items?: ResourceSetItem[];
    location?: { id: number; name: string } | null;
}

export interface DistributionItem {
    id: number;
    distribution_id: number;
    resource_id: number;
    quantity: number;
    resource?: { id: number; name: string; unit: string } | null;
}

export interface StockWarning {
    resource_id: number;
    resource_name: string;
    unit: string;
    available: number;
    required: number;
    shortfall: number;
}
