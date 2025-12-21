'use client';

import { useMemo, useState } from 'react';
import { Database } from '@/types/database.types';
import { LocationTreeSelect, LocationTreeValue } from '@/components/admin/LocationTreeSelect';
import { AlertTriangle, TrendingDown, Search, Filter } from 'lucide-react';

type StockRow = Database['public']['Views']['report_stock_by_location']['Row'];
type Location = Database['public']['Tables']['locations']['Row'];
type LocationGroup = Database['public']['Tables']['location_groups']['Row'];
type Category = Database['public']['Tables']['product_categories']['Row'];

type GapAnalysisProps = {
    stockData: StockRow[];
    locations: Location[];
    groups: LocationGroup[];
    categories: Category[];
    onGenerateOrder?: (locationId: number, items: Array<{ productId: number; quantity: number }>) => void;
};

type AlertLevel = 'all' | 'critical' | 'low';

export function GapAnalysis({
    stockData,
    locations,
    groups,
    categories,
    onGenerateOrder,
}: GapAnalysisProps) {
    const [filters, setFilters] = useState<{
        locationSelection: LocationTreeValue;
        categoryId: string;
        alertLevel: AlertLevel;
        search: string;
    }>({
        locationSelection: 'all',
        categoryId: 'all',
        alertLevel: 'all',
        search: '',
    });

    const getAllChildGroupIds = (parentId: number, allGroups: LocationGroup[]): number[] => {
        const childIds: number[] = [];
        const directChildren = allGroups.filter(g => g.parent_group_id === parentId);
        directChildren.forEach(child => {
            childIds.push(child.id);
            childIds.push(...getAllChildGroupIds(child.id, allGroups));
        });
        return childIds;
    };

    const itemsNeedingRestock = useMemo(() => {
        let filtered = stockData.filter(row => row.current_stock < row.par_level);

        // Location filter
        if (filters.locationSelection === 'unassigned') {
            filtered = filtered.filter(row => !row.location_id);
        } else if (filters.locationSelection.startsWith('group:')) {
            const groupId = Number(filters.locationSelection.split(':')[1]);
            const childGroupIds = getAllChildGroupIds(groupId, groups);
            const allGroupIds = [groupId, ...childGroupIds];
            filtered = filtered.filter(row => row.group_id && allGroupIds.includes(row.group_id));
        } else if (filters.locationSelection.startsWith('location:')) {
            const locationId = Number(filters.locationSelection.split(':')[1]);
            filtered = filtered.filter(row => row.location_id === locationId);
        }

        // Category filter
        if (filters.categoryId !== 'all') {
            const categoryId = Number(filters.categoryId);
            filtered = filtered.filter(row => row.category_id === categoryId);
        }

        // Alert level filter
        if (filters.alertLevel === 'critical') {
            filtered = filtered.filter(row => row.current_stock < row.reorder_point);
        } else if (filters.alertLevel === 'low') {
            filtered = filtered.filter(
                row => row.current_stock >= row.reorder_point && row.current_stock < row.par_level
            );
        }

        // Search filter
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            filtered = filtered.filter(
                row =>
                    row.product_name?.toLowerCase().includes(searchLower) ||
                    row.location_name?.toLowerCase().includes(searchLower) ||
                    row.category_name?.toLowerCase().includes(searchLower)
            );
        }

        // Sort by gap (largest first)
        return filtered.sort((a, b) => {
            const gapA = a.par_level - a.current_stock;
            const gapB = b.par_level - b.current_stock;
            return gapB - gapA;
        });
    }, [stockData, filters, groups]);

    const getGap = (row: StockRow) => row.par_level - row.current_stock;
    const getStockPercentage = (row: StockRow) => {
        if (row.par_level === 0) return 0;
        return Math.min(100, (row.current_stock / row.par_level) * 100);
    };

    const getAlertLevel = (row: StockRow): 'critical' | 'low' => {
        if (row.current_stock < row.reorder_point) return 'critical';
        return 'low';
    };

    const groupedByLocation = useMemo(() => {
        const grouped = new Map<number, StockRow[]>();
        itemsNeedingRestock.forEach(row => {
            if (!row.location_id) return;
            if (!grouped.has(row.location_id)) {
                grouped.set(row.location_id, []);
            }
            grouped.get(row.location_id)!.push(row);
        });
        return Array.from(grouped.entries()).map(([locationId, rows]) => {
            const location = locations.find(l => l.id === locationId);
            return {
                locationId,
                locationName: location?.name || 'Unknown',
                items: rows,
                totalGap: rows.reduce((sum, r) => sum + getGap(r), 0),
            };
        });
    }, [itemsNeedingRestock, locations]);

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <LocationTreeSelect
                        groups={groups}
                        locations={locations}
                        value={filters.locationSelection}
                        onChange={value => setFilters(prev => ({ ...prev, locationSelection: value }))}
                        label="Location"
                    />
                    <div>
                        <label className="text-xs text-slate-500 mb-1 block">Category</label>
                        <select
                            value={filters.categoryId}
                            onChange={e => setFilters(prev => ({ ...prev, categoryId: e.target.value }))}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                        >
                            <option value="all">All Categories</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id.toString()}>
                                    {cat.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 mb-1 block">Alert Level</label>
                        <select
                            value={filters.alertLevel}
                            onChange={e => setFilters(prev => ({ ...prev, alertLevel: e.target.value as AlertLevel }))}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                        >
                            <option value="all">All Alerts</option>
                            <option value="critical">Critical (Below Reorder)</option>
                            <option value="low">Low (Below Par)</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 mb-1 block">Search</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                value={filters.search}
                                onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                placeholder="Search..."
                                className="w-full rounded-lg border border-slate-200 pl-10 pr-3 py-2 text-sm text-slate-700"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <h3 className="text-lg font-semibold text-slate-900">
                        {itemsNeedingRestock.length} Item{itemsNeedingRestock.length !== 1 ? 's' : ''} Need Restock
                    </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                        <span className="text-slate-600">Critical (Below Reorder): </span>
                        <span className="font-semibold text-red-600">
                            {itemsNeedingRestock.filter(r => r.current_stock < r.reorder_point).length}
                        </span>
                    </div>
                    <div>
                        <span className="text-slate-600">Low (Below Par): </span>
                        <span className="font-semibold text-amber-600">
                            {itemsNeedingRestock.filter(r => r.current_stock >= r.reorder_point).length}
                        </span>
                    </div>
                    <div>
                        <span className="text-slate-600">Total Gap: </span>
                        <span className="font-semibold text-slate-900">
                            {itemsNeedingRestock.reduce((sum, r) => sum + getGap(r), 0)} units
                        </span>
                    </div>
                </div>
            </div>

            {/* Items List */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Location</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Product</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Category</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Current</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Par Level</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Gap</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Stock Level</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {itemsNeedingRestock.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                                        No items need restocking
                                    </td>
                                </tr>
                            ) : (
                                itemsNeedingRestock.map((row, index) => {
                                    const gap = getGap(row);
                                    const percentage = getStockPercentage(row);
                                    const alertLevel = getAlertLevel(row);

                                    return (
                                        <tr key={`${row.location_id}-${row.product_id}-${index}`} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 text-sm text-slate-900">{row.location_name || 'N/A'}</td>
                                            <td className="px-4 py-3 text-sm font-medium text-slate-900">
                                                {row.product_name || 'N/A'}
                                                {row.unit_size ? ` (${row.unit_size})` : ''}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-600">{row.category_name || 'Uncategorized'}</td>
                                            <td className="px-4 py-3 text-sm text-right font-medium">{row.current_stock}</td>
                                            <td className="px-4 py-3 text-sm text-right text-slate-600">{row.par_level}</td>
                                            <td className="px-4 py-3 text-sm text-right">
                                                <span className="font-semibold text-red-600">+{gap}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full ${
                                                                alertLevel === 'critical' ? 'bg-red-500' : 'bg-amber-500'
                                                            }`}
                                                            style={{ width: `${percentage}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-slate-600 w-12 text-right">{Math.round(percentage)}%</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span
                                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                        alertLevel === 'critical'
                                                            ? 'bg-red-100 text-red-800 border border-red-200'
                                                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                                                    }`}
                                                >
                                                    {alertLevel === 'critical' ? 'Critical' : 'Low'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

