'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Database } from '@/types/database.types';
import { StockSummaryCards } from '@/components/store/StockSummaryCards';
import { InventoryTable } from '@/components/store/InventoryTable';
import { GapAnalysis } from '@/components/store/GapAnalysis';
import { RestockOrderGenerator } from '@/components/store/RestockOrderGenerator';
import { StockUpdateForm } from '@/components/store/StockUpdateForm';
import { StorageStock } from '@/components/store/StorageStock';
import { Loader2, Package, TrendingDown, ShoppingCart, Edit, Warehouse, ClipboardList, Truck, Megaphone } from 'lucide-react';
import { OrdersTable } from '@/components/store/OrdersTable';
import { OrderPicking } from '@/components/store/OrderPicking';
import { CustomOrderForm } from '@/components/store/CustomOrderForm';

type StockRow = Database['public']['Views']['report_stock_by_location']['Row'];
type OrderRow = Database['public']['Views']['report_orders_summary']['Row'];
type Location = Database['public']['Tables']['locations']['Row'];
type LocationGroup = Database['public']['Tables']['location_groups']['Row'];
type Category = Database['public']['Tables']['product_categories']['Row'];
type Product = Database['public']['Tables']['products']['Row'];
type Announcement = Database['public']['Tables']['announcements']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

type Tab = 'inventory' | 'gap-analysis' | 'restock' | 'update' | 'storage' | 'orders' | 'picking' | 'new-order';

