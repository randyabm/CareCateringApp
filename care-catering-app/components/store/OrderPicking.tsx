'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Database } from '@/types/database.types';
import { createClient } from '@/utils/supabase/client';
import { Loader2, CheckCircle2 } from 'lucide-react';

type MovementRow = Database['public']['Views']['report_stock_movements']['Row'];

type OrderPickingProps = {
    selectedOrderIds: number[];
};

type ProductGroup = {
    productId: number | null;
    productName: string;
    totalQuantity: number;
    rows: MovementRow[];
};

export function OrderPicking({ selectedOrderIds }: OrderPickingProps) {
    const supabase = createClient();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rows, setRows] = useState<MovementRow[]>([]);
    const [pickedIds, setPickedIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        const fetchMovements = async () => {
            if (selectedOrderIds.length === 0) {
                setRows([]);
                setPickedIds(new Set());
                return;
            }

            setLoading(true);
            setError(null);

            const { data, error } = await supabase
                .from('report_stock_movements')
                .select('*')
                .in('order_id', selectedOrderIds)
                .order('product_name', { ascending: true });

            if (error) {
                console.error('Error loading pick list', error);
                setError(error.message);
                setRows([]);
            } else {
                setRows((data as MovementRow[]) ?? []);
                setPickedIds(new Set());
            }

            setLoading(false);
        };

        fetchMovements();
    }, [selectedOrderIds, supabase]);

    const productGroups: ProductGroup[] = useMemo(() => {
        const map = new Map<number | null, ProductGroup>();
        for (const row of rows) {
            const key = row.product_id;
            if (!map.has(key)) {
                const name = row.product_name ?? 'Unknown product';
                const nameWithUnit = row.unit_size ? `${name} (${row.unit_size})` : name;
                map.set(key, {
                    productId: key,
                    productName: nameWithUnit,
                    totalQuantity: 0,
                    rows: [],
                });
            }
            const group = map.get(key)!;
            group.rows.push(row);
            group.totalQuantity += row.quantity;
        }
        return Array.from(map.values());
    }, [rows]);

    const allPicked = rows.length > 0 && rows.every(r => pickedIds.has(r.movement_id));

    const toggleRow = (id: number) => {
        setPickedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleGroup = (group: ProductGroup) => {
        const groupIds = group.rows.map(r => r.movement_id);
        const isGroupPicked = groupIds.every(id => pickedIds.has(id));
        setPickedIds(prev => {
            const next = new Set(prev);
            if (isGroupPicked) {
                groupIds.forEach(id => next.delete(id));
            } else {
                groupIds.forEach(id => next.add(id));
            }
            return next;
        });
    };

    if (selectedOrderIds.length === 0) {
        return (
            <div className="bg-white border border-slate-200 rounded-lg p-6 text-slate-600 text-sm">
                Select one or more orders in the <span className="font-semibold">Orders</span> tab to prepare a pick list.
            </div>
        );
    }

    return (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">Picking List</h2>
                    <p className="text-sm text-slate-500">
                        Orders: {selectedOrderIds.join(', ')} • Items:{' '}
                        {rows.reduce((sum, r) => sum + r.quantity, 0)}
                    </p>
                </div>
                {loading && (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading items...
                    </div>
                )}
                {!loading && allPicked && rows.length > 0 && (
                    <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                        All items picked – ready to deliver
                    </div>
                )}
            </div>

            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

            {!loading && rows.length === 0 && !error && (
                <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    No items found for the selected orders.
                </div>
            )}

            {!loading && rows.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr className="text-xs uppercase text-slate-500">
                                <th className="px-3 py-2 text-left w-10">Pick</th>
                                <th className="px-3 py-2 text-left">Product</th>
                                <th className="px-3 py-2 text-right">Total Qty</th>
                                <th className="px-3 py-2 text-left">By Location / Order</th>
                            </tr>
                        </thead>
                        <tbody>
                            {productGroups.map(group => {
                                const groupIds = group.rows.map(r => r.movement_id);
                                const groupPicked = groupIds.every(id => pickedIds.has(id));
                                return (
                                    <tr key={group.productId ?? group.productName} className="border-b border-slate-100 align-top">
                                        <td className="px-3 py-2">
                                            <input
                                                type="checkbox"
                                                checked={groupPicked}
                                                onChange={() => toggleGroup(group)}
                                                className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                                            />
                                        </td>
                                        <td className="px-3 py-2 text-slate-900 font-medium">{group.productName}</td>
                                        <td className="px-3 py-2 text-right text-slate-900 font-semibold">
                                            {group.totalQuantity}
                                        </td>
                                        <td className="px-3 py-2">
                                            <div className="space-y-1">
                                                {group.rows.map(row => {
                                                    const checked = pickedIds.has(row.movement_id);
                                                    return (
                                                        <label
                                                            key={row.movement_id}
                                                            className="flex items-center justify-between gap-3 text-xs bg-slate-50 rounded px-2 py-1"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={checked}
                                                                    onChange={() => toggleRow(row.movement_id)}
                                                                    className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600"
                                                                />
                                                                <span className="text-slate-700">
                                                                    {row.location_name ?? '—'} (Order #{row.order_id})
                                                                </span>
                                                            </div>
                                                            <span className="text-slate-900 font-medium">{row.quantity}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}


