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
                    updated_at: string
                }
                Insert: {
                    id?: number
                    location_id: number
                    product_id: number
                    par_level?: number
                    updated_at?: string
                }
                Update: {
                    id?: number
                    location_id?: number
                    product_id?: number
                    par_level?: number
                    updated_at?: string
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
        }
        Views: {
            [_ in never]: never
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
