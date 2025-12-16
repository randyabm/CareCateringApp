'use client';

import { Fragment, useState } from 'react';
import type { Database } from '@/types/database.types';
import { createClient } from '@/utils/supabase/client';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

type OrderRow = Database['public']['Views']['report_orders_summary']['Row'];
type MovementRow = Database['public']['Views']['report_stock_movements']['Row'];

const ORDER_STATUSES: OrderRow['status'][] = ['pending', 'approved', 'processing', 'delivered', 'cancelled'];

type OrdersTableProps = {
    orders: OrderRow[];
    selectedOrderIds?: number[];
    onSelectionChange?: (ids: number[]) => void;
};

export function OrdersTable({ orders, selectedOrderIds = [], onSelectionChange }: OrdersTableProps) {
    const supabase = createClient();
    const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
    const [details, setDetails] = useState<
        Record<
            number,
            {
                loading: boolean;
                error: string | null;
                items: MovementRow[];
            }
        >
    >({});
    const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
    const [statusOverrides, setStatusOverrides] = useState<Record<number, OrderRow['status']>>({});
    const [statusError, setStatusError] = useState<string | null>(null);

    const handleToggle = async (orderId: number) => {
        if (expandedOrderId === orderId) {
            setExpandedOrderId(null);
            return;
        }

        setExpandedOrderId(orderId);

        if (details[orderId]?.items?.length) {
            return;
        }

        setDetails(prev => ({
            ...prev,
            [orderId]: { loading: true, error: null, items: prev[orderId]?.items ?? [] },
        }));

        const { data, error } = await supabase
            .from('report_stock_movements')
            .select('*')
            .eq('order_id', orderId)
            .order('created_at', { ascending: true });

        setDetails(prev => ({
            ...prev,
            [orderId]: {
                loading: false,
                error: error ? error.message : null,
                items: (data as MovementRow[]) ?? [],
            },
        }));
    };

    const handleStatusChange = async (order: OrderRow, newStatus: OrderRow['status']) => {
        if (order.status === newStatus) return;

        setStatusError(null);
        setUpdatingStatusId(order.order_id);
        setStatusOverrides(prev => ({ ...prev, [order.order_id]: newStatus }));

        const { error } = await supabase
            .from('orders')
            .update({ status: newStatus })
            .eq('id', order.order_id);

        if (error) {
            console.error('Error updating order status', error);
            setStatusError(error.message);
            setStatusOverrides(prev => {
                const copy = { ...prev };
                delete copy[order.order_id];
                return copy;
            });
        }

        setUpdatingStatusId(null);
    };

    if (orders.length === 0) {
        return (
            <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500">
                No restock orders yet. Generate one from the "Generate Orders" tab.
            </div>
        );
    }

    return (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Restock Orders</h2>
                <p className="text-sm text-slate-500">
                    Showing {orders.length} order{orders.length !== 1 ? 's' : ''}.
                </p>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-4 py-2 w-10" />
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Order ID</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Location</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">User</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Items</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Total Qty</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                        {orders.map(order => {
                            const effectiveStatus = statusOverrides[order.order_id] ?? order.status;
                            const isSelected = selectedOrderIds.includes(order.order_id);
                            return (
                            <Fragment key={order.order_id}>
                                <tr className="hover:bg-slate-50">
                                    <td className="px-2 py-2 align-top">
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleToggle(order.order_id)}
                                                className="p-1 rounded hover:bg-slate-100 text-slate-500"
                                                aria-label="Toggle order details"
                                            >
                                                {expandedOrderId === order.order_id ? (
                                                    <ChevronDown className="h-4 w-4" />
                                                ) : (
                                                    <ChevronRight className="h-4 w-4" />
                                                )}
                                            </button>
                                            {onSelectionChange && (
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={e => {
                                                        const checked = e.target.checked;
                                                        const next = checked
                                                            ? [...selectedOrderIds, order.order_id]
                                                            : selectedOrderIds.filter(id => id !== order.order_id);
                                                        onSelectionChange(Array.from(new Set(next)));
                                                    }}
                                                    className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                                                />
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2 text-sm text-slate-900">#{order.order_id}</td>
                                    <td className="px-4 py-2 text-sm text-slate-600">
                                        {new Date(order.created_at).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-slate-700">
                                        {order.location_name ?? '—'}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-slate-700">
                                        {order.user_name ?? '—'}
                                    </td>
                                    <td className="px-4 py-2 text-sm">
                                        <select
                                            value={effectiveStatus}
                                            onChange={e => handleStatusChange(order, e.target.value as OrderRow['status'])}
                                            disabled={updatingStatusId === order.order_id}
                                            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
                                        >
                                            {ORDER_STATUSES.map(status => (
                                                <option key={status} value={status}>
                                                    {status}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-4 py-2 text-sm text-right text-slate-700">
                                        {order.items_count}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-right text-slate-700">
                                        {order.total_quantity}
                                    </td>
                                </tr>
                                {expandedOrderId === order.order_id && (
                                    <tr>
                                        <td colSpan={8} className="bg-slate-50 px-4 py-3">
                                            {details[order.order_id]?.loading ? (
                                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Loading order items...
                                                </div>
                                            ) : details[order.order_id]?.error ? (
                                                <div className="text-sm text-red-600">
                                                    {details[order.order_id]?.error}
                                                </div>
                                            ) : details[order.order_id]?.items?.length ? (
                                                <div className="overflow-x-auto">
                                                    <table className="min-w-full text-sm">
                                                        <thead>
                                                            <tr className="text-xs uppercase text-slate-500">
                                                                <th className="py-1 text-left">Product</th>
                                                                <th className="py-1 text-left">Category</th>
                                                                <th className="py-1 text-left">Location</th>
                                                                <th className="py-1 text-right">Quantity</th>
                                                                <th className="py-1 text-left">User</th>
                                                                <th className="py-1 text-left">Created At</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {details[order.order_id].items.map(item => (
                                                                <tr key={item.movement_id} className="border-t border-slate-200">
                                            <td className="py-1 pr-2 text-slate-800">
                                                                        {item.product_name ?? '—'}
                                                                        {item.unit_size ? ` (${item.unit_size})` : ''}
                                                                    </td>
                                                                    <td className="py-1 pr-2 text-slate-600">
                                                                        {item.category_name ?? '—'}
                                                                    </td>
                                                                    <td className="py-1 pr-2 text-slate-600">
                                                                        {item.location_name ?? '—'}
                                                                    </td>
                                                                    <td className="py-1 pl-2 text-right text-slate-800">
                                                                        {item.quantity}
                                                                    </td>
                                                                    <td className="py-1 pr-2 text-slate-600">
                                                                        {item.user_name ?? '—'}
                                                                    </td>
                                                                    <td className="py-1 pr-2 text-slate-500">
                                                                        {new Date(item.created_at).toLocaleString()}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div className="text-sm text-slate-500">
                                                    No items found for this order.
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        );})}
                    </tbody>
                </table>
            </div>
            {statusError && (
                <div className="px-4 py-2 text-sm text-red-600 border-t border-red-200 bg-red-50">
                    {statusError}
                </div>
            )}
        </div>
    );
}


