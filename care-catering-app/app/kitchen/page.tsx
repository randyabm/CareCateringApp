'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Database } from '@/types/database.types';
import { KitchenOrderFeed } from '@/components/kitchen/KitchenOrderFeed';
import { KitchenDeliveryRouting } from '@/components/kitchen/KitchenDeliveryRouting';
import { KitchenReportsMenu } from '@/components/kitchen/KitchenReportsMenu';
import { Loader2, RefreshCw, AlertCircle, Wifi, WifiOff, FileText } from 'lucide-react';
import { getMockUser, isTestMode, getTestModeInfo, setTestModeRole, getAvailableRoles } from '@/lib/mockAuth';

type OrderRow = Database['public']['Views']['report_orders_summary']['Row'];
type Location = Database['public']['Tables']['locations']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

export default function KitchenPage() {
    const supabase = useMemo(() => createClient(), []);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [orders, setOrders] = useState<OrderRow[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [realtimeConnected, setRealtimeConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reportsMenuOpen, setReportsMenuOpen] = useState(false);
    const [testRole, setTestRole] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('test_mode_role') || getTestModeInfo()?.role || 'nurse';
        }
        return getTestModeInfo()?.role || 'nurse';
    });

    const fetchOrders = useCallback(async () => {
        try {
            const { data, error: ordersError } = await supabase
                .from('report_orders_summary')
                .select('*')
                .in('type', ['catering', 'grocery', 'proactive_restock', 'future_order'])
                .order('created_at', { ascending: false });

            if (ordersError) throw ordersError;
            setOrders(data || []);
            setError(null);
        } catch (err) {
            console.error('Error fetching orders', err);
            setError(err instanceof Error ? err.message : 'Failed to load orders');
        }
    }, [supabase]);

    const fetchData = useCallback(async () => {
        setRefreshing(true);
        try {
            // Check if test mode is enabled
            const mockData = getMockUser();
            
            let user;
            let profileData: Profile | null = null;

            if (mockData && isTestMode()) {
                user = mockData.user;
                profileData = mockData.profile;
            } else {
                const {
                    data: { user: authUser },
                } = await supabase.auth.getUser();

                if (!authUser) {
                    setLoading(false);
                    setRefreshing(false);
                    return;
                }

                user = authUser;

                // Fetch profile
                const { data: fetchedProfile, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (profileError) throw profileError;
                profileData = fetchedProfile;
            }

            setProfile(profileData);

            // Check if user is kitchen staff
            if (profileData?.role !== 'kitchen_staff' && profileData?.role !== 'admin') {
                setError('Access denied. This page is only available to kitchen staff.');
                setLoading(false);
                setRefreshing(false);
                return;
            }

            // Fetch locations
            const { data: locationsData, error: locationsError } = await supabase
                .from('locations')
                .select('*')
                .order('name');

            if (locationsError) throw locationsError;
            setLocations(locationsData || []);

            // Fetch orders
            await fetchOrders();
        } catch (err) {
            console.error('Error fetching data:', err);
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [supabase, fetchOrders]);

    // Set up real-time subscription
    useEffect(() => {
        let subscription: ReturnType<typeof supabase.channel> | null = null;

        const setupRealtime = () => {
            subscription = supabase
                .channel('kitchen-orders')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'orders',
                        filter: 'type=in.(catering,grocery,proactive_restock,future_order)',
                    },
                    (payload) => {
                        console.log('Realtime update:', payload);
                        // Refetch orders when changes occur
                        fetchOrders();
                    }
                )
                .subscribe((status) => {
                    console.log('Realtime status:', status);
                    setRealtimeConnected(status === 'SUBSCRIBED');
                });

            return subscription;
        };

        const sub = setupRealtime();

        return () => {
            if (sub) {
                supabase.removeChannel(sub);
            }
        };
    }, [supabase, fetchOrders]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleStatusUpdate = useCallback(
        async (orderId: number, newStatus: OrderRow['status']) => {
            const { error: updateError } = await supabase
                .from('orders')
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', orderId);

            if (updateError) {
                throw updateError;
            }

            // Update local state optimistically
            setOrders(prev =>
                prev.map(order =>
                    order.order_id === orderId ? { ...order, status: newStatus } : order
                )
            );
        },
        [supabase]
    );

    const handleBulkStatusUpdate = useCallback(
        async (orderIds: number[], newStatus: OrderRow['status']) => {
            const { error: updateError } = await supabase
                .from('orders')
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .in('id', orderIds);

            if (updateError) {
                throw updateError;
            }

            // Update local state optimistically
            setOrders(prev =>
                prev.map(order =>
                    orderIds.includes(order.order_id) ? { ...order, status: newStatus } : order
                )
            );
        },
        [supabase]
    );

    const handleAssignmentUpdate = useCallback(
        async (orderId: number, assignedToUserId: string | null, assignmentType: 'store_man' | 'kitchen_runner' | null) => {
            const { error: updateError } = await supabase
                .from('orders')
                .update({ 
                    assigned_to_user_id: assignedToUserId,
                    assignment_type: assignmentType,
                    updated_at: new Date().toISOString() 
                })
                .eq('id', orderId);

            if (updateError) {
                throw updateError;
            }

            // Refetch orders to get updated assignment info
            await fetchOrders();
        },
        [supabase, fetchOrders]
    );

    const handleBulkAssignmentUpdate = useCallback(
        async (orderIds: number[], assignedToUserId: string | null, assignmentType: 'store_man' | 'kitchen_runner' | null) => {
            const { error: updateError } = await supabase
                .from('orders')
                .update({ 
                    assigned_to_user_id: assignedToUserId,
                    assignment_type: assignmentType,
                    updated_at: new Date().toISOString() 
                })
                .in('id', orderIds);

            if (updateError) {
                throw updateError;
            }

            // Refetch orders to get updated assignment info
            await fetchOrders();
        },
        [supabase, fetchOrders]
    );

    if (loading) {
        return (
            <div className="min-h-screen w-full bg-gradient-to-br from-background to-secondary dark:from-background dark:to-cyan-950/20 text-foreground p-8">
                <div className="max-w-7xl mx-auto flex items-center justify-center h-96">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                        <p className="text-slate-600">Loading kitchen dispatch...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error && !profile) {
        return (
            <div className="min-h-screen w-full bg-gradient-to-br from-background to-secondary dark:from-background dark:to-cyan-950/20 text-foreground p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                        <AlertCircle className="h-8 w-8 text-red-600 mx-auto mb-4" />
                        <p className="text-red-800 font-semibold mb-2">Error</p>
                        <p className="text-red-700">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-background to-secondary dark:from-background dark:to-cyan-950/20 text-foreground p-4 md:p-8">
            <div className="max-w-[1800px] mx-auto">
                {/* Header */}
                <header className="mb-6">
                    {isTestMode() && (
                        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertCircle className="h-5 w-5 text-amber-600" />
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-amber-900">Test Mode Active</p>
                                    <p className="text-xs text-amber-700">
                                        Simulating as: <span className="font-medium">{testRole}</span>
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-amber-200">
                                <label htmlFor="test-role-select" className="text-xs font-medium text-amber-900">
                                    Change Role:
                                </label>
                                <select
                                    id="test-role-select"
                                    value={testRole}
                                    onChange={(e) => {
                                        const newRole = e.target.value;
                                        setTestModeRole(newRole as Profile['role']);
                                        setTestRole(newRole);
                                        // Reload the page to apply the new role
                                        window.location.reload();
                                    }}
                                    className="px-3 py-1.5 text-xs font-medium bg-white border border-amber-300 rounded-lg text-amber-900 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                >
                                    {getAvailableRoles().map((role) => (
                                        <option key={role} value={role}>
                                            {role === 'kitchen_staff' ? 'Kitchen Staff' : 
                                             role === 'store_man' ? 'Store Man' :
                                             role === 'kitchen_runner' ? 'Kitchen Runner' :
                                             role.charAt(0).toUpperCase() + role.slice(1)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-bold text-primary mb-2">Kitchen Dispatch</h1>
                            <p className="text-muted-foreground">
                                Monitor all orders (catering, restock, and store-managed orders) and manage food preparation workflow.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Realtime Status Indicator */}
                            <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg">
                                {realtimeConnected ? (
                                    <>
                                        <Wifi className="h-4 w-4 text-emerald-600" />
                                        <span className="text-xs text-slate-600">Live</span>
                                    </>
                                ) : (
                                    <>
                                        <WifiOff className="h-4 w-4 text-slate-400" />
                                        <span className="text-xs text-slate-500">Offline</span>
                                    </>
                                )}
                            </div>
                            <button
                                onClick={() => setReportsMenuOpen(true)}
                                className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
                            >
                                <FileText className="h-4 w-4" />
                                <span className="text-sm font-medium">Reports</span>
                            </button>
                            <button
                                onClick={fetchData}
                                disabled={refreshing}
                                className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {refreshing ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="h-4 w-4" />
                                )}
                                <span className="text-sm font-medium">Refresh</span>
                            </button>
                        </div>
                    </div>
                </header>

                {/* Error Banner */}
                {error && (
                    <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-red-900">Error</p>
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                        <button
                            onClick={() => {
                                setError(null);
                                fetchData();
                            }}
                            className="px-3 py-1.5 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {/* Split View */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-250px)] min-h-[600px]">
                    {/* Left Panel - Live Order Feed */}
                    <div className="h-full">
                        <KitchenOrderFeed
                            orders={orders}
                            locations={locations}
                            onStatusUpdate={handleStatusUpdate}
                            onAssignmentUpdate={handleAssignmentUpdate}
                            onRefresh={fetchOrders}
                        />
                    </div>

                    {/* Right Panel - Delivery Routing */}
                    <div className="h-full">
                        <KitchenDeliveryRouting
                            orders={orders}
                            locations={locations}
                            onBulkStatusUpdate={handleBulkStatusUpdate}
                            onBulkAssignmentUpdate={handleBulkAssignmentUpdate}
                        />
                    </div>
                </div>
            </div>

            {/* Reports Menu Modal */}
            <KitchenReportsMenu
                isOpen={reportsMenuOpen}
                onClose={() => setReportsMenuOpen(false)}
                locations={locations}
            />
        </div>
    );
}