export default function StorePage() {
    const supabase = useMemo(() => createClient(), []);
    const [activeTab, setActiveTab] = useState<Tab>('inventory');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Data state
    const [stockData, setStockData] = useState<StockRow[]>([]);
    const [ordersData, setOrdersData] = useState<OrderRow[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [groups, setGroups] = useState<LocationGroup[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [profile, setProfile] = useState<Profile | null>(null);

    const fetchData = async () => {
        setRefreshing(true);
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            let profileRow: Profile | null = null;
            if (user?.id) {
                const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                profileRow = profileData ?? null;
            }

            const today = new Date().toISOString().slice(0, 10);
            const announcementQuery = profileRow?.assigned_location_id
                ? supabase
                      .from('announcements')
                      .select('*')
                      .lte('start_date', today)
                      .gte('end_date', today)
                      .or(`location_id.is.null,location_id.eq.${profileRow.assigned_location_id}`)
                      .order('start_date', { ascending: false })
                : supabase
                      .from('announcements')
                      .select('*')
                      .lte('start_date', today)
                      .gte('end_date', today)
                      .is('location_id', null)
                      .order('start_date', { ascending: false });

            const [
                { data: stockRows, error: stockError },
                { data: orderRows, error: orderError },
                { data: locs, error: locError },
                { data: groupData, error: groupError },
                { data: cats, error: catError },
                { data: prods, error: prodError },
                { data: announcementRows, error: announcementError },
            ] = await Promise.all([
                supabase.from('report_stock_by_location').select('*').order('location_name'),
                supabase
                    .from('report_orders_summary')
                    .select('*')
                    .eq('type', 'proactive_restock')
                    .order('created_at', { ascending: false }),
                supabase.from('locations').select('*').order('name'),
                supabase.from('location_groups').select('*').order('name'),
                supabase.from('product_categories').select('*').order('name'),
                supabase.from('products').select('*').order('name'),
                announcementQuery,
            ]);

            if (stockError) throw stockError;
            if (orderError) throw orderError;
            if (locError) throw locError;
            if (groupError) throw groupError;
            if (catError) throw catError;
            if (prodError) throw prodError;
            if (announcementError) throw announcementError;

            setStockData(stockRows || []);
            setOrdersData(orderRows || []);
            setLocations(locs || []);
            setGroups(groupData || []);
            setCategories(cats || []);
            setProducts(prods || []);
            setAnnouncements(announcementRows || []);
            setProfile(profileRow);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const getLocationName = (id: number | null) => {
        if (!id) return 'All locations';
        const loc = locations.find(l => l.id === id);
        return loc ? loc.name : 'Location';
    };

    const formatDate = (dateStr: string) =>
        new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    const handleStockUpdate = async (locationId: number, productId: number, newStock: number) => {
        const { error } = await supabase
            .from('location_products')
            .update({ current_stock: newStock })
            .eq('location_id', locationId)
            .eq('product_id', productId);

        if (error) throw error;
        await fetchData();
    };

    const handleOrderCreated = async () => {
        await fetchData();
    };

    const handleUpdateComplete = async () => {
        await fetchData();
    };

    const tabs = [
        { id: 'inventory' as Tab, label: 'Inventory', icon: Package },
        { id: 'gap-analysis' as Tab, label: 'Gap Analysis', icon: TrendingDown },
        { id: 'restock' as Tab, label: 'Generate Orders', icon: ShoppingCart },
        { id: 'update' as Tab, label: 'Update Stock', icon: Edit },
        { id: 'storage' as Tab, label: 'Storage Stock', icon: Warehouse },
        { id: 'orders' as Tab, label: 'Orders', icon: ClipboardList },
        { id: 'picking' as Tab, label: 'Picking', icon: Truck },
        { id: 'new-order' as Tab, label: 'New Order', icon: ShoppingCart },
    ];

    if (loading) {
        return (
            <div className="min-h-screen w-full bg-gradient-to-br from-background to-secondary dark:from-background dark:to-cyan-950/20 text-foreground p-8">
                <div className="max-w-7xl mx-auto flex items-center justify-center h-96">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                        <p className="text-slate-600">Loading inventory data...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-background to-secondary dark:from-background dark:to-cyan-950/20 text-foreground p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <header className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-bold text-primary mb-2">Store Logistics</h1>
                            <p className="text-muted-foreground">Inventory management, par levels, and gap analysis.</p>
                        </div>
                        <button
                            onClick={fetchData}
                            disabled={refreshing}
                            className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {refreshing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <span className="text-sm font-medium">Refresh</span>
                            )}
                        </button>
                    </div>
                </header>

                {/* Announcements */}
                {announcements.length > 0 && (
                    <div className="mb-6">
                        <div className="flex items-center gap-2 text-sm text-emerald-700 mb-2">
                            <Megaphone className="h-4 w-4" />
                            <span>
                                Active announcements {profile?.assigned_location_id ? `for ${getLocationName(profile.assigned_location_id)}` : 'for all locations'}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {announcements.map(item => (
                                <div key={item.id} className="border border-emerald-100 bg-emerald-50/60 rounded-lg p-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs uppercase text-emerald-600 font-semibold">Announcement</p>
                                            <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                                        </div>
                                        <span className="text-xs text-emerald-700 bg-white border border-emerald-100 rounded-full px-3 py-1">
                                            {formatDate(item.start_date)} - {formatDate(item.end_date)}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-700 mt-2 whitespace-pre-line">{item.message}</p>
                                    <p className="mt-2 text-xs text-emerald-700">
                                        Location: <span className="font-medium">{getLocationName(item.location_id)}</span>
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Summary Cards */}
                <StockSummaryCards
                    stockData={stockData}
                    ordersData={ordersData}
                    productsData={products.map(p => ({
                        storage_stock: p.storage_stock,
                        storage_reorder_point: p.storage_reorder_point,
                    }))}
                    onCardClick={key => {
                        if (key === 'locations_low' || key === 'items_below') {
                            setActiveTab('gap-analysis');
                        } else if (key === 'pending_restock') {
                            setActiveTab('orders');
                        } else if (key === 'storage_alerts') {
                            setActiveTab('storage');
                        }
                    }}
                />

                {/* Tabs */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm mb-6">
                    <div className="border-b border-slate-200">
                        <nav className="flex overflow-x-auto" aria-label="Tabs">
                            {tabs.map(tab => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                                            isActive
                                                ? 'border-emerald-500 text-emerald-600'
                                                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                                        }`}
                                    >
                                        <Icon className="h-5 w-5" />
                                        <span>{tab.label}</span>
                                    </button>
                                );
                            })}
                        </nav>
                    </div>
                </div>

                {/* Tab Content */}
                <div className="bg-transparent">
                    {activeTab === 'inventory' && (
                        <InventoryTable
                            stockData={stockData}
                            locations={locations}
                            groups={groups}
                            categories={categories}
                            onStockUpdate={handleStockUpdate}
                        />
                    )}

                    {activeTab === 'gap-analysis' && (
                        <GapAnalysis
                            stockData={stockData}
                            locations={locations}
                            groups={groups}
                            categories={categories}
                        />
                    )}

                    {activeTab === 'restock' && (
                        <RestockOrderGenerator
                            stockData={stockData}
                            locations={locations}
                            groups={groups}
                            onOrderCreated={handleOrderCreated}
                        />
                    )}

                    {activeTab === 'update' && (
                        <StockUpdateForm
                            stockData={stockData}
                            locations={locations}
                            groups={groups}
                            onUpdateComplete={handleUpdateComplete}
                        />
                    )}

                    {activeTab === 'storage' && (
                        <StorageStock products={products} categories={categories} onUpdateComplete={handleUpdateComplete} />
                    )}

                    {activeTab === 'orders' && (
                        <OrdersTable
                            orders={ordersData}
                            selectedOrderIds={selectedOrderIds}
                            onSelectionChange={ids => {
                                setSelectedOrderIds(ids);
                            }}
                        />
                    )}

                    {activeTab === 'picking' && <OrderPicking selectedOrderIds={selectedOrderIds} />}

                    {activeTab === 'new-order' && (
                        <CustomOrderForm
                            locations={locations}
                            products={products}
                            onCreated={async () => {
                                await fetchData();
                                setActiveTab('orders');
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
