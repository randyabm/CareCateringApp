'use client';

import AdminLayout from '@/components/admin/AdminLayout';
import { ExportControls } from '@/components/admin/ExportControls';
import { createClient } from '@/utils/supabase/client';
import { Database } from '@/types/database.types';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Calendar, Filter, Loader2, MoveRight, UserCircle2, PackageOpen, MapPin, ArrowLeft } from 'lucide-react';
import { LocationTreeSelect, LocationTreeValue } from '@/components/admin/LocationTreeSelect';

type MovementRow = Database['public']['Views']['report_stock_movements']['Row'];
type Location = Database['public']['Tables']['locations']['Row'];
type Category = Database['public']['Tables']['product_categories']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type LocationGroup = Database['public']['Tables']['location_groups']['Row'];

export default function ReporteMovimientosPage() {
    const supabase = useMemo(() => createClient(), []);
    const [rows, setRows] = useState<MovementRow[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [users, setUsers] = useState<Profile[]>([]);
    const [groups, setGroups] = useState<LocationGroup[]>([]);
    const [loading, setLoading] = useState(true);

    const [filters, setFilters] = useState<{
        dateFrom: string;
        dateTo: string;
        locationSelection: LocationTreeValue;
        categoryId: string;
        userId: string;
        search: string;
    }>({
        dateFrom: '',
        dateTo: '',
        locationSelection: 'all',
        categoryId: 'all',
        userId: 'all',
        search: '',
    });

    useEffect(() => {
        fetchFilters();
    }, []);

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters]);

    const fetchFilters = async () => {
        const [{ data: locs }, { data: cats }, { data: profs }, { data: groupData }] = await Promise.all([
            supabase.from('locations').select('*').order('name'),
            supabase.from('product_categories').select('*').order('name'),
            supabase.from('profiles').select('*').order('full_name'),
            supabase.from('location_groups').select('*').order('name'),
        ]);
        if (locs) setLocations(locs);
        if (cats) setCategories(cats);
        if (profs) setUsers(profs);
        if (groupData) setGroups(groupData);
    };

    const getAllChildGroupIds = (parentId: number, allGroups: LocationGroup[]): number[] => {
        const childIds: number[] = [];
        const directChildren = allGroups.filter(g => g.parent_group_id === parentId);
        directChildren.forEach(child => {
            childIds.push(child.id);
            childIds.push(...getAllChildGroupIds(child.id, allGroups));
        });
        return childIds;
    };

    const getGroupPath = (groupId: number, allGroups: LocationGroup[]): string => {
        const group = allGroups.find(g => g.id === groupId);
        if (!group) return '';
        const path: string[] = [group.name];
        let current = group;
        while (current.parent_group_id) {
            const parent = allGroups.find(g => g.id === current.parent_group_id);
            if (!parent) break;
            path.unshift(parent.name);
            current = parent;
        }
        return path.join(' > ');
    };

    const buildGroupOptions = () => {
        return [...groups]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(g => {
                const path = getGroupPath(g.id, groups);
                const depth = path.split(' > ').length - 1;
                const prefix = depth > 0 ? '— '.repeat(depth) : '';
                return { value: g.id.toString(), label: `${prefix}${path}` };
            });
    };

    const fetchData = async () => {
        setLoading(true);
        let query = supabase.from('report_stock_movements').select('*');

        if (filters.locationSelection === 'unassigned') {
            query = query.is('location_id', null);
        } else if (filters.locationSelection === 'all') {
            // no-op
        } else if (filters.locationSelection.startsWith('group:')) {
            const selectedId = Number(filters.locationSelection.split(':')[1]);
            const childIds = getAllChildGroupIds(selectedId, groups);
            const allowedGroupIds = [selectedId, ...childIds];
            const allowedLocationIds = locations
                .filter(loc => loc.group_id !== null && allowedGroupIds.includes(loc.group_id))
                .map(loc => loc.id);
            if (allowedLocationIds.length === 0) {
                setRows([]);
                setLoading(false);
                return;
            }
            query = query.in('location_id', allowedLocationIds);
        } else if (filters.locationSelection.startsWith('location:')) {
            const locId = Number(filters.locationSelection.split(':')[1]);
            query = query.eq('location_id', locId);
        }
        if (filters.categoryId !== 'all') {
            query = query.eq('category_id', Number(filters.categoryId));
        }
        if (filters.userId !== 'all') {
            query = query.eq('user_id', filters.userId);
        }
        if (filters.search.trim()) {
            query = query.ilike('product_name', `%${filters.search.trim()}%`);
        }
        if (filters.dateFrom) {
            query = query.gte('created_at', filters.dateFrom);
        }
        if (filters.dateTo) {
            // include end of day
            const end = `${filters.dateTo}T23:59:59`;
            query = query.lte('created_at', end);
        }

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) {
            console.error('Error loading stock movements', error);
        }
        if (data) setRows(data);
        setLoading(false);
    };

    const columns = [
        { label: 'Date', accessor: (r: MovementRow) => new Date(r.created_at).toLocaleString() },
        { label: 'Movement', accessor: (r: MovementRow) => r.movement_type },
        { label: 'Status', accessor: (r: MovementRow) => r.order_status },
        { label: 'Location', accessor: (r: MovementRow) => r.location_name || '' },
        { label: 'Product', accessor: (r: MovementRow) => r.product_name || '' },
        { label: 'Category', accessor: (r: MovementRow) => r.category_name || '—' },
        { label: 'Quantity', accessor: (r: MovementRow) => r.quantity },
        { label: 'User', accessor: (r: MovementRow) => r.user_name || r.user_id || '' },
    ];

    return (
        <AdminLayout>
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <Link
                        href="/admin/reportes"
                        className="inline-flex items-center gap-2 text-sm text-emerald-700 hover:text-emerald-800"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to reports
                    </Link>
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <MoveRight className="h-7 w-7 text-amber-600" />
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Stock movements</h1>
                            <p className="text-slate-500 text-sm">Orders and adjustments by date, user, and product.</p>
                        </div>
                    </div>
                    <ExportControls
                        title="Stock movements report"
                        filename="stock-movements-report"
                        columns={columns}
                        data={rows}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 col-span-1 md:col-span-6">
                        <Filter className="h-4 w-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-600">Filters</span>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-xs text-slate-500 mb-1">From</label>
                        <input
                            type="date"
                            value={filters.dateFrom}
                            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                        />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-xs text-slate-500 mb-1">To</label>
                        <input
                            type="date"
                            value={filters.dateTo}
                            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                        />
                    </div>
                    <div className="flex flex-col">
                        <LocationTreeSelect
                            groups={groups}
                            locations={locations}
                            value={filters.locationSelection}
                            onChange={(val) => setFilters((f) => ({ ...f, locationSelection: val }))}
                            label="Location / group"
                        />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-xs text-slate-500 mb-1">Category</label>
                        <select
                            value={filters.categoryId}
                            onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                        >
                            <option value="all">All</option>
                            {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                    {cat.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-xs text-slate-500 mb-1">User</label>
                        <select
                            value={filters.userId}
                            onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value }))}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                        >
                            <option value="all">All</option>
                            {users.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.full_name || u.id}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-xs text-slate-500 mb-1">Product</label>
                        <input
                            value={filters.search}
                            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                            placeholder="Search product"
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                        />
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Date</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Movement</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Location</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Product</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Category</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Quantity</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">User</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                                            <div className="inline-flex items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Loading...
                                            </div>
                                        </td>
                                    </tr>
                                ) : rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                                            No movements for the selected filters.
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map((row) => (
                                        <tr key={row.movement_id}>
                                            <td className="px-4 py-3 text-sm text-slate-800">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="h-4 w-4 text-slate-400" />
                                                    {new Date(row.created_at).toLocaleString()}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-800 uppercase tracking-wide">
                                                {row.movement_type}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-600">{row.order_status}</td>
                                            <td className="px-4 py-3 text-sm text-slate-800 flex items-center gap-2">
                                                <MapPin className="h-4 w-4 text-slate-400" />
                                                {row.location_name || '—'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-800 flex items-center gap-2">
                                                <PackageOpen className="h-4 w-4 text-slate-400" />
                                                {row.product_name || '—'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-600">{row.category_name || '—'}</td>
                                            <td className="px-4 py-3 text-sm text-slate-800">{row.quantity}</td>
                                            <td className="px-4 py-3 text-sm text-slate-800 flex items-center gap-2">
                                                <UserCircle2 className="h-4 w-4 text-slate-400" />
                                                {row.user_name || row.user_id || '—'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}

