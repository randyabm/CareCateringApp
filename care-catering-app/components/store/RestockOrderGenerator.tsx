'use client';

import { useMemo, useState } from 'react';
import { Database } from '@/types/database.types';
import { createClient } from '@/utils/supabase/client';
import { LocationTreeSelect, LocationTreeValue } from '@/components/admin/LocationTreeSelect';
import { Loader2, ShoppingCart, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

type StockRow = Database['public']['Views']['report_stock_by_location']['Row'];
type Location = Database['public']['Tables']['locations']['Row'];
type LocationGroup = Database['public']['Tables']['location_groups']['Row'];

type RestockOrderGeneratorProps = {
    stockData: StockRow[];
    locations: Location[];
    groups: LocationGroup[];
    onOrderCreated?: () => void;
};

type RestockItem = {
    productId: number;
    productName: string;
    currentStock: number;
    parLevel: number;
    gap: number;
    quantity: number;
};

type LocationRestock = {
    locationId: number;
    locationName: string;
    items: RestockItem[];
    totalQuantity: number;
};

export function RestockOrderGenerator({
    stockData,
    locations,
    groups,
    onOrderCreated,
}: RestockOrderGeneratorProps) {
    const supabase = createClient();
    const [selectedLocation, setSelectedLocation] = useState<LocationTreeValue>('all');
    const [locationRestocks, setLocationRestocks] = useState<LocationRestock[]>([]);
    const [creating, setCreating] = useState(false);
    const [createdOrders, setCreatedOrders] = useState<number[]>([]);
    const [error, setError] = useState<string | null>(null);

    const getAllChildGroupIds = (parentId: number, allGroups: LocationGroup[]): number[] => {
        const childIds: number[] = [];
        const directChildren = allGroups.filter(g => g.parent_group_id === parentId);
        directChildren.forEach(child => {
            childIds.push(child.id);
            childIds.push(...getAllChildGroupIds(child.id, allGroups));
        });
        return childIds;
    };

    const calculateRestocks = () => {
        let filtered = stockData.filter(row => row.current_stock < row.par_level && row.location_id);

        // Filter by selected location
        if (selectedLocation === 'unassigned') {
            filtered = [];
        } else if (selectedLocation.startsWith('group:')) {
            const groupId = Number(selectedLocation.split(':')[1]);
            const childGroupIds = getAllChildGroupIds(groupId, groups);
            const allGroupIds = [groupId, ...childGroupIds];
            filtered = filtered.filter(row => row.group_id && allGroupIds.includes(row.group_id));
        } else if (selectedLocation.startsWith('location:')) {
            const locationId = Number(selectedLocation.split(':')[1]);
            filtered = filtered.filter(row => row.location_id === locationId);
        }

        // Group by location
        const grouped = new Map<number, StockRow[]>();
        filtered.forEach(row => {
            if (!row.location_id) return;
            if (!grouped.has(row.location_id)) {
                grouped.set(row.location_id, []);
            }
            grouped.get(row.location_id)!.push(row);
        });

        const restocks: LocationRestock[] = Array.from(grouped.entries()).map(([locationId, rows]) => {
            const location = locations.find(l => l.id === locationId);
            const items: RestockItem[] = rows.map(row => {
                const gap = row.par_level - row.current_stock;
                const nameWithUnit = row.unit_size ? `${row.product_name || 'Unknown'} (${row.unit_size})` : row.product_name || 'Unknown';
                return {
                    productId: row.product_id,
                    productName: nameWithUnit,
                    currentStock: row.current_stock,
                    parLevel: row.par_level,
                    gap,
                    quantity: gap, // Default quantity equals gap
                };
            });

            return {
                locationId,
                locationName: location?.name || 'Unknown',
                items,
                totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
            };
        });

        setLocationRestocks(restocks);
    };

    const updateItemQuantity = (locationId: number, productId: number, newQuantity: number) => {
        setLocationRestocks(prev =>
            prev.map(locRestock => {
                if (locRestock.locationId !== locationId) return locRestock;
                return {
                    ...locRestock,
                    items: locRestock.items.map(item => {
                        if (item.productId !== productId) return item;
                        return { ...item, quantity: Math.max(0, newQuantity) };
                    }),
                    totalQuantity: locRestock.items.reduce((sum, item) => {
                        const qty = item.productId === productId ? Math.max(0, newQuantity) : item.quantity;
                        return sum + qty;
                    }, 0),
                };
            })
        );
    };

    const createOrders = async () => {
        if (locationRestocks.length === 0) {
            setError('No restock items selected');
            return;
        }

        setCreating(true);
        setError(null);
        const newOrderIds: number[] = [];

        try {
            // Allow bypassing auth while testing (set NEXT_PUBLIC_BYPASS_AUTH=true)
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user && process.env.NEXT_PUBLIC_BYPASS_AUTH !== 'true') {
                throw new Error('User not authenticated');
            }

            // Create orders for each location
            for (const locRestock of locationRestocks) {
                if (locRestock.items.length === 0) continue;

                // Create order
                const { data: order, error: orderError } = await supabase
                    .from('orders')
                    .insert({
                        user_id: user?.id ?? null,
                        location_id: locRestock.locationId,
                        type: 'proactive_restock',
                        status: 'pending',
                    })
                    .select()
                    .single();

                if (orderError) throw orderError;
                if (!order) continue;

                newOrderIds.push(order.id);

                // Create order items
                const orderItems = locRestock.items
                    .filter(item => item.quantity > 0)
                    .map(item => ({
                        order_id: order.id,
                        product_id: item.productId,
                        quantity: item.quantity,
                    }));

                if (orderItems.length > 0) {
                    const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
                    if (itemsError) throw itemsError;
                }
            }

            setCreatedOrders(newOrderIds);
            if (onOrderCreated) {
                onOrderCreated();
            }
        } catch (err) {
            console.error('Error creating orders:', err);
            setError(err instanceof Error ? err.message : 'Failed to create restock orders');
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Selection */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Generate Restock Orders</h3>
                <div className="space-y-4">
                    <LocationTreeSelect
                        groups={groups}
                        locations={locations}
                        value={selectedLocation}
                        onChange={setSelectedLocation}
                        label="Select Location(s)"
                    />
                    <button
                        onClick={calculateRestocks}
                        className="w-full md:w-auto px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                    >
                        Calculate Restock Needs
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2 text-red-800">
                    <AlertCircle className="h-5 w-5" />
                    <span>{error}</span>
                </div>
            )}

            {/* Success Message */}
            {createdOrders.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-2 text-emerald-800">
                    <CheckCircle className="h-5 w-5" />
                    <span>Successfully created {createdOrders.length} restock order(s)</span>
                </div>
            )}

            {/* Restock Preview */}
            {locationRestocks.length > 0 && (
                <div className="space-y-4">
                    {locationRestocks.map(locRestock => (
                        <div key={locRestock.locationId} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-semibold text-slate-900">{locRestock.locationName}</h4>
                                    <span className="text-sm text-slate-600">
                                        {locRestock.items.length} item{locRestock.items.length !== 1 ? 's' : ''} • Total: {locRestock.totalQuantity} units
                                    </span>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase">Product</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 uppercase">Current</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 uppercase">Par Level</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 uppercase">Gap</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 uppercase">Quantity</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {locRestock.items.map(item => (
                                            <tr key={item.productId} className="hover:bg-slate-50">
                                                <td className="px-4 py-2 text-sm text-slate-900">{item.productName}</td>
                                                <td className="px-4 py-2 text-sm text-right text-slate-600">{item.currentStock}</td>
                                                <td className="px-4 py-2 text-sm text-right text-slate-600">{item.parLevel}</td>
                                                <td className="px-4 py-2 text-sm text-right text-slate-600">{item.gap}</td>
                                                <td className="px-4 py-2 text-right">
                                                    <input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={e =>
                                                            updateItemQuantity(
                                                                locRestock.locationId,
                                                                item.productId,
                                                                parseInt(e.target.value, 10) || 0
                                                            )
                                                        }
                                                        min="0"
                                                        className="w-20 px-2 py-1 border border-slate-300 rounded text-sm text-right"
                                                        disabled={creating}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}

                    {/* Create Orders Button */}
                    <div className="flex justify-end">
                        <button
                            onClick={createOrders}
                            disabled={creating || locationRestocks.length === 0}
                            className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {creating ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Creating Orders...
                                </>
                            ) : (
                                <>
                                    <ShoppingCart className="h-5 w-5" />
                                    Create Restock Orders
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {locationRestocks.length === 0 && selectedLocation !== 'all' && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center text-slate-500">
                    <p>Click "Calculate Restock Needs" to generate restock orders for the selected location(s).</p>
                </div>
            )}
        </div>
    );
}

