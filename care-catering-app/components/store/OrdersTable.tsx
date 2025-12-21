'use client';

import { Fragment, useState } from 'react';
import type { Database } from '@/types/database.types';
import { createClient } from '@/utils/supabase/client';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

type OrderRow = Database['public']['Views']['report_orders_summary']['Row'];
type MovementRow = Database['public']['Views']['report_stock_movements']['Row'];

const ORDER_STATUSES: OrderRow['status'][] = ['pending', 'approved', 'processing', 'delivered', 'cancelled'];

const STATUS_STYLES: Record<OrderRow['status'], string> = {
    pending: 'bg-amber-50 text-amber-800 border-amber-200',
    approved: 'bg-sky-50 text-sky-800 border-sky-200',
    processing: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    delivered: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    cancelled: 'bg-red-50 text-red-800 border-red-200',
};

type OrdersTableProps = {
    orders: OrderRow[];
    selectedOrderIds?: number[];
    onSelectionChange?: (ids: number[]) => void;
    onStatusUpdated?: () => void;
};

export function OrdersTable({ orders, selectedOrderIds = [], onSelectionChange, onStatusUpdated }: OrdersTableProps) {
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
    const [statusFilter, setStatusFilter] = useState<OrderRow['status'] | 'all'>('all');
    const [locationFilter, setLocationFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [userFilter, setUserFilter] = useState<string>('all');

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
        const currentStatus = statusOverrides[order.order_id] ?? order.status;

        // Do not allow any further changes once an order has been cancelled or delivered
        if (currentStatus === 'cancelled' || currentStatus === 'delivered') {
            setStatusError('This order has been finished and its status can no longer be changed.');
            return;
        }

        if (currentStatus === newStatus) return;

        // Ask for confirmation before cancelling or delivering an order
        if (newStatus === 'cancelled' || newStatus === 'delivered') {
            const message =
                newStatus === 'cancelled'
                    ? 'Are you sure you want to cancel this order? This action cannot be undone and the status will be locked.'
                    : 'Are you sure you want to mark this order as delivered? This action cannot be undone and the status will be locked.';

            const confirmed =
                typeof window !== 'undefined' ? window.confirm(message) : true;

            if (!confirmed) {
                return;
            }
        }

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
            setUpdatingStatusId(null);
            return;
        }

        // If order was marked as delivered, adjust storage stock for the related products
        if (newStatus === 'delivered') {
            try {
                // Remove this order from the current picking selection if applicable
                if (onSelectionChange && selectedOrderIds.length > 0) {
                    const nextIds = selectedOrderIds.filter(id => id !== order.order_id);
                    onSelectionChange(nextIds);
                }

                // Load all movement rows for this order to know which products and quantities are involved
                const { data: movementData, error: movementError } = await supabase
                    .from('report_stock_movements')
                    .select('product_id, quantity')
                    .eq('order_id', order.order_id);

                if (movementError) {
                    console.error('Error loading movement rows for delivered order', movementError);
                    setStatusError(movementError.message);
                } else if (movementData && movementData.length > 0) {
                    const totalsByProduct = new Map<number, number>();
                    for (const row of movementData as MovementRow[]) {
                        if (!row.product_id) continue;
                        const current = totalsByProduct.get(row.product_id) ?? 0;
                        totalsByProduct.set(row.product_id, current + row.quantity);
                    }

                    const productIds = Array.from(totalsByProduct.keys());

                    if (productIds.length > 0) {
                        // Get current storage_stock values
                        const { data: productsData, error: productsError } = await supabase
                            .from('products')
                            .select('id, storage_stock')
                            .in('id', productIds);

                        if (productsError) {
                            console.error('Error loading products for storage adjustment', productsError);
                            setStatusError(productsError.message);
                        } else if (productsData && productsData.length > 0) {
                            // Apply decrements per product
                            const updates = productsData.map(prod => {
                                const totalQty = totalsByProduct.get(prod.id as number) ?? 0;
                                const newStock = Math.max(0, (prod.storage_stock as number) - totalQty);
                                return supabase
                                    .from('products')
                                    .update({ storage_stock: newStock })
                                    .eq('id', prod.id);
                            });

                            const results = await Promise.all(updates);
                            const failed = results.find(r => r.error);
                            if (failed && failed.error) {
                                console.error('Error updating storage stock for delivered order', failed.error);
                                setStatusError(failed.error.message);
                            }
                        }
                    }
                }
            } catch (adjustError) {
                console.error('Unexpected error adjusting storage stock for delivered order', adjustError);
            }
        }

        setUpdatingStatusId(null);

        if (onStatusUpdated) {
            onStatusUpdated();
        }
    };

    if (orders.length === 0) {
        return (
            <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500">
                No restock orders yet. Generate one from the "Generate Orders" tab.
            </div>
        );
    }

    const locationOptions = Array.from(
        new Set(orders.map(order => order.location_name).filter((name): name is string => Boolean(name)))
    );
    // Always include all possible order types for store page, even if no orders exist for them
    const allOrderTypes: OrderRow['type'][] = ['grocery', 'proactive_restock', 'future_order'];
    const typeOptions = Array.from(
        new Set([
            ...allOrderTypes,
            ...orders.map(order => order.type).filter(type => Boolean(type))
        ])
    );
    const userOptions = Array.from(
        new Set(orders.map(order => order.user_name).filter((name): name is string => Boolean(name)))
    );

    const filteredOrders = orders.filter(order => {
        if (statusFilter !== 'all' && order.status !== statusFilter) return false;
        if (locationFilter !== 'all' && order.location_name !== locationFilter) return false;
        if (typeFilter !== 'all' && order.type !== typeFilter) return false;
        if (userFilter !== 'all' && order.user_name !== userFilter) return false;
        return true;
    });

    return (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Restock Orders</h2>
                <p className="text-sm text-slate-500">
                    Showing {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}.
                </p>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-4 py-2 w-10" />
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Order ID</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                            <th className="px-4 py-1 text-left text-xs font-medium text-slate-500 uppercase align-top">
                                <div className="flex flex-col gap-1">
                                    <span>Type</span>
                                    <select
                                        value={typeFilter}
                                        onChange={e => setTypeFilter(e.target.value)}
                                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xxs text-slate-800"
                                    >
                                        <option value="all">All</option>
                                        {typeOptions.map(type => (
                                            <option key={type} value={type}>
                                                {type === 'grocery' ? 'Restock' : type.replace('_', ' ')}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </th>
                            <th className="px-4 py-1 text-left text-xs font-medium text-slate-500 uppercase align-top">
                                <div className="flex flex-col gap-1">
                                    <span>Location</span>
                                    <select
                                        value={locationFilter}
                                        onChange={e => setLocationFilter(e.target.value)}
                                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xxs text-slate-800"
                                    >
                                        <option value="all">All</option>
                                        {locationOptions.map(location => (
                                            <option key={location} value={location}>
                                                {location}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </th>
                            <th className="px-4 py-1 text-left text-xs font-medium text-slate-500 uppercase align-top">
                                <div className="flex flex-col gap-1">
                                    <span>User</span>
                                    <select
                                        value={userFilter}
                                        onChange={e => setUserFilter(e.target.value)}
                                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xxs text-slate-800"
                                    >
                                        <option value="all">All</option>
                                        {userOptions.map(user => (
                                            <option key={user} value={user}>
                                                {user}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </th>
                            <th className="px-4 py-1 text-left text-xs font-medium text-slate-500 uppercase align-top">
                                <div className="flex flex-col gap-1">
                                    <span>Status</span>
                                    <select
                                        value={statusFilter}
                                        onChange={e => setStatusFilter(e.target.value as OrderRow['status'] | 'all')}
                                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xxs text-slate-800"
                                    >
                                        <option value="all">All</option>
                                        {ORDER_STATUSES.map(status => (
                                            <option key={status} value={status}>
                                                {status}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Items</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Total Qty</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                        {filteredOrders.map(order => {
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
                                            {onSelectionChange && (effectiveStatus === 'pending' || effectiveStatus === 'approved') && (
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
                                    <td className="px-4 py-2 text-sm text-slate-700 capitalize">
                                        {order.type === 'grocery' ? 'Restock' : order.type?.replace('_', ' ') ?? '—'}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-slate-700">
                                        {order.location_name ?? '—'}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-slate-700">
                                        {order.user_name ?? '—'}
                                    </td>
                                    <td className="px-4 py-2 text-sm">
                                        <div
                                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[effectiveStatus]}`}
                                        >
                                            <select
                                                value={effectiveStatus}
                                                onChange={e => handleStatusChange(order, e.target.value as OrderRow['status'])}
                                                disabled={
                                                    updatingStatusId === order.order_id ||
                                                    effectiveStatus === 'cancelled' ||
                                                    effectiveStatus === 'delivered'
                                                }
                                                className="bg-transparent border-none focus:ring-0 text-xs font-medium pr-4 cursor-pointer disabled:cursor-not-allowed"
                                            >
                                                {ORDER_STATUSES.map(status => (
                                                    <option key={status} value={status}>
                                                        {status}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
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


