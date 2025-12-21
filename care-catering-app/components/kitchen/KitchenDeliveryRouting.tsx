'use client';

import { useMemo, useState, useEffect } from 'react';
import type { Database } from '@/types/database.types';
import { createClient } from '@/utils/supabase/client';
import { Truck, MapPin, Clock, CheckCircle2, AlertCircle, Loader2, UtensilsCrossed, Package, XCircle, UserCheck } from 'lucide-react';

type OrderRow = Database['public']['Views']['report_orders_summary']['Row'];
type Location = Database['public']['Tables']['locations']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

const STATUS_STYLES: Record<OrderRow['status'], string> = {
    pending: 'bg-amber-50 text-amber-800 border-amber-200',
    approved: 'bg-sky-50 text-sky-800 border-sky-200',
    processing: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    delivered: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    cancelled: 'bg-red-50 text-red-800 border-red-200',
};

type KitchenDeliveryRoutingProps = {
    orders: OrderRow[];
    locations: Location[];
    onBulkStatusUpdate: (orderIds: number[], newStatus: OrderRow['status']) => Promise<void>;
    onBulkAssignmentUpdate?: (orderIds: number[], assignedToUserId: string | null, assignmentType: 'store_man' | 'kitchen_runner' | null) => Promise<void>;
};

type LocationGroup = {
    location: Location;
    orders: OrderRow[];
    pendingCount: number;
    approvedCount: number;
    processingCount: number;
    readyForDelivery: OrderRow[];
};

