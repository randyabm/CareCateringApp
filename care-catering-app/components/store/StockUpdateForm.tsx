'use client';

import { useState, useMemo } from 'react';
import { Database } from '@/types/database.types';
import { createClient } from '@/utils/supabase/client';
import { LocationTreeSelect, LocationTreeValue } from '@/components/admin/LocationTreeSelect';
import { Loader2, Save, Plus, Minus, CheckCircle, XCircle } from 'lucide-react';

type StockRow = Database['public']['Views']['report_stock_by_location']['Row'];
type Location = Database['public']['Tables']['locations']['Row'];
type LocationGroup = Database['public']['Tables']['location_groups']['Row'];

type StockUpdateFormProps = {
    stockData: StockRow[];
    locations: Location[];
    groups: LocationGroup[];
    onUpdateComplete?: () => void;
};

type StockEdit = {
    locationId: number;
    productId: number;
    currentValue: number;
    newValue: number;
};

export function StockUpdateForm({ stockData, locations, groups, onUpdateComplete }: StockUpdateFormProps) {
    const supabase = createClient();
    const [selectedLocation, setSelectedLocation] = useState<LocationTreeValue>('all');
    const [edits, setEdits] = useState<Map<string, StockEdit>>(new Map());
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const locationProducts = useMemo(() => {
        if (selectedLocation === 'all' || selectedLocation === 'unassigned') {
            return [];
        }

        let locationId: number | null = null;
        if (selectedLocation.startsWith('location:')) {
            locationId = Number(selectedLocation.split(':')[1]);
        }

        if (!locationId) return [];

        return stockData.filter(row => row.location_id === locationId);
    }, [stockData, selectedLocation]);

    const updateEdit = (locationId: number, productId: number, newValue: number) => {
        const key = `${locationId}-${productId}`;
        const row = locationProducts.find(r => r.location_id === locationId && r.product_id === productId);
        if (!row) return;

        const edit: StockEdit = {
            locationId,
            productId,
            currentValue: row.current_stock,
            newValue: Math.max(0, newValue),
        };

        setEdits(prev => {
            const next = new Map(prev);
            if (newValue === row.current_stock) {
                next.delete(key);
            } else {
                next.set(key, edit);
            }
            return next;
        });
        setSaved(false);
        setError(null);
    };

    const incrementStock = (locationId: number, productId: number) => {
        const key = `${locationId}-${productId}`;
        const currentEdit = edits.get(key);
        const row = locationProducts.find(r => r.location_id === locationId && r.product_id === productId);
        const currentValue = currentEdit?.newValue ?? row?.current_stock ?? 0;
        updateEdit(locationId, productId, currentValue + 1);
    };

    const decrementStock = (locationId: number, productId: number) => {
        const key = `${locationId}-${productId}`;
        const currentEdit = edits.get(key);
        const row = locationProducts.find(r => r.location_id === locationId && r.product_id === productId);
        const currentValue = currentEdit?.newValue ?? row?.current_stock ?? 0;
        updateEdit(locationId, productId, Math.max(0, currentValue - 1));
    };

    const saveAll = async () => {
        if (edits.size === 0) {
            setError('No changes to save');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const updates = Array.from(edits.values());
            const promises = updates.map(edit =>
                supabase
                    .from('location_products')
                    .update({ current_stock: edit.newValue })
                    .eq('location_id', edit.locationId)
                    .eq('product_id', edit.productId)
            );

            const results = await Promise.all(promises);
            const errors = results.filter(r => r.error);

            if (errors.length > 0) {
                throw new Error(`Failed to update ${errors.length} item(s)`);
            }

            setEdits(new Map());
            setSaved(true);
            if (onUpdateComplete) {
                onUpdateComplete();
            }
        } catch (err) {
            console.error('Error saving stock updates:', err);
            setError(err instanceof Error ? err.message : 'Failed to save updates');
        } finally {
            setSaving(false);
        }
    };

    const selectedLocationName = useMemo(() => {
        if (selectedLocation === 'all' || selectedLocation === 'unassigned') return null;
        if (selectedLocation.startsWith('location:')) {
            const locationId = Number(selectedLocation.split(':')[1]);
            return locations.find(l => l.id === locationId)?.name || null;
        }
        return null;
    }, [selectedLocation, locations]);

    return (
        <div className="space-y-6">
            {/* Location Selection */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Bulk Stock Update</h3>
                <LocationTreeSelect
                    groups={groups}
                    locations={locations}
                    value={selectedLocation}
                    onChange={setSelectedLocation}
                    label="Select Location"
                />
                <p className="text-sm text-slate-500 mt-2">
                    Select a location to update stock levels for all products at that location.
                </p>
            </div>

            {/* Error/Success Messages */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2 text-red-800">
                    <XCircle className="h-5 w-5" />
                    <span>{error}</span>
                </div>
            )}

            {saved && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-2 text-emerald-800">
                    <CheckCircle className="h-5 w-5" />
                    <span>Stock levels updated successfully</span>
                </div>
            )}

            {/* Products List */}
            {selectedLocationName && locationProducts.length > 0 && (
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                        <h4 className="font-semibold text-slate-900">{selectedLocationName}</h4>
                        {edits.size > 0 && (
                            <button
                                onClick={saveAll}
                                disabled={saving}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="h-4 w-4" />
                                        Save {edits.size} Change{edits.size !== 1 ? 's' : ''}
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                    <div className="divide-y divide-slate-200">
                        {locationProducts.map((row, index) => {
                            const key = `${row.location_id}-${row.product_id}`;
                            const edit = edits.get(key);
                            const displayValue = edit?.newValue ?? row.current_stock;

                            return (
                                <div
                                    key={`${row.location_id}-${row.product_id}-${index}`}
                                    className="p-4 hover:bg-slate-50 transition-colors"
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <h5 className="font-medium text-slate-900 truncate">{row.product_name || 'Unknown'}</h5>
                                            <p className="text-sm text-slate-500">
                                                Par Level: {row.par_level} • Reorder Point: {row.reorder_point}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => decrementStock(row.location_id, row.product_id)}
                                                    disabled={saving || displayValue === 0}
                                                    className="p-2 rounded-lg border border-slate-300 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                    aria-label="Decrease stock"
                                                >
                                                    <Minus className="h-4 w-4 text-slate-700" />
                                                </button>
                                                <input
                                                    type="number"
                                                    value={displayValue}
                                                    onChange={e => {
                                                        const val = parseInt(e.target.value, 10) || 0;
                                                        updateEdit(row.location_id, row.product_id, val);
                                                    }}
                                                    min="0"
                                                    className="w-24 px-3 py-2 text-center border border-slate-300 rounded-lg text-lg font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                    disabled={saving}
                                                />
                                                <button
                                                    onClick={() => incrementStock(row.location_id, row.product_id)}
                                                    disabled={saving}
                                                    className="p-2 rounded-lg border border-slate-300 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                    aria-label="Increase stock"
                                                >
                                                    <Plus className="h-4 w-4 text-slate-700" />
                                                </button>
                                            </div>
                                            {edit && (
                                                <span className="text-xs text-emerald-600 font-medium">
                                                    {edit.newValue > edit.currentValue ? '+' : ''}
                                                    {edit.newValue - edit.currentValue}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {selectedLocationName && locationProducts.length === 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center text-slate-500">
                    <p>No products found for this location.</p>
                </div>
            )}

            {!selectedLocationName && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center text-slate-500">
                    <p>Please select a location to update stock levels.</p>
                </div>
            )}
        </div>
    );
}

