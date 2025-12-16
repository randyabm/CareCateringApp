'use client';

import { useMemo, useState } from 'react';
import { Database } from '@/types/database.types';
import { LocationTreeSelect, LocationTreeValue } from '@/components/admin/LocationTreeSelect';
import { createClient } from '@/utils/supabase/client';
import { Loader2, Edit2, Check, X, Search, Filter } from 'lucide-react';

type StockRow = Database['public']['Views']['report_stock_by_location']['Row'];
type Location = Database['public']['Tables']['locations']['Row'];
type LocationGroup = Database['public']['Tables']['location_groups']['Row'];
type Category = Database['public']['Tables']['product_categories']['Row'];

type InventoryTableProps = {
    stockData: StockRow[];
    locations: Location[];
    groups: LocationGroup[];
    categories: Category[];
    onStockUpdate?: (locationId: number, productId: number, newStock: number) => Promise<void>;
};

export function InventoryTable({
    stockData,
    locations,
    groups,
    categories,
    onStockUpdate,
}: InventoryTableProps) {
    const supabase = createClient();
    const [editingCell, setEditingCell] = useState<{ locationId: number; productId: number } | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const [updating, setUpdating] = useState(false);
    const [filters, setFilters] = useState<{
        locationSelection: LocationTreeValue;
        categoryId: string;
        search: string;
    }>({
        locationSelection: 'all',
        categoryId: 'all',
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

    const filteredData = useMemo(() => {
        let filtered = [...stockData];

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

        return filtered;
    }, [stockData, filters, groups]);

    const getStatusColor = (row: StockRow) => {
        if (row.current_stock < row.reorder_point) {
            return 'bg-red-50 text-red-700 border-red-200';
        }
        if (row.current_stock < row.par_level) {
            return 'bg-amber-50 text-amber-700 border-amber-200';
        }
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    };

    const getStatusText = (row: StockRow) => {
        if (row.current_stock < row.reorder_point) {
            return 'Critical';
        }
        if (row.current_stock < row.par_level) {
            return 'Low';
        }
        return 'OK';
    };

    const handleEditStart = (row: StockRow) => {
        setEditingCell({ locationId: row.location_id, productId: row.product_id });
        setEditValue(row.current_stock.toString());
    };

    const handleEditCancel = () => {
        setEditingCell(null);
        setEditValue('');
    };

    const handleEditSave = async (row: StockRow) => {
        const newStock = parseInt(editValue, 10);
        if (isNaN(newStock) || newStock < 0) {
            alert('Please enter a valid non-negative number');
            return;
        }

        setUpdating(true);
        try {
            if (onStockUpdate) {
                await onStockUpdate(row.location_id, row.product_id, newStock);
            } else {
                // Default update logic
                const { error } = await supabase
                    .from('location_products')
                    .update({ current_stock: newStock })
                    .eq('location_id', row.location_id)
                    .eq('product_id', row.product_id);

                if (error) throw error;
            }
            setEditingCell(null);
            setEditValue('');
        } catch (error) {
            console.error('Error updating stock:', error);
            alert('Failed to update stock. Please try again.');
        } finally {
            setUpdating(false);
        }
    };

    const gap = (row: StockRow) => row.par_level - row.current_stock;

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
            {/* Filters */}
            <div className="p-4 border-b border-slate-200 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <LocationTreeSelect
                        groups={groups}
                        locations={locations}
                        value={filters.locationSelection}
                        onChange={value => setFilters(prev => ({ ...prev, locationSelection: value }))}
                        label="Filter by Location"
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
                        <label className="text-xs text-slate-500 mb-1 block">Search</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                value={filters.search}
                                onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                placeholder="Search products..."
                                className="w-full rounded-lg border border-slate-200 pl-10 pr-3 py-2 text-sm text-slate-700"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Location</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Product</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Category</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Current Stock</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Par Level</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Reorder Point</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Gap</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">Status</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {filteredData.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                                    No inventory data found
                                </td>
                            </tr>
                        ) : (
                            filteredData.map((row, index) => {
                                const isEditing =
                                    editingCell?.locationId === row.location_id &&
                                    editingCell?.productId === row.product_id;
                                const rowGap = gap(row);

                                return (
                                    <tr key={`${row.location_id}-${row.product_id}-${index}`} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 text-sm text-slate-900">{row.location_name || 'N/A'}</td>
                                        <td className="px-4 py-3 text-sm font-medium text-slate-900">
                                            {row.product_name || 'N/A'}
                                            {row.unit_size ? ` (${row.unit_size})` : ''}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-600">{row.category_name || 'Uncategorized'}</td>
                                        <td className="px-4 py-3 text-sm text-right">
                                            {isEditing ? (
                                                <div className="flex items-center gap-2 justify-end">
                                                    <input
                                                        type="number"
                                                        value={editValue}
                                                        onChange={e => setEditValue(e.target.value)}
                                                        className="w-24 px-2 py-1 border border-slate-300 rounded text-sm"
                                                        min="0"
                                                        autoFocus
                                                        disabled={updating}
                                                    />
                                                    <button
                                                        onClick={() => handleEditSave(row)}
                                                        disabled={updating}
                                                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                                    >
                                                        {updating ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Check className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={handleEditCancel}
                                                        disabled={updating}
                                                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="font-medium">{row.current_stock}</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right text-slate-600">{row.par_level}</td>
                                        <td className="px-4 py-3 text-sm text-right text-slate-600">{row.reorder_point}</td>
                                        <td className="px-4 py-3 text-sm text-right">
                                            <span className={`font-medium ${rowGap > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                {rowGap > 0 ? `+${rowGap}` : rowGap}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span
                                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(row)}`}
                                            >
                                                {getStatusText(row)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {!isEditing && (
                                                <button
                                                    onClick={() => handleEditStart(row)}
                                                    className="p-1.5 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                                                    title="Edit stock"
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

