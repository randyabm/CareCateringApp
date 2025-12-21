'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Database } from '@/types/database.types';
import { createClient } from '@/utils/supabase/client';
import { UtensilsCrossed, Loader2, Clock, MapPin, User, CheckCircle2, PlayCircle, Truck, AlertCircle, Package, XCircle, Edit2, UserCheck } from 'lucide-react';
import { OrderDetailsModal } from '@/components/ward/OrderDetailsModal';

type OrderRow = Database['public']['Views']['report_orders_summary']['Row'];
type MovementRow = Database['public']['Views']['report_stock_movements']['Row'];
type CateringDetail = Database['public']['Tables']['catering_details']['Row'];
type DietCode = Database['public']['Tables']['diet_codes']['Row'];
type Location = Database['public']['Tables']['locations']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

const STATUS_STYLES: Record<OrderRow['status'], string> = {
    pending: 'bg-amber-50 text-amber-800 border-amber-200',
    approved: 'bg-sky-50 text-sky-800 border-sky-200',
    processing: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    delivered: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    cancelled: 'bg-red-50 text-red-800 border-red-200',
};

type KitchenOrderFeedProps = {
    orders: OrderRow[];
    locations: Location[];
    onStatusUpdate: (orderId: number, newStatus: OrderRow['status']) => Promise<void>;
    onAssignmentUpdate?: (orderId: number, assignedToUserId: string | null, assignmentType: 'store_man' | 'kitchen_runner' | null) => Promise<void>;
    onRefresh: () => void;
};

