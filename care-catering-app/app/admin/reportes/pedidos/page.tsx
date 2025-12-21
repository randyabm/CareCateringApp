'use client';

import AdminLayout from '@/components/admin/AdminLayout';
import { ExportControls } from '@/components/admin/ExportControls';
import { createClient } from '@/utils/supabase/client';
import { Database } from '@/types/database.types';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Calendar, Filter, Loader2, ShoppingBag, UserCircle2, MapPin, ArrowLeft } from 'lucide-react';
import { LocationTreeSelect, LocationTreeValue } from '@/components/admin/LocationTreeSelect';

type OrderRow = Database['public']['Views']['report_orders_summary']['Row'];
type Location = Database['public']['Tables']['locations']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type ProductCategory = Database['public']['Tables']['product_categories']['Row'];
type LocationGroup = Database['public']['Tables']['location_groups']['Row'];

const ORDER_TYPES: Database['public']['Enums']['order_type'][] = ['grocery', 'catering', 'proactive_restock'];
const ORDER_STATUS: Database['public']['Enums']['order_status'][] = ['pending', 'approved', 'processing', 'delivered', 'cancelled'];

export default function ReportePedidosPage() {
    const supabase = useMemo(() => createClient(), []);
    const [rows, setRows] = useState<OrderRow[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [users, setUsers] = useState<Profile[]>([]);
    const [categories, setCategories] = useState<ProductCategory[]>([]);
    const [groups, setGroups] = useState<LocationGroup[]>([]);
    const [loading, setLoading] = useState(true);

    const [filters, setFilters] = useState<{
        dateFrom: string;
        dateTo: string;
        locationSelection: LocationTreeValue;
        orderType: string;
        status: string;
        userId: string;
        categoryId: string;
    }>({
        dateFrom: '',
        dateTo: '',
        locationSelection: 'all',
        orderType: 'all',
        status: 'all',
        userId: 'all',
        categoryId: 'all',
    });

    useEffect(() => {
        fetchFilters();
    }, []);

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters]);

    const fetchFilters = async () => {
        const [{ data: locs }, { data: profs }, { data: cats }, { data: groupData }] = await Promise.all([
            supabase.from('locations').select('*').order('name'),
            supabase.from('profiles').select('*').order('full_name'),
            supabase.from('product_categories').select('*').order('name'),
            supabase.from('location_groups').select('*').order('name'),
        ]);
        if (locs) setLocations(locs);
        if (profs) setUsers(profs);
        if (cats) setCategories(cats);
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
        let query = supabase.from('report_orders_summary').select('*');

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
        if (filters.orderType !== 'all') {
            query = query.eq('type', filters.orderType);
        }
        if (filters.status !== 'all') {
            query = query.eq('status', filters.status);
        }
        if (filters.userId !== 'all') {
            query = query.eq('user_id', filters.userId);
        }
        if (filters.categoryId !== 'all') {
            const categoryName = categories.find((c) => String(c.id) === filters.categoryId)?.name;
            if (categoryName) {
                query = query.contains('category_names', [categoryName]);
            }
        }
        if (filters.dateFrom) {
            query = query.gte('created_at', filters.dateFrom);
        }
        if (filters.dateTo) {
            const end = `${filters.dateTo}T23:59:59`;
            query = query.lte('created_at', end);
        }

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) {
            console.error('Error loading orders report', error);
        }
        if (data) setRows(data);
        setLoading(false);
    };

    const columns = [
        { label: 'Date', accessor: (r: OrderRow) => new Date(r.created_at).toLocaleString() },
        { label: 'Order', accessor: (r: OrderRow) => r.order_id },
        { label: 'Type', accessor: (r: OrderRow) => r.type },
        { label: 'Status', accessor: (r: OrderRow) => r.status },
        { label: 'Location', accessor: (r: OrderRow) => r.location_name || '' },
        { label: 'User', accessor: (r: OrderRow) => r.user_name || r.user_id || '' },
        { label: 'Items', accessor: (r: OrderRow) => r.items_count },
        { label: 'Total quantity', accessor: (r: OrderRow) => r.total_quantity },
        {
            label: 'Categories',
            accessor: (r: OrderRow) => (r.category_names && r.category_names.length > 0 ? r.category_names.join(', ') : '—'),
        },
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
                        <ShoppingBag className="h-7 w-7 text-blue-600" />
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Orders / Sales</h1>
                            <p className="text-slate-500 text-sm">Orders by date, location, and category with totals.</p>
                        </div>
                    </div>
                    <ExportControls
                        title="Orders / sales report"
                        filename="orders-report"
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
                        <label className="text-xs text-slate-500 mb-1">Type</label>
                        <select
                            value={filters.orderType}
                            onChange={(e) => setFilters((f) => ({ ...f, orderType: e.target.value }))}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                        >
                            <option value="all">All</option>
                            {ORDER_TYPES.map((t) => (
                                <option key={t} value={t}>
                                    {t}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-xs text-slate-500 mb-1">Status</label>
                        <select
                            value={filters.status}
                            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                        >
                            <option value="all">All</option>
                            {ORDER_STATUS.map((s) => (
                                <option key={s} value={s}>
                                    {s}
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
                        <label className="text-xs text-slate-500 mb-1">Category</label>
                        <select
                            value={filters.categoryId}
                            onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                        >
                            <option value="all">All</option>
                            {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Date</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Order</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Type</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Location</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">User</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Items</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Quantity</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Categories</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                                            <div className="inline-flex items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Loading...
                                            </div>
                                        </td>
                                    </tr>
                                ) : rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-4 py-6 text-center text-slate-400">
                                            No orders for the selected filters.
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map((row) => (
                                        <tr key={row.order_id}>
                                            <td className="px-4 py-3 text-sm text-slate-800">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="h-4 w-4 text-slate-400" />
                                                    {new Date(row.created_at).toLocaleString()}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-800">#{row.order_id}</td>
                                            <td className="px-4 py-3 text-sm text-slate-800 uppercase">{row.type}</td>
                                            <td className="px-4 py-3 text-sm text-slate-600">{row.status}</td>
                                            <td className="px-4 py-3 text-sm text-slate-800 flex items-center gap-2">
                                                <MapPin className="h-4 w-4 text-slate-400" />
                                                {row.location_name || '—'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-800 flex items-center gap-2">
                                                <UserCircle2 className="h-4 w-4 text-slate-400" />
                                                {row.user_name || row.user_id || '—'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-800">{row.items_count}</td>
                                            <td className="px-4 py-3 text-sm text-slate-800">{row.total_quantity}</td>
                                            <td className="px-4 py-3 text-sm text-slate-600">
                                                {row.category_names && row.category_names.length > 0
                                                    ? row.category_names.join(', ')
                                                    : '—'}
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

