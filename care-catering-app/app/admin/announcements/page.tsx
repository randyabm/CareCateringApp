'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import type { Database } from '@/types/database.types';
import { Megaphone, Plus, Pencil, Trash2, Loader2, CalendarRange } from 'lucide-react';

type Announcement = Database['public']['Tables']['announcements']['Row'];
type Location = Database['public']['Tables']['locations']['Row'];
type LocationBasic = Pick<Location, 'id' | 'name'>;

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function AnnouncementsPage() {
    const supabase = useMemo(() => createClient(), []);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [locations, setLocations] = useState<LocationBasic[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Announcement | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [form, setForm] = useState({
        title: '',
        message: '',
        startDate: todayStr(),
        endDate: todayStr(),
        locationId: '',
    });

    const resetForm = () => {
        setForm({
            title: '',
            message: '',
            startDate: todayStr(),
            endDate: todayStr(),
            locationId: '',
        });
        setEditing(null);
    };

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [{ data: announcementRows, error: annError }, { data: locRows, error: locError }] = await Promise.all([
                supabase.from('announcements').select('*').order('start_date', { ascending: false }),
                supabase.from('locations').select('id, name').order('name'),
            ]);

            if (annError) throw annError;
            if (locError) throw locError;

            setAnnouncements(announcementRows || []);
            setLocations(locRows || []);
        } catch (err: any) {
            console.error(err);
            setError('Failed to load announcements.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            const { title, message, startDate, endDate, locationId } = form;
            if (!title.trim() || !message.trim()) {
                setError('Title and message are required.');
                return;
            }
            if (startDate > endDate) {
                setError('Start date must be before end date.');
                return;
            }

            const payload = {
                title: title.trim(),
                message: message.trim(),
                start_date: startDate,
                end_date: endDate,
                location_id: locationId ? Number(locationId) : null,
            };

            if (editing) {
                const { error: updateError } = await supabase.from('announcements').update(payload).eq('id', editing.id);
                if (updateError) throw updateError;
            } else {
                const {
                    data: { user },
                } = await supabase.auth.getUser();
                const { error: insertError } = await supabase
                    .from('announcements')
                    .insert({ ...payload, created_by: user?.id ?? null });
                if (insertError) throw insertError;
            }

            setModalOpen(false);
            resetForm();
            await loadData();
        } catch (err: any) {
            console.error(err);
            setError('Could not save announcement.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        setDeletingId(id);
        setError(null);
        try {
            const { error: deleteError } = await supabase.from('announcements').delete().eq('id', id);
            if (deleteError) throw deleteError;
            await loadData();
        } catch (err: any) {
            console.error(err);
            setError('Could not delete announcement.');
        } finally {
            setDeletingId(null);
        }
    };

    const openNew = () => {
        resetForm();
        setModalOpen(true);
    };

    const openEdit = (announcement: Announcement) => {
        setEditing(announcement);
        setForm({
            title: announcement.title,
            message: announcement.message,
            startDate: announcement.start_date,
            endDate: announcement.end_date,
            locationId: announcement.location_id ? String(announcement.location_id) : '',
        });
        setModalOpen(true);
    };

    const today = todayStr();

    return (
        <AdminLayout>
            <div className="max-w-6xl mx-auto">
                <header className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Megaphone className="h-7 w-7 text-emerald-600" />
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Announcements</h1>
                            <p className="text-slate-500 text-sm">Share notices with store teams by date and location.</p>
                        </div>
                    </div>
                    <button
                        onClick={openNew}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-emerald-700"
                    >
                        <Plus className="h-4 w-4" />
                        New announcement
                    </button>
                </header>

                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
                    {error && <div className="mb-4 rounded-lg bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>}
                    {loading ? (
                        <div className="flex items-center gap-2 text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading announcements...
                        </div>
                    ) : announcements.length === 0 ? (
                        <div className="text-slate-500 text-sm">No announcements yet.</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {announcements.map(item => {
                                const isActive = item.start_date <= today && item.end_date >= today;
                                const locName = item.location_id
                                    ? locations.find(l => l.id === item.location_id)?.name || 'Location'
                                    : 'All locations';
                                return (
                                    <div key={item.id} className="border border-slate-200 rounded-lg p-4 hover:border-emerald-200 transition">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                                                    {isActive ? 'Active' : 'Scheduled'}
                                                </p>
                                                <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                                                <p className="text-sm text-slate-600 whitespace-pre-line mt-1">{item.message}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => openEdit(item)}
                                                    className="p-2 rounded-md border border-slate-200 text-slate-500 hover:text-emerald-700 hover:border-emerald-200"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    disabled={deletingId === item.id}
                                                    className="p-2 rounded-md border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 disabled:opacity-50"
                                                >
                                                    {deletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                                            <CalendarRange className="h-4 w-4" />
                                            <span>
                                                {item.start_date} → {item.end_date}
                                            </span>
                                            <span className="mx-2">•</span>
                                            <span>{locName}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {modalOpen && (
                    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
                        <div className="w-full max-w-xl rounded-xl bg-white shadow-xl border border-slate-200 p-6 relative">
                            <h2 className="text-lg font-semibold text-slate-900 mb-4">
                                {editing ? 'Edit announcement' : 'New announcement'}
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm text-slate-600 block mb-1">Title</label>
                                    <input
                                        type="text"
                                        value={form.title}
                                        onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                                        placeholder="e.g., Ward A inventory freeze"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-slate-600 block mb-1">Message</label>
                                    <textarea
                                        rows={4}
                                        value={form.message}
                                        onChange={e => setForm(prev => ({ ...prev, message: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                                        placeholder="Share details, dates, contacts, etc."
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm text-slate-600 block mb-1">Start date</label>
                                        <input
                                            type="date"
                                            value={form.startDate}
                                            onChange={e => setForm(prev => ({ ...prev, startDate: e.target.value }))}
                                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm text-slate-600 block mb-1">End date</label>
                                        <input
                                            type="date"
                                            value={form.endDate}
                                            onChange={e => setForm(prev => ({ ...prev, endDate: e.target.value }))}
                                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm text-slate-600 block mb-1">Location (optional)</label>
                                    <select
                                        value={form.locationId}
                                        onChange={e => setForm(prev => ({ ...prev, locationId: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                                    >
                                        <option value="">All locations</option>
                                        {locations.map(loc => (
                                            <option key={loc.id} value={loc.id}>
                                                {loc.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="mt-6 flex items-center justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setModalOpen(false);
                                        resetForm();
                                    }}
                                    className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
                                    disabled={saving}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                                >
                                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {editing ? 'Save changes' : 'Create announcement'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}