export function KitchenOrderFeed({ orders, locations, onStatusUpdate, onAssignmentUpdate, onRefresh }: KitchenOrderFeedProps) {
    const supabase = createClient();
    const [statusFilter, setStatusFilter] = useState<OrderRow['status'] | 'all'>('all');
    const [locationFilter, setLocationFilter] = useState<string>('all');
    const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set(['catering', 'grocery'])); // Default: show catering and grocery, hide proactive_restock and future_order
    const [assignmentFilter, setAssignmentFilter] = useState<string>('all');
    const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
    const [modalItems, setModalItems] = useState<MovementRow[]>([]);
    const [modalCateringDetail, setModalCateringDetail] = useState<CateringDetail | null>(null);
    const [modalDietaryFlags, setModalDietaryFlags] = useState<DietCode[]>([]);
    const [modalLoading, setModalLoading] = useState(false);
    const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
    const [updatingAssignmentId, setUpdatingAssignmentId] = useState<number | null>(null);
    const [newOrdersCount, setNewOrdersCount] = useState(0);
    const [assignableUsers, setAssignableUsers] = useState<Profile[]>([]);

    // Load assignable users (store_man and kitchen_runner)
    useEffect(() => {
        const loadAssignableUsers = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .in('role', ['store_man', 'kitchen_runner'])
                .order('full_name');
            
            if (!error && data) {
                setAssignableUsers(data);
            }
        };
        loadAssignableUsers();
    }, [supabase]);

    // Track new orders (orders created in the last 30 seconds)
    useEffect(() => {
        const now = Date.now();
        const recentOrders = orders.filter(order => {
            const orderTime = new Date(order.created_at).getTime();
            return now - orderTime < 30000; // 30 seconds
        });
        setNewOrdersCount(recentOrders.length);
    }, [orders]);

    const filteredOrders = useMemo(() => {
        return orders.filter(order => {
            if (statusFilter !== 'all' && order.status !== statusFilter) return false;
            if (locationFilter !== 'all' && order.location_id?.toString() !== locationFilter) return false;
            if (!typeFilters.has(order.type)) return false;
            if (assignmentFilter !== 'all') {
                if (assignmentFilter === 'unassigned' && (order.assigned_to_user_id || order.assignment_type)) return false;
                if (assignmentFilter === 'store_man' && order.assignment_type !== 'store_man') return false;
                if (assignmentFilter === 'kitchen_runner' && order.assignment_type !== 'kitchen_runner') return false;
            }
            return true;
        }).sort((a, b) => {
            // Put delivered and cancelled orders at the end
            const aIsFinal = a.status === 'delivered' || a.status === 'cancelled';
            const bIsFinal = b.status === 'delivered' || b.status === 'cancelled';
            
            if (aIsFinal && !bIsFinal) return 1; // a goes to end
            if (!aIsFinal && bIsFinal) return -1; // b goes to end
            
            // Within same group (both final or both not final), sort by created_at descending (newest first)
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
    }, [orders, statusFilter, locationFilter, typeFilters, assignmentFilter]);

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

            // Fetch catering details and dietary flags
            const { data: cateringData, error: cateringError } = await supabase
                .from('catering_details')
                .select('*')
                .eq('order_id', order.order_id)
                .single();

            if (cateringError && cateringError.code !== 'PGRST116') {
                console.error('Error fetching catering details', cateringError);
            } else {
                setModalCateringDetail(cateringData || null);

                if (cateringData) {
                    const dietCodeIds: number[] = [];
                    
                    if (cateringData.primary_diet_id) {
                        dietCodeIds.push(cateringData.primary_diet_id);
                    }
                    if (cateringData.meal_service_required_id) {
                        dietCodeIds.push(cateringData.meal_service_required_id);
                    }

                    // Fetch dietary flags
                    const { data: flagsData, error: flagsError } = await supabase
                        .from('order_dietary_flags')
                        .select('diet_code_id')
                        .eq('order_id', order.order_id);

                    if (!flagsError && flagsData && flagsData.length > 0) {
                        dietCodeIds.push(...flagsData.map(f => f.diet_code_id));
                    }

                    // Fetch all diet codes
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
        } catch (err) {
            console.error('Error loading order details', err);
        } finally {
            setModalLoading(false);
        }
    };

    const handleStatusChange = async (order: OrderRow, newStatus: OrderRow['status']) => {
        // Prevent changes to cancelled or delivered orders
        if (order.status === 'cancelled' || order.status === 'delivered') {
            if (newStatus !== 'cancelled' && newStatus !== 'delivered') {
                alert('Cannot modify orders that are cancelled or delivered.');
                return;
            }
        }

        // Ask for confirmation for critical status changes
        if (newStatus === 'delivered') {
            const confirmed = window.confirm(
                'Are you sure you want to mark this order as delivered? This action cannot be undone.'
            );
            if (!confirmed) return;
        }

        if (newStatus === 'cancelled') {
            const confirmed = window.confirm(
                'Are you sure you want to cancel this order? This action cannot be undone and the status will be locked.'
            );
            if (!confirmed) return;
        }

        setUpdatingStatusId(order.order_id);
        try {
            await onStatusUpdate(order.order_id, newStatus);
        } catch (error) {
            console.error('Error updating order status', error);
            alert('Failed to update order status. Please try again.');
        } finally {
            setUpdatingStatusId(null);
        }
    };

    const handleAssignmentChange = async (order: OrderRow, assignedToUserId: string | null, assignmentType: 'store_man' | 'kitchen_runner' | null) => {
        if (!onAssignmentUpdate) return;

        setUpdatingAssignmentId(order.order_id);
        try {
            await onAssignmentUpdate(order.order_id, assignedToUserId, assignmentType);
            onRefresh();
        } catch (error) {
            console.error('Error updating order assignment', error);
            alert('Failed to update order assignment. Please try again.');
        } finally {
            setUpdatingAssignmentId(null);
        }
    };

    const getStatusActions = (order: OrderRow) => {
        const actions: { label: string; status: OrderRow['status']; icon: React.ReactNode; variant?: 'danger' | 'default' }[] = [];
        
        // Only show actions if order is not cancelled or delivered
        if (order.status === 'cancelled' || order.status === 'delivered') {
            return actions;
        }

        // Forward status transitions
        if (order.status === 'pending') {
            actions.push({ label: 'Approve', status: 'approved', icon: <CheckCircle2 className="h-4 w-4" /> });
        }
        if (order.status === 'approved' || order.status === 'pending') {
            actions.push({ label: 'Start Processing', status: 'processing', icon: <PlayCircle className="h-4 w-4" /> });
        }
        if (order.status === 'processing' || order.status === 'approved') {
            actions.push({ label: 'Mark Delivered', status: 'delivered', icon: <Truck className="h-4 w-4" /> });
        }

        // Backward status transitions (modifications)
        if (order.status === 'processing') {
            actions.push({ label: 'Back to Approved', status: 'approved', icon: <Edit2 className="h-4 w-4" /> });
        }
        if (order.status === 'approved') {
            actions.push({ label: 'Back to Pending', status: 'pending', icon: <Edit2 className="h-4 w-4" /> });
        }

        // Cancel action (available for all non-final states)
        actions.push({ label: 'Cancel', status: 'cancelled', icon: <XCircle className="h-4 w-4" />, variant: 'danger' });
        
        return actions;
    };

    const locationOptions = useMemo(() => {
        const locationIds = new Set(orders.map(o => o.location_id).filter((id): id is number => id !== null));
        return locations.filter(loc => locationIds.has(loc.id));
    }, [orders, locations]);

    const toggleTypeFilter = (type: string) => {
        setTypeFilters(prev => {
            const newSet = new Set(prev);
            if (newSet.has(type)) {
                newSet.delete(type);
            } else {
                newSet.add(type);
            }
            return newSet;
        });
    };

    const orderTypes = [
        { value: 'catering', label: 'Catering' },
        { value: 'grocery', label: 'Restock (Grocery)' },
        { value: 'proactive_restock', label: 'Proactive Restock' },
        { value: 'future_order', label: 'Future Order' },
    ];

    return (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm h-full flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <UtensilsCrossed className="h-5 w-5 text-orange-600" />
                        <Package className="h-5 w-5 text-emerald-600" />
                    </div>
                    <h2 className="text-lg font-semibold text-slate-900">Live Order Feed</h2>
                    {newOrdersCount > 0 && (
                        <span className="inline-flex items-center rounded-full bg-orange-100 text-orange-800 text-xs font-medium px-2 py-1 animate-pulse">
                            {newOrdersCount} new
                        </span>
                    )}
                </div>
                <button
                    onClick={onRefresh}
                    className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                    Refresh
                </button>
            </div>

            {/* Filters */}
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 space-y-3">
                {/* Order Type Checkboxes - First Line */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded w-full">
                    <span className="text-xs font-medium text-slate-600 mr-1">Types:</span>
                    {orderTypes.map(type => (
                        <label key={type.value} className="flex items-center gap-1.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={typeFilters.has(type.value)}
                                onChange={() => toggleTypeFilter(type.value)}
                                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 focus:ring-2"
                            />
                            <span className="text-sm text-slate-700">{type.label}</span>
                        </label>
                    ))}
                </div>
                
                {/* Other Filters - Second Line */}
                <div className="flex items-center gap-3 flex-wrap">
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value as OrderRow['status'] | 'all')}
                        className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800"
                    >
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="processing">Processing</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                    <select
                        value={locationFilter}
                        onChange={e => setLocationFilter(e.target.value)}
                        className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800"
                    >
                        <option value="all">All Locations</option>
                        {locationOptions.map(loc => (
                            <option key={loc.id} value={loc.id.toString()}>
                                {loc.name}
                            </option>
                        ))}
                    </select>
                    {onAssignmentUpdate && (
                        <select
                            value={assignmentFilter}
                            onChange={e => setAssignmentFilter(e.target.value)}
                            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800"
                        >
                            <option value="all">All Assignments</option>
                            <option value="unassigned">Unassigned</option>
                            <option value="store_man">Store Man</option>
                            <option value="kitchen_runner">Kitchen Runner</option>
                        </select>
                    )}
                    <div className="text-sm text-slate-600 ml-auto">
                        {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
                    </div>
                </div>
            </div>

            {/* Order List */}
            <div className="flex-1 overflow-y-auto">
                {filteredOrders.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        <div className="flex items-center justify-center gap-2 mb-4">
                            <UtensilsCrossed className="h-12 w-12 text-slate-300" />
                            <Package className="h-12 w-12 text-slate-300" />
                        </div>
                        <p>No orders found.</p>
                        <p className="text-sm mt-2">Orders will appear here as they are placed.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Order</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Location</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Type</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Status</th>
                                    {onAssignmentUpdate && (
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Assigned To</th>
                                    )}
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {filteredOrders.map(order => {
                                    const isNew = new Date(order.created_at).getTime() > Date.now() - 30000;
                                    const actions = getStatusActions(order);
                                    const isUpdating = updatingStatusId === order.order_id;

                                    return (
                                        <tr
                                            key={order.order_id}
                                            className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                                                isNew ? 'bg-orange-50/50' : ''
                                            }`}
                                            onClick={() => handleOrderClick(order)}
                                        >
                                            {/* Order */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    {order.type === 'catering' ? (
                                                        <UtensilsCrossed className="h-4 w-4 text-orange-500" />
                                                    ) : (
                                                        <Package className="h-4 w-4 text-emerald-500" />
                                                    )}
                                                    <span className="text-sm font-semibold text-slate-900">
                                                        #{order.order_id}
                                                    </span>
                                                    {isNew && (
                                                        <span className="inline-flex items-center rounded-full bg-orange-100 text-orange-800 text-xs font-medium px-2 py-0.5 animate-pulse">
                                                            New
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Location */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5 text-sm text-slate-600">
                                                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                                                    <span>{order.location_name || '-'}</span>
                                                </div>
                                            </td>

                                            {/* Type */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className="text-sm text-slate-700 capitalize">
                                                    {order.type === 'grocery' ? 'Restock' : 
                                                     order.type === 'proactive_restock' ? 'Proactive Restock' :
                                                     order.type === 'future_order' ? 'Future Order' : 
                                                     order.type}
                                                </span>
                                            </td>

                                            {/* Status */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span
                                                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[order.status]}`}
                                                >
                                                    {order.status}
                                                </span>
                                            </td>

                                            {/* Assigned To */}
                                            {onAssignmentUpdate && (
                                                <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                                    <select
                                                        value={
                                                            order.assigned_to_user_id 
                                                                ? order.assigned_to_user_id 
                                                                : order.assignment_type || 'unassigned'
                                                        }
                                                        onChange={(e) => {
                                                            const value = e.target.value;
                                                            if (value === 'unassigned') {
                                                                handleAssignmentChange(order, null, null);
                                                            } else if (value === 'store_man') {
                                                                // Assign to store_man type (no specific user)
                                                                handleAssignmentChange(order, null, 'store_man');
                                                            } else if (value === 'kitchen_runner') {
                                                                // Assign to kitchen_runner type (no specific user)
                                                                handleAssignmentChange(order, null, 'kitchen_runner');
                                                            } else {
                                                                // Assign to specific user
                                                                const user = assignableUsers.find(u => u.id === value);
                                                                if (user) {
                                                                    handleAssignmentChange(order, user.id, user.role as 'store_man' | 'kitchen_runner');
                                                                }
                                                            }
                                                        }}
                                                        disabled={updatingAssignmentId === order.order_id}
                                                        className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <option value="unassigned">Unassigned</option>
                                                        <optgroup label="Store Man">
                                                            <option value="store_man">Store Man (General)</option>
                                                            {assignableUsers.filter(u => u.role === 'store_man').map(user => (
                                                                <option key={user.id} value={user.id}>
                                                                    {user.full_name || user.id}
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                        <optgroup label="Kitchen Runner">
                                                            <option value="kitchen_runner">Kitchen Runner (General)</option>
                                                            {assignableUsers.filter(u => u.role === 'kitchen_runner').map(user => (
                                                                <option key={user.id} value={user.id}>
                                                                    {user.full_name || user.id}
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    </select>
                                                    {updatingAssignmentId === order.order_id && (
                                                        <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                            <span>Updating...</span>
                                                        </div>
                                                    )}
                                                </td>
                                            )}

                                            {/* Actions */}
                                            <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {actions.length > 0 && !isUpdating && (
                                                        <>
                                                            {actions.map(action => (
                                                                <button
                                                                    key={action.status}
                                                                    onClick={() => handleStatusChange(order, action.status)}
                                                                    title={action.label}
                                                                    className={`p-1.5 text-xs font-medium rounded border transition-colors flex items-center justify-center ${
                                                                        action.variant === 'danger'
                                                                            ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                                                                            : action.status === 'approved'
                                                                            ? 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100'
                                                                            : action.status === 'processing'
                                                                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                                                                            : action.status === 'pending'
                                                                            ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                                                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                                                    }`}
                                                                >
                                                                    <span className="h-4 w-4">{action.icon}</span>
                                                                </button>
                                                            ))}
                                                        </>
                                                    )}
                                                    {isUpdating && (
                                                        <div className="flex items-center gap-2 text-slate-500">
                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                            <span className="text-xs">Updating...</span>
                                                        </div>
                                                    )}
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

            {/* Order Details Modal */}
            <OrderDetailsModal
                isOpen={selectedOrder !== null}
                order={selectedOrder}
                items={modalItems}
                cateringDetail={modalCateringDetail}
                dietaryFlags={modalDietaryFlags}
                loading={modalLoading}
                onClose={() => {
                    setSelectedOrder(null);
                    setModalItems([]);
                    setModalCateringDetail(null);
                    setModalDietaryFlags([]);
                }}
            />
        </div>
    );
}

