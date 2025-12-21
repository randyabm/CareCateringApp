'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { X, FileText, Download, Calendar, Filter, Loader2, Package, UtensilsCrossed, BarChart3, TrendingUp } from 'lucide-react';
import type { Database } from '@/types/database.types';
import { createClient } from '@/utils/supabase/client';
import { OrderDetailsModal } from '@/components/ward/OrderDetailsModal';

type OrderRow = Database['public']['Views']['report_orders_summary']['Row'];
type MovementRow = Database['public']['Views']['report_stock_movements']['Row'];
type CateringDetail = Database['public']['Tables']['catering_details']['Row'];
type DietCode = Database['public']['Tables']['diet_codes']['Row'];
type Location = Database['public']['Tables']['locations']['Row'];

const STATUS_STYLES: Record<OrderRow['status'], string> = {
    pending: 'bg-amber-50 text-amber-800 border-amber-200',
    approved: 'bg-sky-50 text-sky-800 border-sky-200',
    processing: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    delivered: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    cancelled: 'bg-red-50 text-red-800 border-red-200',
};

type KitchenReportsMenuProps = {
    isOpen: boolean;
    onClose: () => void;
    locations: Location[];
};

type ReportFilters = {
    dateFrom: string;
    dateTo: string;
    type: 'all' | 'catering' | 'grocery';
    status: OrderRow['status'] | 'all';
    locationId: string;
};

type Statistics = {
    totalOrders: number;
    ordersByType: { catering: number; grocery: number };
    ordersByStatus: Record<OrderRow['status'], number>;
    topLocations: Array<{ locationName: string; count: number }>;
    averageProcessingTime: number | null;
};