export function KitchenDeliveryRouting({ orders, locations, onBulkStatusUpdate, onBulkAssignmentUpdate }: KitchenDeliveryRoutingProps) {
    const supabase = createClient();
    const [selectedOrderIds, setSelectedOrderIds] = useState<Set<number>>(new Set());
    const [updatingOrderIds, setUpdatingOrderIds] = useState<Set<number>>(new Set());
    const [updatingAssignmentIds, setUpdatingAssignmentIds] = useState<Set<number>>(new Set());
    const [assignableUsers, setAssignableUsers] = useState<Profile[]>([]);
    const [activeTab, setActiveTab] = useState<'kitchen_runner' | 'store_man'>('kitchen_runner');

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
        if (onBulkAssignmentUpdate) {
            loadAssignableUsers();
        }
    }, [supabase, onBulkAssignmentUpdate]);

    // Filter to orders that are ready for delivery (approved or processing) - both catering and restock
    const deliveryOrders = useMemo(() => {
        return orders.filter(
            order => (order.status === 'approved' || order.status === 'processing')
        );
    }, [orders]);

    // Filter orders by active tab
    const filteredOrders = useMemo(() => {
        return deliveryOrders.filter(order => {
            if (activeTab === 'kitchen_runner') {
                return order.assignment_type === 'kitchen_runner';
            } else if (activeTab === 'store_man') {
                return order.assignment_type === 'store_man';
            }
            return false;
        }).sort((a, b) => {
            // Sort by location name, then by created_at
            if (a.location_name !== b.location_name) {
                return (a.location_name || '').localeCompare(b.location_name || '');
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
    }, [deliveryOrders, activeTab]);

    const handleBulkStatusUpdate = async (orderIds: number[], newStatus: OrderRow['status']) => {
        if (orderIds.length === 0) return;

        // Ask for confirmation for critical status changes
        if (newStatus === 'delivered') {
            const confirmed = window.confirm(
                `Are you sure you want to mark ${orderIds.length} order${orderIds.length !== 1 ? 's' : ''} as delivered? This action cannot be undone.`
            );
            if (!confirmed) return;
        }

        if (newStatus === 'cancelled') {
            const confirmed = window.confirm(
                `Are you sure you want to cancel ${orderIds.length} order${orderIds.length !== 1 ? 's' : ''}? This action cannot be undone and the status will be locked.`
            );
            if (!confirmed) return;
        }

        setUpdatingOrderIds(new Set(orderIds));
        try {
            await onBulkStatusUpdate(orderIds, newStatus);
        } catch (error) {
            console.error('Error updating orders', error);
            alert('Failed to update orders. Please try again.');
        } finally {
            setUpdatingOrderIds(new Set());
        }
    };

    const handleBulkAssignmentUpdate = async (orderIds: number[], assignedToUserId: string | null, assignmentType: 'store_man' | 'kitchen_runner' | null) => {
        if (orderIds.length === 0 || !onBulkAssignmentUpdate) return;

        setUpdatingAssignmentIds(new Set(orderIds));
        try {
            await onBulkAssignmentUpdate(orderIds, assignedToUserId, assignmentType);
        } catch (error) {
            console.error('Error updating order assignments', error);
            alert('Failed to update order assignments. Please try again.');
        } finally {
            setUpdatingAssignmentIds(new Set());
        }
    };

    const handleOrderToggle = (orderId: number) => {
        setSelectedOrderIds(prev => {
            const next = new Set(prev);
            if (next.has(orderId)) {
                next.delete(orderId);
            } else {
                next.add(orderId);
            }
            return next;
        });
    };

    const handleSelectAll = () => {
        const allOrderIds = new Set(filteredOrders.map(o => o.order_id));
        setSelectedOrderIds(allOrderIds);
    };

    const handleDeselectAll = () => {
        setSelectedOrderIds(new Set());
    };

    const selectedOrders = useMemo(() => {
        return Array.from(selectedOrderIds);
    }, [selectedOrderIds]);

    const totalReadyOrders = filteredOrders.length;

    // Reset selection when tab changes
    useEffect(() => {
        setSelectedOrderIds(new Set());
    }, [activeTab]);

    return (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm h-full flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-200">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <Truck className="h-5 w-5 text-indigo-600" />
                        <h2 className="text-lg font-semibold text-slate-900">Delivery Routing</h2>
                    </div>
                    <div className="text-sm text-slate-600">
                        {totalReadyOrders} order{totalReadyOrders !== 1 ? 's' : ''} ready
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 border-b border-slate-200 -mb-3">
                    <button
                        onClick={() => setActiveTab('kitchen_runner')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                            activeTab === 'kitchen_runner'
                                ? 'border-orange-500 text-orange-700'
                                : 'border-transparent text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <UtensilsCrossed className="h-4 w-4" />
                        Kitchen Runner
                        <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                            activeTab === 'kitchen_runner'
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-slate-100 text-slate-600'
                        }`}>
                            {deliveryOrders.filter(o => o.assignment_type === 'kitchen_runner').length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('store_man')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                            activeTab === 'store_man'
                                ? 'border-emerald-500 text-emerald-700'
                                : 'border-transparent text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Package className="h-4 w-4" />
                        Store Man
                        <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                            activeTab === 'store_man'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                        }`}>
                            {deliveryOrders.filter(o => o.assignment_type === 'store_man').length}
                        </span>
                    </button>
                </div>

                {/* Bulk Actions */}
                {selectedOrders.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-slate-600">
                            {selectedOrders.length} selected
                        </span>
                        {onBulkAssignmentUpdate && (
                            <select
                                onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === 'unassigned') {
                                        handleBulkAssignmentUpdate(selectedOrders, null, null);
                                    } else if (value === 'store_man') {
                                        handleBulkAssignmentUpdate(selectedOrders, null, 'store_man');
                                    } else if (value === 'kitchen_runner') {
                                        handleBulkAssignmentUpdate(selectedOrders, null, 'kitchen_runner');
                                    } else if (value !== '') {
                                        const user = assignableUsers.find(u => u.id === value);
                                        if (user) {
                                            handleBulkAssignmentUpdate(selectedOrders, user.id, user.role as 'store_man' | 'kitchen_runner');
                                        }
                                    }
                                    e.target.value = '';
                                }}
                                disabled={updatingAssignmentIds.size > 0 || updatingOrderIds.size > 0}
                                className="px-3 py-1.5 text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50"
                            >
                                <option value="">Bulk Assign...</option>
                                <option value="unassigned">Unassign All</option>
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
                        )}
                        <button
                            onClick={() => handleBulkStatusUpdate(selectedOrders, 'processing')}
                            disabled={updatingOrderIds.size > 0 || updatingAssignmentIds.size > 0}
                            className="px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                        >
                            {updatingOrderIds.size > 0 ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                            )}
                            Mark Processing
                        </button>
                        <button
                            onClick={() => handleBulkStatusUpdate(selectedOrders, 'delivered')}
                            disabled={updatingOrderIds.size > 0 || updatingAssignmentIds.size > 0}
                            className="px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                        >
                            {updatingOrderIds.size > 0 ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Truck className="h-3.5 w-3.5" />
                            )}
                            Mark Delivered
                        </button>
                        <button
                            onClick={() => handleBulkStatusUpdate(selectedOrders, 'cancelled')}
                            disabled={updatingOrderIds.size > 0 || updatingAssignmentIds.size > 0}
                            className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                        >
                            {updatingOrderIds.size > 0 ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <XCircle className="h-3.5 w-3.5" />
                            )}
                            Cancel Orders
                        </button>
                        <button
                            onClick={handleDeselectAll}
                            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            Clear Selection
                        </button>
                    </div>
                )}
            </div>

            {/* Orders Table */}
            <div className="flex-1 overflow-y-auto">
                {filteredOrders.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        <Truck className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                        <p>No orders ready for delivery for {activeTab === 'kitchen_runner' ? 'Kitchen Runner' : 'Store Man'}.</p>
                        <p className="text-sm mt-2">Orders with status "Approved" or "Processing" will appear here.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                        <input
                                            type="checkbox"
                                            checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    handleSelectAll();
                                                } else {
                                                    handleDeselectAll();
                                                }
                                            }}
                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Order</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Location</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Type</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Status</th>
                                    {onBulkAssignmentUpdate && (
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Assigned To</th>
                                    )}
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {filteredOrders.map(order => {
                                    const isSelected = selectedOrderIds.has(order.order_id);
                                    const isUpdating = updatingOrderIds.has(order.order_id) || updatingAssignmentIds.has(order.order_id);

                                    return (
                                        <tr
                                            key={order.order_id}
                                            className={`hover:bg-slate-50 transition-colors ${
                                                isSelected ? 'bg-indigo-50/50' : ''
                                            }`}
                                        >
                                            {/* Checkbox */}
                                            <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleOrderToggle(order.order_id)}
                                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                />
                                            </td>

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
                                            {onBulkAssignmentUpdate && (
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
                                                                handleBulkAssignmentUpdate([order.order_id], null, null);
                                                            } else if (value === 'store_man') {
                                                                handleBulkAssignmentUpdate([order.order_id], null, 'store_man');
                                                            } else if (value === 'kitchen_runner') {
                                                                handleBulkAssignmentUpdate([order.order_id], null, 'kitchen_runner');
                                                            } else {
                                                                const user = assignableUsers.find(u => u.id === value);
                                                                if (user) {
                                                                    handleBulkAssignmentUpdate([order.order_id], user.id, user.role as 'store_man' | 'kitchen_runner');
                                                                }
                                                            }
                                                        }}
                                                        disabled={isUpdating}
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
                                                </td>
                                            )}

                                            {/* Actions */}
                                            <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {order.status === 'approved' && (
                                                        <button
                                                            onClick={() => handleBulkStatusUpdate([order.order_id], 'processing')}
                                                            disabled={isUpdating}
                                                            title="Start Processing"
                                                            className="p-1.5 text-xs font-medium rounded border transition-colors flex items-center justify-center bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 disabled:opacity-50"
                                                        >
                                                            <CheckCircle2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {(order.status === 'approved' || order.status === 'processing') && (
                                                        <button
                                                            onClick={() => handleBulkStatusUpdate([order.order_id], 'delivered')}
                                                            disabled={isUpdating}
                                                            title="Mark Delivered"
                                                            className="p-1.5 text-xs font-medium rounded border transition-colors flex items-center justify-center bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 disabled:opacity-50"
                                                        >
                                                            <Truck className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {(order.status === 'approved' || order.status === 'processing') && (
                                                        <button
                                                            onClick={() => handleBulkStatusUpdate([order.order_id], 'cancelled')}
                                                            disabled={isUpdating}
                                                            title="Cancel"
                                                            className="p-1.5 text-xs font-medium rounded border transition-colors flex items-center justify-center bg-red-50 text-red-700 border-red-200 hover:bg-red-100 disabled:opacity-50"
                                                        >
                                                            <XCircle className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {isUpdating && (
                                                        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
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

            {/* Quick Actions Footer */}
            {filteredOrders.length > 0 && (
                <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div className="text-sm text-slate-600">
                        {selectedOrders.length > 0 ? (
                            <span>
                                {selectedOrders.length} order{selectedOrders.length !== 1 ? 's' : ''} selected
                            </span>
                        ) : (
                            <span>Select orders to bulk update</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSelectAll}
                            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            Select All
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
