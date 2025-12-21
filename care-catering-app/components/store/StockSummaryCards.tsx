'use client';

import { useMemo } from 'react';
import { Database } from '@/types/database.types';
import { Package, AlertTriangle, ShoppingCart, Warehouse } from 'lucide-react';

type StockRow = Database['public']['Views']['report_stock_by_location']['Row'];
type OrderRow = Database['public']['Views']['report_orders_summary']['Row'];

type StockSummaryCardsProps = {
    stockData: StockRow[];
    ordersData?: OrderRow[];
    productsData?: Array<{ storage_stock: number; storage_reorder_point: number }>;
    onCardClick?: (key: 'locations_low' | 'items_below' | 'pending_restock' | 'storage_alerts') => void;
};

export function StockSummaryCards({ stockData, ordersData = [], productsData = [], onCardClick }: StockSummaryCardsProps) {
    const stats = useMemo(() => {
        // Locations with low stock (below reorder point)
        const locationsWithLowStock = new Set(
            stockData.filter(row => row.current_stock < row.reorder_point).map(row => row.location_id)
        ).size;

        // Items below reorder point
        const itemsBelowReorderPoint = stockData.filter(row => row.current_stock < row.reorder_point).length;

        // Pending restock orders
        const pendingRestockOrders = ordersData.filter(
            order => order.type === 'proactive_restock' && order.status === 'pending'
        ).length;

        // Storage stock summary
        const storageItemsLow = productsData.filter(p => p.storage_stock < p.storage_reorder_point).length;
        const totalStorageItems = productsData.length;

        return {
            locationsWithLowStock,
            itemsBelowReorderPoint,
            pendingRestockOrders,
            storageItemsLow,
            totalStorageItems,
        };
    }, [stockData, ordersData, productsData]);

    const cards = [
        {
            title: 'Locations with Low Stock',
            value: stats.locationsWithLowStock,
            icon: AlertTriangle,
            color: 'bg-red-50 text-red-600',
            borderColor: 'border-red-200',
            key: 'locations_low' as const,
        },
        {
            title: 'Items Below Reorder Point',
            value: stats.itemsBelowReorderPoint,
            icon: Package,
            color: 'bg-amber-50 text-amber-600',
            borderColor: 'border-amber-200',
            key: 'items_below' as const,
        },
        {
            title: 'Pending Restock Orders',
            value: stats.pendingRestockOrders,
            icon: ShoppingCart,
            color: 'bg-blue-50 text-blue-600',
            borderColor: 'border-blue-200',
            key: 'pending_restock' as const,
        },
        {
            title: 'Storage Stock Alerts',
            value: `${stats.storageItemsLow}${stats.totalStorageItems > 0 ? ` / ${stats.totalStorageItems}` : ''}`,
            icon: Warehouse,
            color: 'bg-purple-50 text-purple-600',
            borderColor: 'border-purple-200',
            key: 'storage_alerts' as const,
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {cards.map((card, index) => {
                const Icon = card.icon;
                return (
                    <button
                        key={index}
                        type="button"
                        onClick={() => onCardClick?.(card.key)}
                        className={`text-left p-4 bg-white border ${card.borderColor} rounded-lg shadow-sm hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2`}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600 mb-1">{card.title}</p>
                                <p className="text-2xl font-bold text-slate-900">{card.value}</p>
                            </div>
                            <div className={`p-3 rounded-lg ${card.color}`}>
                                <Icon className="h-6 w-6" />
                            </div>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