export function KitchenReportsMenu({ isOpen, onClose, locations }: KitchenReportsMenuProps) {
    const supabase = createClient();
    const [loading, setLoading] = useState(false);
    const [orders, setOrders] = useState<OrderRow[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
    const [modalItems, setModalItems] = useState<MovementRow[]>([]);
    const [modalCateringDetail, setModalCateringDetail] = useState<CateringDetail | null>(null);
    const [modalDietaryFlags, setModalDietaryFlags] = useState<DietCode[]>([]);
    const [modalLoading, setModalLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // Initialize filters with default values (last 7 days)
    const getDefaultFilters = (): ReportFilters => {
        const today = new Date();
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        return {
            dateFrom: sevenDaysAgo.toISOString().split('T')[0],
            dateTo: today.toISOString().split('T')[0],
            type: 'all',
            status: 'all',
            locationId: 'all',
        };
    };

    const [filters, setFilters] = useState<ReportFilters>(getDefaultFilters());
    const [statistics, setStatistics] = useState<Statistics | null>(null);

    const fetchOrders = useCallback(async () => {
        if (!filters.dateFrom || !filters.dateTo) return;

        setLoading(true);
        try {
            let query = supabase
                .from('report_orders_summary')
                .select('*')
                .gte('created_at', `${filters.dateFrom}T00:00:00`)
                .lte('created_at', `${filters.dateTo}T23:59:59`)
                .order('created_at', { ascending: false });

            if (filters.type !== 'all') {
                query = query.eq('type', filters.type);
            } else {
                query = query.in('type', ['catering', 'grocery', 'proactive_restock', 'future_order']);
            }

            if (filters.status !== 'all') {
                query = query.eq('status', filters.status);
            }

            if (filters.locationId !== 'all') {
                query = query.eq('location_id', parseInt(filters.locationId, 10));
            }

            const { data, error } = await query;

            if (error) throw error;
            setOrders(data || []);
            calculateStatistics(data || []);
        } catch (err) {
            console.error('Error fetching orders', err);
        } finally {
            setLoading(false);
        }
    }, [supabase, filters]);

    const calculateStatistics = (ordersData: OrderRow[]) => {
        const stats: Statistics = {
            totalOrders: ordersData.length,
            ordersByType: {
                catering: ordersData.filter(o => o.type === 'catering').length,
                grocery: ordersData.filter(o => o.type === 'grocery' || o.type === 'proactive_restock' || o.type === 'future_order').length,
            },
            ordersByStatus: {
                pending: 0,
                approved: 0,
                processing: 0,
                delivered: 0,
                cancelled: 0,
            },
            topLocations: [],
            averageProcessingTime: null,
        };

        // Count by status
        ordersData.forEach(order => {
            stats.ordersByStatus[order.status]++;
        });

        // Top locations
        const locationCounts = new Map<string, number>();
        ordersData.forEach(order => {
            if (order.location_name) {
                const count = locationCounts.get(order.location_name) || 0;
                locationCounts.set(order.location_name, count + 1);
            }
        });

        stats.topLocations = Array.from(locationCounts.entries())
            .map(([locationName, count]) => ({ locationName, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // Calculate average processing time (time from created to updated for delivered orders)
        const deliveredOrders = ordersData.filter(o => o.status === 'delivered');
        if (deliveredOrders.length > 0) {
            const totalTime = deliveredOrders.reduce((sum, order) => {
                const created = new Date(order.created_at).getTime();
                const updated = new Date(order.updated_at).getTime();
                return sum + (updated - created);
            }, 0);
            stats.averageProcessingTime = totalTime / deliveredOrders.length / (1000 * 60); // Convert to minutes
        }

        setStatistics(stats);
    };

    useEffect(() => {
        if (isOpen) {
            fetchOrders();
        }
    }, [isOpen, fetchOrders]);

    const handleSearch = () => {
        setCurrentPage(1);
        fetchOrders();
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

            // Fetch catering details if catering order
            if (order.type === 'catering') {
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

                        const { data: flagsData } = await supabase
                            .from('order_dietary_flags')
                            .select('diet_code_id')
                            .eq('order_id', order.order_id);

                        if (flagsData && flagsData.length > 0) {
                            dietCodeIds.push(...flagsData.map(f => f.diet_code_id));
                        }

                        if (dietCodeIds.length > 0) {
                            const { data: dietCodesData } = await supabase
                                .from('diet_codes')
                                .select('*')
                                .in('id', dietCodeIds);

                            if (dietCodesData) {
                                setModalDietaryFlags(dietCodesData as DietCode[]);
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

    const exportToCSV = () => {
        if (orders.length === 0) return;

        const headers = ['Order ID', 'Type', 'Status', 'Location', 'Created At', 'Items Count', 'Total Quantity', 'User'];
        const rows = orders.map(order => [
            order.order_id.toString(),
            order.type === 'grocery' ? 'Restock' : order.type,
            order.status,
            order.location_name || 'N/A',
            new Date(order.created_at).toLocaleString(),
            order.items_count.toString(),
            order.total_quantity.toString(),
            order.user_name || order.requested_by || 'N/A',
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `kitchen-orders-report-${filters.dateFrom}-to-${filters.dateTo}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const paginatedOrders = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        return orders.slice(start, end);
    }, [orders, currentPage]);

    const totalPages = Math.ceil(orders.length / itemsPerPage);

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                        <div className="flex items-center gap-3">
                            <FileText className="h-6 w-6 text-indigo-600" />
                            <div>
                                <h2 className="text-xl font-semibold text-slate-900">Order Reports</h2>
                                <p className="text-sm text-slate-500">Search and analyze historical orders</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                        <div className="flex items-center gap-2 mb-3">
                            <Filter className="h-4 w-4 text-slate-400" />
                            <span className="text-sm font-medium text-slate-600">Filters</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                            <div className="flex flex-col">
                                <label className="text-xs text-slate-500 mb-1">From Date</label>
                                <input
                                    type="date"
                                    value={filters.dateFrom}
                                    onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-xs text-slate-500 mb-1">To Date</label>
                                <input
                                    type="date"
                                    value={filters.dateTo}
                                    onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-xs text-slate-500 mb-1">Order Type</label>
                                <select
                                    value={filters.type}
                                    onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value as any }))}
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="all">All Types</option>
                                    <option value="catering">Catering</option>
                                    <option value="grocery">Restock (Grocery)</option>
                                    <option value="proactive_restock">Proactive Restock</option>
                                    <option value="future_order">Future Order</option>
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <label className="text-xs text-slate-500 mb-1">Status</label>
                                <select
                                    value={filters.status}
                                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="all">All Status</option>
                                    <option value="pending">Pending</option>
                                    <option value="approved">Approved</option>
                                    <option value="processing">Processing</option>
                                    <option value="delivered">Delivered</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <label className="text-xs text-slate-500 mb-1">Location</label>
                                <select
                                    value={filters.locationId}
                                    onChange={(e) => setFilters(prev => ({ ...prev, locationId: e.target.value }))}
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="all">All Locations</option>
                                    {locations.map(loc => (
                                        <option key={loc.id} value={loc.id.toString()}>
                                            {loc.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-end">
                                <button
                                    onClick={handleSearch}
                                    disabled={loading}
                                    className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Filter className="h-4 w-4" />
                                            Search
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Statistics Panel */}
                    {statistics && (
                        <div className="px-6 py-4 border-b border-slate-200 bg-indigo-50/30">
                            <div className="flex items-center gap-2 mb-3">
                                <BarChart3 className="h-4 w-4 text-indigo-600" />
                                <span className="text-sm font-medium text-indigo-900">Statistics</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <div className="bg-white rounded-lg p-3 border border-indigo-200">
                                    <div className="text-xs text-slate-500 mb-1">Total Orders</div>
                                    <div className="text-2xl font-bold text-indigo-600">{statistics.totalOrders}</div>
                                </div>
                                <div className="bg-white rounded-lg p-3 border border-orange-200">
                                    <div className="text-xs text-slate-500 mb-1">Catering</div>
                                    <div className="text-2xl font-bold text-orange-600">{statistics.ordersByType.catering}</div>
                                </div>
                                <div className="bg-white rounded-lg p-3 border border-emerald-200">
                                    <div className="text-xs text-slate-500 mb-1">Restock</div>
                                    <div className="text-2xl font-bold text-emerald-600">{statistics.ordersByType.grocery}</div>
                                </div>
                                <div className="bg-white rounded-lg p-3 border border-sky-200">
                                    <div className="text-xs text-slate-500 mb-1">Delivered</div>
                                    <div className="text-2xl font-bold text-sky-600">{statistics.ordersByStatus.delivered}</div>
                                </div>
                                <div className="bg-white rounded-lg p-3 border border-amber-200">
                                    <div className="text-xs text-slate-500 mb-1">Pending</div>
                                    <div className="text-2xl font-bold text-amber-600">{statistics.ordersByStatus.pending}</div>
                                </div>
                            </div>
                            {statistics.averageProcessingTime !== null && (
                                <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                                    <TrendingUp className="h-4 w-4" />
                                    <span>Average processing time: <strong>{Math.round(statistics.averageProcessingTime)} minutes</strong></span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Results Table */}
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="flex flex-col items-center gap-3">
                                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                                    <p className="text-sm text-slate-600">Loading orders...</p>
                                </div>
                            </div>
                        ) : orders.length === 0 ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="text-center">
                                    <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                                    <p className="text-slate-600">No orders found</p>
                                    <p className="text-sm text-slate-500 mt-2">Try adjusting your filters</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-between bg-white sticky top-0 z-10">
                                    <div className="text-sm text-slate-600">
                                        Showing {paginatedOrders.length} of {orders.length} orders
                                    </div>
                                    <button
                                        onClick={exportToCSV}
                                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 text-sm"
                                    >
                                        <Download className="h-4 w-4" />
                                        Export CSV
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-slate-200">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Order ID</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Location</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Created At</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Items</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Quantity</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">User</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-slate-200">
                                            {paginatedOrders.map(order => (
                                                <tr key={order.order_id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3 text-sm font-medium text-slate-900">#{order.order_id}</td>
                                                    <td className="px-4 py-3 text-sm">
                                                        <div className="flex items-center gap-2">
                                                            {order.type === 'catering' ? (
                                                                <UtensilsCrossed className="h-4 w-4 text-orange-500" />
                                                            ) : (
                                                                <Package className="h-4 w-4 text-emerald-500" />
                                                            )}
                                                            <span className="capitalize">
                                                                {order.type === 'grocery' ? 'Restock' : 
                                                                 order.type === 'proactive_restock' ? 'Proactive Restock' :
                                                                 order.type === 'future_order' ? 'Future Order' : 
                                                                 order.type}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm">
                                                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[order.status]}`}>
                                                            {order.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-slate-700">{order.location_name || 'N/A'}</td>
                                                    <td className="px-4 py-3 text-sm text-slate-600">{new Date(order.created_at).toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-sm text-right text-slate-700">{order.items_count}</td>
                                                    <td className="px-4 py-3 text-sm text-right text-slate-700">{order.total_quantity}</td>
                                                    <td className="px-4 py-3 text-sm text-slate-700">{order.user_name || order.requested_by || 'N/A'}</td>
                                                    <td className="px-4 py-3 text-sm">
                                                        <button
                                                            onClick={() => handleOrderClick(order)}
                                                            className="text-indigo-600 hover:text-indigo-800 font-medium"
                                                        >
                                                            View Details
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {totalPages > 1 && (
                                    <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                                        <div className="text-sm text-slate-600">
                                            Page {currentPage} of {totalPages}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                                disabled={currentPage === 1}
                                                className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Previous
                                            </button>
                                            <button
                                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                                disabled={currentPage === totalPages}
                                                className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
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
        </>
    );
}

