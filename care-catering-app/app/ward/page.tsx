'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Database } from '@/types/database.types';
import { WardRestockOrderForm } from '@/components/ward/WardRestockOrderForm';
import { WardCateringOrderForm } from '@/components/ward/WardCateringOrderForm';
import { WardOrdersList } from '@/components/ward/WardOrdersList';
import { Loader2, Package, UtensilsCrossed, ClipboardList, RefreshCw, AlertCircle } from 'lucide-react';
import { getMockUser, isTestMode, getTestModeInfo } from '@/lib/mockAuth';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Product = Database['public']['Tables']['products']['Row'];
type Location = Database['public']['Tables']['locations']['Row'];
type LocationProduct = Database['public']['Views']['report_stock_by_location']['Row'];

type Tab = 'restock' | 'catering' | 'history';

export default function WardPage() {
    const supabase = useMemo(() => createClient(), []);
    const [activeTab, setActiveTab] = useState<Tab>('catering');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [locationProducts, setLocationProducts] = useState<LocationProduct[]>([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const fetchData = async () => {
        setRefreshing(true);
        try {
            // Check if test mode is enabled
            const mockData = getMockUser();
            
            let user;
            let profileData: Profile | null = null;

            if (mockData && isTestMode()) {
                // Use mock data in test mode
                user = mockData.user;
                profileData = mockData.profile;
            } else {
                // Normal authentication flow
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

            // Fetch locations
            const { data: locationsData, error: locationsError } = await supabase
                .from('locations')
                .select('*')
                .order('name');

            if (locationsError) throw locationsError;
            setLocations(locationsData || []);

            if (profileData?.assigned_location_id) {
                // Fetch products
                const { data: productsData, error: productsError } = await supabase
                    .from('products')
                    .select('*')
                    .order('name');

                if (productsError) throw productsError;
                setProducts(productsData || []);

                // Fetch location products for stock info
                const { data: locationProductsData, error: locationProductsError } = await supabase
                    .from('report_stock_by_location')
                    .select('*')
                    .eq('location_id', profileData.assigned_location_id)
                    .order('product_name');

                if (locationProductsError) throw locationProductsError;
                setLocationProducts(locationProductsData || []);
            }
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

    const handleOrderCreated = () => {
        setRefreshTrigger(prev => prev + 1);
        // Switch to history tab after creating an order
        setTimeout(() => setActiveTab('history'), 500);
    };

    const tabs = [
        { id: 'catering' as Tab, label: 'Catering Order', icon: UtensilsCrossed },
        { id: 'restock' as Tab, label: 'Restock Order', icon: Package },
        { id: 'history' as Tab, label: 'Order History', icon: ClipboardList },
    ];

    if (loading) {
        return (
            <div className="min-h-screen w-full bg-gradient-to-br from-background to-secondary dark:from-background dark:to-cyan-950/20 text-foreground p-8">
                <div className="max-w-7xl mx-auto flex items-center justify-center h-96">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                        <p className="text-slate-600">Loading ward data...</p>
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
                    {isTestMode() && (
                        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-amber-600" />
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-amber-900">Test Mode Active</p>
                                <p className="text-xs text-amber-700">
                                    Simulating as: <span className="font-medium">{getTestModeInfo()?.role}</span>
                                    {getTestModeInfo()?.locationId && (
                                        <> | Location ID: <span className="font-medium">{getTestModeInfo()?.locationId}</span></>
                                    )}
                                </p>
                            </div>
                        </div>
                    )}
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-bold text-primary mb-2">Ward Ordering</h1>
                            <p className="text-muted-foreground">
                                Place restock orders for your ward or catering orders for patients.
                            </p>
                        </div>
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
                </header>

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
                    {activeTab === 'catering' && (
                        <WardCateringOrderForm
                            locationId={profile?.assigned_location_id ?? null}
                            locationName={locations.find(l => l.id === profile?.assigned_location_id)?.name ?? null}
                            onCreated={handleOrderCreated}
                        />
                    )}

                    {activeTab === 'restock' && (
                        <WardRestockOrderForm
                            locationId={profile?.assigned_location_id ?? null}
                            locationName={locations.find(l => l.id === profile?.assigned_location_id)?.name ?? null}
                            products={products}
                            locationProducts={locationProducts}
                            onCreated={handleOrderCreated}
                        />
                    )}

                    {activeTab === 'history' && (
                        <WardOrdersList
                            locationId={profile?.assigned_location_id ?? null}
                            onRefresh={refreshTrigger}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
