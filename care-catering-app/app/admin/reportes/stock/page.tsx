'use client';

import AdminLayout from '@/components/admin/AdminLayout';
import { ExportControls } from '@/components/admin/ExportControls';
import { createClient } from '@/utils/supabase/client';
import { Database } from '@/types/database.types';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Loader2, MapPin, PackageSearch, Filter, ArrowLeft } from 'lucide-react';
import { LocationTreeSelect, LocationTreeValue } from '@/components/admin/LocationTreeSelect';

type StockRow = Database['public']['Views']['report_stock_by_location']['Row'];
type Location = Database['public']['Tables']['locations']['Row'];
type Category = Database['public']['Tables']['product_categories']['Row'];
type LocationGroup = Database['public']['Tables']['location_groups']['Row'];

export default function ReporteStockPage() {
    const supabase = useMemo(() => createClient(), []);
    const [rows, setRows] = useState<StockRow[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [groups, setGroups] = useState<LocationGroup[]>([]);
    const [loading, setLoading] = useState(true);

    const [filters, setFilters] = useState<{
        locationSelection: LocationTreeValue;
        categoryId: string;
        search: string;
    }>({
        locationSelection: 'all',
        categoryId: 'all',
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
        const [{ data: locs }, { data: cats }, { data: groupData }] = await Promise.all([
            supabase.from('locations').select('*').order('name'),
            supabase.from('product_categories').select('*').order('name'),
            supabase.from('location_groups').select('*').order('name'),
        ]);
        if (locs) setLocations(locs);
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
        let query = supabase.from('report_stock_by_location').select('*');

        if (filters.locationSelection === 'unassigned') {
            // stock view has no location_id null rows; return empty
            setRows([]);
            setLoading(false);
            return;
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
        if (filters.search.trim()) {
            query = query.ilike('product_name', `%${filters.search.trim()}%`);
        }

        const { data, error } = await query.order('location_name').order('product_name');
        if (error) {
            console.error('Error loading stock report', error);
        }
        if (data) setRows(data);
        setLoading(false);
    };

    const columns = [
        { label: 'Location', accessor: (r: StockRow) => r.location_name || '' },
        { label: 'Product', accessor: (r: StockRow) => r.product_name || '' },
        { label: 'Category', accessor: (r: StockRow) => r.category_name || '—' },
        { label: 'On hand', accessor: (r: StockRow) => r.current_stock },
        { label: 'Par level', accessor: (r: StockRow) => r.par_level },
        { label: 'Reorder point', accessor: (r: StockRow) => r.reorder_point },
        { label: 'Central stock', accessor: (r: StockRow) => r.storage_stock },
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
                        <PackageSearch className="h-7 w-7 text-emerald-600" />
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Stock by location</h1>
                            <p className="text-slate-500 text-sm">Current inventory with par levels and reorder points.</p>
                        </div>
                    </div>
                    <ExportControls
                        title="Stock by location report"
                        filename="stock-report"
                        columns={columns}
                        data={rows}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-600">Filters</span>
                    </div>
                    <LocationTreeSelect
                        groups={groups}
                        locations={locations}
                        value={filters.locationSelection}
                        onChange={(val) => setFilters((f) => ({ ...f, locationSelection: val }))}
                        label="Location / group"
                    />
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
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Location</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Product</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Category</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">On hand</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Par</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Reorder</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Central stock</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                                            <div className="inline-flex items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Loading...
                                            </div>
                                        </td>
                                    </tr>
                                ) : rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                                            No data for the selected filters.
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map((row) => (
                                        <tr key={`${row.location_id}-${row.product_id}`}>
                                            <td className="px-4 py-3 text-sm text-slate-800 flex items-center gap-2">
                                                <MapPin className="h-4 w-4 text-slate-400" />
                                                {row.location_name}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-800">{row.product_name}</td>
                                            <td className="px-4 py-3 text-sm text-slate-600">{row.category_name || '—'}</td>
                                            <td className="px-4 py-3 text-sm text-slate-800">{row.current_stock}</td>
                                            <td className="px-4 py-3 text-sm text-slate-800">{row.par_level}</td>
                                            <td className="px-4 py-3 text-sm text-slate-800">{row.reorder_point}</td>
                                            <td className="px-4 py-3 text-sm text-slate-800">{row.storage_stock}</td>
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

