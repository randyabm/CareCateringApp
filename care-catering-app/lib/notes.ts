'use client';

import { createClient } from '@/utils/supabase/client';
import type { Database } from '@/types/database.types';

export type NoteRow = Database['public']['Tables']['notes']['Row'];

type ListParams = {
    locationId?: number | null;
    includeGeneral?: boolean;
};

type CreateParams = {
    message: string;
    locationId?: number | null;
    color?: string | null;
    pinned?: boolean;
    expiresAt?: string | null;
};

const baseOrder = (query: any) =>
    query
        .order('pinned', { ascending: false })
        .order('resolved', { ascending: true })
        .order('created_at', { ascending: false });

export async function listNotes({ locationId, includeGeneral = true }: ListParams) {
    const supabase = createClient();
    let query = supabase.from('notes').select('*');

    const filters: string[] = [];
    if (locationId !== undefined && locationId !== null) {
        filters.push(`location_id.eq.${locationId}`);
    }
    if (includeGeneral) {
        filters.push('location_id.is.null');
    }

    if (filters.length > 0) {
        query = query.or(filters.join(','));
    }

    return baseOrder(query);
}

export async function createNote({ message, locationId = null, color = null, pinned = false, expiresAt = null }: CreateParams) {
    const supabase = createClient();
    return supabase
        .from('notes')
        .insert({
            message,
            location_id: locationId,
            color,
            pinned,
            expires_at: expiresAt,
        })
        .select('*')
        .single();
}

export async function togglePinned(id: number, pinned: boolean) {
    const supabase = createClient();
    return supabase.from('notes').update({ pinned }).eq('id', id).select('*').single();
}

export async function toggleResolved(id: number, resolved: boolean) {
    const supabase = createClient();
    return supabase.from('notes').update({ resolved }).eq('id', id).select('*').single();
}

export async function deleteNote(id: number) {
    const supabase = createClient();
    return supabase.from('notes').delete().eq('id', id);
}

