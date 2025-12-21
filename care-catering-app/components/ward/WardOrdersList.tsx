'use client';

import { Fragment, useState, useEffect } from 'react';
import type { Database } from '@/types/database.types';
import { createClient } from '@/utils/supabase/client';
import { ChevronDown, ChevronRight, Loader2, Package, UtensilsCrossed } from 'lucide-react';
import { OrderDetailsModal } from './OrderDetailsModal';

type OrderRow = Database['public']['Views']['report_orders_summary']['Row'];
type MovementRow = Database['public']['Views']['report_stock_movements']['Row'];
type CateringDetail = Database['public']['Tables']['catering_details']['Row'];
type DietCode = Database['public']['Tables']['diet_codes']['Row'];

const STATUS_STYLES: Record<OrderRow['status'], string> = {
    pending: 'bg-amber-50 text-amber-800 border-amber-200',
    approved: 'bg-sky-50 text-sky-800 border-sky-200',
    processing: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    delivered: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    cancelled: 'bg-red-50 text-red-800 border-red-200',
};

type WardOrdersListProps = {
    locationId: number | null;
    onRefresh?: number; // Trigger number that changes to force refresh
};

export function WardOrdersList({ locationId, onRefresh }: WardOrdersListProps) {
    const supabase = createClient();
    const [orders, setOrders] = useState<OrderRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
    const [details, setDetails] = useState<
        Record<
            number,
            {
                loading: boolean;
                error: string | null;
                items: MovementRow[];
                cateringDetail?: CateringDetail | null;
            }
        >
    >({});
    const [statusFilter, setStatusFilter] = useState<OrderRow['status'] | 'all'>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    
    // Modal state
    const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
    const [modalItems, setModalItems] = useState<MovementRow[]>([]);
    const [modalCateringDetail, setModalCateringDetail] = useState<CateringDetail | null>(null);
    const [modalDietaryFlags, setModalDietaryFlags] = useState<DietCode[]>([]);
    const [modalLoading, setModalLoading] = useState(false);

    const fetchOrders = async () => {
        if (!locationId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('report_orders_summary')
                .select('*')
                .eq('location_id', locationId)
                .in('type', ['grocery', 'catering'])
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (err) {
            console.error('Error fetching orders', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, [locationId]);

    useEffect(() => {
        if (onRefresh !== undefined && onRefresh > 0) {
            // Refresh when parent component requests it
            fetchOrders();
        }
    }, [onRefresh]);

    const handleToggle = async (orderId: number, orderType: string) => {
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

        try {
            // Fetch order items
            const { data: itemsData, error: itemsError } = await supabase
                .from('report_stock_movements')
                .select('*')
                .eq('order_id', orderId)
                .order('created_at', { ascending: true });

            if (itemsError) throw itemsError;

            // If catering order, fetch catering details
            let cateringDetail: CateringDetail | null = null;
            if (orderType === 'catering') {
                const { data: cateringData, error: cateringError } = await supabase
                    .from('catering_details')
                    .select('*')
                    .eq('order_id', orderId)
                    .single();

                if (cateringError && cateringError.code !== 'PGRST116') {
                    // PGRST116 is "not found", which is okay
                    console.error('Error fetching catering details', cateringError);
                } else {
                    cateringDetail = cateringData || null;
                }
            }

            setDetails(prev => ({
                ...prev,
                [orderId]: {
                    loading: false,
                    error: null,
                    items: (itemsData as MovementRow[]) ?? [],
                    cateringDetail,
                },
            }));
        } catch (err) {
            setDetails(prev => ({
                ...prev,
                [orderId]: {
                    loading: false,
                    error: err instanceof Error ? err.message : 'Failed to load details',
                    items: [],
                },
            }));
        }
    };

    const handleOrderClick = async (order: OrderRow) => {
        setSelectedOrder(order);
        setModalLoading(true);
        setModalItems([]);
        setModalCateringDetail(null);
        setModalDietaryFlags([]);

        try {
            // Fetch order items
            const { data: itemsData, error: itemsError } = await supabase
                .from('report_stock_movements')
                .select('*')
                .eq('order_id', order.order_id)
                .order('created_at', { ascending: true });

            if (itemsError) throw itemsError;
            setModalItems((itemsData as MovementRow[]) ?? []);

                    // If catering order, fetch catering details and dietary flags
            if (order.type === 'catering') {
                // Fetch catering details
                const { data: cateringData, error: cateringError } = await supabase
                    .from('catering_details')
                    .select('*')
                    .eq('order_id', order.order_id)
                    .single();

                if (cateringError && cateringError.code !== 'PGRST116') {
                    console.error('Error fetching catering details', cateringError);
                } else {
                    setModalCateringDetail(cateringData || null);

                    // Fetch dietary flags and related diet codes if catering detail exists
                    if (cateringData) {
                        const dietCodeIds: number[] = [];
                        
                        // Add primary diet and meal service IDs if they exist
                        if (cateringData.primary_diet_id) {
                            dietCodeIds.push(cateringData.primary_diet_id);
                        }
                        if (cateringData.meal_service_required_id) {
                            dietCodeIds.push(cateringData.meal_service_required_id);
                        }

                        // Fetch dietary flags (allergies, intolerances, dislikes)
                        const { data: flagsData, error: flagsError } = await supabase
                            .from('order_dietary_flags')
                            .select('diet_code_id')
                            .eq('order_id', order.order_id);

                        if (!flagsError && flagsData && flagsData.length > 0) {
                            dietCodeIds.push(...flagsData.map(f => f.diet_code_id));
                        }

                        // Fetch all diet codes at once
                        if (dietCodeIds.length > 0) {
                            const { data: dietCodesData, error: dietCodesError } = await supabase
                                .from('diet_codes')
                                .select('*')
                                .in('id', dietCodeIds);

                            if (!dietCodesError) {
                                setModalDietaryFlags((dietCodesData as DietCode[]) ?? []);
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Error loading order details', err);
        } finally {
            setModalLoading(false);
        }
    };

    const handleCloseModal = () => {
        setSelectedOrder(null);
        setModalItems([]);
        setModalCateringDetail(null);
        setModalDietaryFlags([]);
    };

    if (!locationId) {
        return (
            <div className="bg-white border border-slate-200 rounded-lg p-6 text-center text-slate-500">
                No location assigned. Please contact an administrator.
            </div>
        );
    }

    if (loading) {
        return (
            <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
                <p className="mt-2 text-sm text-slate-600">Loading orders...</p>
            </div>
        );
    }

    const filteredOrders = orders.filter(order => {
        if (statusFilter !== 'all' && order.status !== statusFilter) return false;
        if (typeFilter !== 'all' && order.type !== typeFilter) return false;
        return true;
    });

    if (orders.length === 0) {
        return (
            <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500">
                <Package className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p>No orders yet. Create your first order using the tabs above.</p>
            </div>
        );
    }

    return (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Order History</h2>
                <div className="flex items-center gap-3">
                    <select
                        value={typeFilter}
                        onChange={e => setTypeFilter(e.target.value)}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
                    >
                        <option value="all">All Types</option>
                        <option value="grocery">Restock</option>
                        <option value="catering">Catering</option>
                    </select>
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value as OrderRow['status'] | 'all')}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
                    >
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="processing">Processing</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-4 py-2 w-10" />
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                                Order ID
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Bed</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">
                                Items
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                        {filteredOrders.map(order => {
                            const isExpanded = expandedOrderId === order.order_id;
                            const orderDetails = details[order.order_id];
                            return (
                                <Fragment key={order.order_id}>
                                    <tr 
                                        className="hover:bg-slate-50 cursor-pointer"
                                        onClick={() => handleOrderClick(order)}
                                    >
                                        <td className="px-2 py-2 align-top">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleToggle(order.order_id, order.type || '');
                                                }}
                                                className="p-1 rounded hover:bg-slate-100 text-slate-500"
                                                aria-label="Toggle order details"
                                            >
                                                {isExpanded ? (
                                                    <ChevronDown className="h-4 w-4" />
                                                ) : (
                                                    <ChevronRight className="h-4 w-4" />
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-4 py-2 text-sm text-slate-900">#{order.order_id}</td>
                                        <td className="px-4 py-2 text-sm text-slate-700">
                                            <div className="flex items-center gap-2">
                                                {order.type === 'catering' ? (
                                                    <UtensilsCrossed className="h-4 w-4 text-orange-500" />
                                                ) : (
                                                    <Package className="h-4 w-4 text-emerald-500" />
                                                )}
                                                <span className="capitalize">
                                                    {order.type === 'grocery' ? 'Restock' : order.type}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 text-sm text-slate-600">
                                            {new Date(order.created_at).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-slate-700">
                                            {order.bed_number || '—'}
                                        </td>
                                        <td className="px-4 py-2 text-sm">
                                            <span
                                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[order.status]}`}
                                            >
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 text-sm text-right text-slate-700">
                                            {order.items_count}
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr>
                                            <td colSpan={7} className="bg-slate-50 px-4 py-3">
                                                {orderDetails?.loading ? (
                                                    <div className="flex items-center gap-2 text-sm text-slate-500">
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        Loading order details...
                                                    </div>
                                                ) : orderDetails?.error ? (
                                                    <div className="text-sm text-red-600">{orderDetails.error}</div>
                                                ) : (
                                                    <div className="space-y-3">
                                                        {order.type === 'catering' && orderDetails?.cateringDetail && (
                                                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                                                                <h4 className="text-sm font-semibold text-orange-900 mb-2">
                                                                    Patient Details
                                                                </h4>
                                                                <div className="grid grid-cols-2 gap-2 text-sm">
                                                                    <div>
                                                                        <span className="text-orange-700 font-medium">
                                                                            Bed:
                                                                        </span>{' '}
                                                                        {orderDetails.cateringDetail.bed_number}
                                                                    </div>
                                                                    {orderDetails.cateringDetail.patient_name && (
                                                                        <div>
                                                                            <span className="text-orange-700 font-medium">
                                                                                Patient:
                                                                            </span>{' '}
                                                                            {orderDetails.cateringDetail.patient_name}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {orderDetails.cateringDetail.other_notes && (
                                                                    <div className="mt-2 text-sm text-orange-800">
                                                                        <span className="font-medium">Notes:</span>{' '}
                                                                        {orderDetails.cateringDetail.other_notes}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                        {orderDetails?.items && orderDetails.items.length > 0 ? (
                                                            <div>
                                                                <h4 className="text-sm font-semibold text-slate-700 mb-2">
                                                                    Order Items
                                                                </h4>
                                                                <div className="overflow-x-auto">
                                                                    <table className="min-w-full text-sm">
                                                                        <thead>
                                                                            <tr className="text-xs uppercase text-slate-500">
                                                                                <th className="py-1 text-left">Product</th>
                                                                                <th className="py-1 text-right">Quantity</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {orderDetails.items.map(item => (
                                                                                <tr
                                                                                    key={item.movement_id}
                                                                                    className="border-t border-slate-200"
                                                                                >
                                                                                    <td className="py-1 pr-2 text-slate-800">
                                                                                        {item.product_name ?? '—'}
                                                                                        {item.unit_size ? ` (${item.unit_size})` : ''}
                                                                                    </td>
                                                                                    <td className="py-1 pl-2 text-right text-slate-800">
                                                                                        {item.quantity}
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="text-sm text-slate-500">
                                                                No items found for this order.
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {filteredOrders.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-slate-500">
                    No orders match the selected filters.
                </div>
            )}
            
            {/* Order Details Modal */}
            <OrderDetailsModal
                isOpen={selectedOrder !== null}
                order={selectedOrder}
                items={modalItems}
                cateringDetail={modalCateringDetail}
                dietaryFlags={modalDietaryFlags}
                loading={modalLoading}
                onClose={handleCloseModal}
            />
        </div>
    );
}

