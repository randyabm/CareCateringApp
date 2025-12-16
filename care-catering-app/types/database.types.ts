export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string
                    full_name: string | null
                    role: 'nurse' | 'kitchen_staff' | 'store_man' | 'admin'
                    assigned_location_id: number | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id: string
                    full_name?: string | null
                    role?: 'nurse' | 'kitchen_staff' | 'store_man' | 'admin'
                    assigned_location_id?: number | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    full_name?: string | null
                    role?: 'nurse' | 'kitchen_staff' | 'store_man' | 'admin'
                    assigned_location_id?: number | null
                    created_at?: string
                    updated_at?: string
                }
            }
            location_groups: {
                Row: {
                    id: number
                    name: string
                    parent_group_id: number | null
                    created_at: string
                }
                Insert: {
                    id?: number
                    name: string
                    parent_group_id?: number | null
                    created_at?: string
                }
                Update: {
                    id?: number
                    name?: string
                    parent_group_id?: number | null
                    created_at?: string
                }
            }
            product_categories: {
                Row: {
                    id: number
                    name: string
                    created_at: string
                }
                Insert: {
                    id?: number
                    name: string
                    created_at?: string
                }
                Update: {
                    id?: number
                    name?: string
                    created_at?: string
                }
            }
            locations: {
                Row: {
                    id: number
                    name: string
                    responsible_name: string | null
                    approver_email: string | null
                    is_active: boolean
                    created_at: string
                    group_id: number | null
                }
                Insert: {
                    id?: number
                    name: string
                    responsible_name?: string | null
                    approver_email?: string | null
                    is_active?: boolean
                    created_at?: string
                    group_id?: number | null
                }
                Update: {
                    id?: number
                    name?: string
                    responsible_name?: string | null
                    approver_email?: string | null
                    is_active?: boolean
                    created_at?: string
                    group_id?: number | null
                }
            }
            products: {
                Row: {
                    id: number
                    name: string
                    unit_price: number
                    requires_approval: boolean
                    category: string | null
                    image_url: string | null
                    unit_size: string | null
                    storage_stock: number
                    storage_reorder_point: number
                    created_at: string
                    category_id: number | null
                }
                Insert: {
                    id?: number
                    name: string
                    unit_price?: number
                    requires_approval?: boolean
                    category?: string | null
                    image_url?: string | null
                    unit_size?: string | null
                    storage_stock?: number
                    storage_reorder_point?: number
                    created_at?: string
                    category_id?: number | null
                }
                Update: {
                    id?: number
                    name?: string
                    unit_price?: number
                    requires_approval?: boolean
                    category?: string | null
                    image_url?: string | null
                    unit_size?: string | null
                    storage_stock?: number
                    storage_reorder_point?: number
                    created_at?: string
                }
            }
            order_items: {
                Row: {
                    id: number
                    order_id: number | null
                    product_id: number | null
                    quantity: number
                    created_at: string
                }
                Insert: {
                    id?: number
                    order_id?: number | null
                    product_id?: number | null
                    quantity: number
                    created_at?: string
                }
                Update: {
                    id?: number
                    order_id?: number | null
                    product_id?: number | null
                    quantity?: number
                    created_at?: string
                }
            }
            orders: {
                Row: {
                    id: number
                    user_id: string | null
                    location_id: number | null
                    type: 'grocery' | 'catering' | 'proactive_restock'
                    status: 'pending' | 'approved' | 'processing' | 'delivered' | 'cancelled'
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: number
                    user_id?: string | null
                    location_id?: number | null
                    type: 'grocery' | 'catering' | 'proactive_restock'
                    status?: 'pending' | 'approved' | 'processing' | 'delivered' | 'cancelled'
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: number
                    user_id?: string | null
                    location_id?: number | null
                    type?: 'grocery' | 'catering' | 'proactive_restock'
                    status?: 'pending' | 'approved' | 'processing' | 'delivered' | 'cancelled'
                    created_at?: string
                    updated_at?: string
                }
            }
            location_products: {
                Row: {
                    id: number
                    location_id: number
                    product_id: number
                    par_level: number
                    current_stock: number
                    reorder_point: number
                    updated_at: string
                }
                Insert: {
                    id?: number
                    location_id: number
                    product_id: number
                    par_level?: number
                    current_stock?: number
                    reorder_point?: number
                    updated_at?: string
                }
                Update: {
                    id?: number
                    location_id?: number
                    product_id?: number
                    par_level?: number
                    current_stock?: number
                    reorder_point?: number
                    updated_at?: string
                }
            }
            order_dietary_flags: {
                Row: {
                    order_id: number
                    diet_code_id: number
                }
                Insert: {
                    order_id: number
                    diet_code_id: number
                }
                Update: {
                    order_id?: number
                    diet_code_id?: number
                }
            }
            catering_details: {
                Row: {
                    order_id: number
                    primary_diet_id: number | null
                    bed_number: string
                    patient_name: string | null
                    other_notes: string | null
                    created_at: string
                }
                Insert: {
                    order_id: number
                    primary_diet_id?: number | null
                    bed_number: string
                    patient_name?: string | null
                    other_notes?: string | null
                    created_at?: string
                }
                Update: {
                    order_id?: number
                    primary_diet_id?: number | null
                    bed_number?: string
                    patient_name?: string | null
                    other_notes?: string | null
                    created_at?: string
                }
            }
            templates: {
                Row: {
                    id: number
                    name: string
                    description: string | null
                    created_at: string
                }
                Insert: {
                    id?: number
                    name: string
                    description?: string | null
                    created_at?: string
                }
                Update: {
                    id?: number
                    name?: string
                    description?: string | null
                    created_at?: string
                }
            }
            template_items: {
                Row: {
                    id: number
                    template_id: number
                    product_id: number
                    default_par_level: number
                }
                Insert: {
                    id?: number
                    template_id: number
                    product_id: number
                    default_par_level?: number
                }
                Update: {
                    id?: number
                    template_id?: number
                    product_id?: number
                    default_par_level?: number
                }
            }
            announcements: {
                Row: {
                    id: number
                    title: string
                    message: string
                    start_date: string
                    end_date: string
                    location_id: number | null
                    created_by: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: number
                    title: string
                    message: string
                    start_date: string
                    end_date: string
                    location_id?: number | null
                    created_by?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: number
                    title?: string
                    message?: string
                    start_date?: string
                    end_date?: string
                    location_id?: number | null
                    created_by?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
        }
        Views: {
            report_stock_by_location: {
                Row: {
                    location_id: number
                    location_name: string | null
                    group_id: number | null
                    group_name: string | null
                    product_id: number
                    product_name: string | null
                    unit_size: string | null
                    category_id: number | null
                    category_name: string | null
                    current_stock: number
                    par_level: number
                    reorder_point: number
                    updated_at: string
                    storage_stock: number
                    storage_reorder_point: number
                }
            }
            report_stock_movements: {
                Row: {
                    movement_id: number
                    order_id: number
                    movement_type: Database['public']['Enums']['order_type']
                    order_status: Database['public']['Enums']['order_status']
                    location_id: number | null
                    location_name: string | null
                    product_id: number | null
                    product_name: string | null
                    unit_size: string | null
                    category_id: number | null
                    category_name: string | null
                    quantity: number
                    user_id: string | null
                    user_name: string | null
                    created_at: string
                    order_created_at: string
                }
            }
            report_orders_summary: {
                Row: {
                    order_id: number
                    created_at: string
                    updated_at: string
                    location_id: number | null
                    location_name: string | null
                    user_id: string | null
                    user_name: string | null
                    type: Database['public']['Enums']['order_type']
                    status: Database['public']['Enums']['order_status']
                    total_quantity: number
                    items_count: number
                    category_names: string[] | null
                }
            }
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            user_role: 'nurse' | 'kitchen_staff' | 'store_man' | 'admin'
            order_type: 'grocery' | 'catering' | 'proactive_restock'
            order_status: 'pending' | 'approved' | 'processing' | 'delivered' | 'cancelled'
            diet_category: 'primary_diet' | 'allergy' | 'dislike'
        }
    }
}
