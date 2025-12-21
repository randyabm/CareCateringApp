'use client';

import { useState, useMemo } from 'react';
import { Database } from '@/types/database.types';
import { createClient } from '@/utils/supabase/client';
import { Loader2, Edit2, Check, X, Search, AlertTriangle, Warehouse } from 'lucide-react';

type Product = Database['public']['Tables']['products']['Row'];
type Category = Database['public']['Tables']['product_categories']['Row'];

type StorageStockProps = {
    products: Product[];
    categories: Category[];
    onUpdateComplete?: () => void;
};

export function StorageStock({ products, categories, onUpdateComplete }: StorageStockProps) {
    const supabase = createClient();
    const [editingProduct, setEditingProduct] = useState<number | null>(null);
    const [editValues, setEditValues] = useState<{ stock: string; reorderPoint: string }>({ stock: '', reorderPoint: '' });
    const [updating, setUpdating] = useState(false);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [alertFilter, setAlertFilter] = useState<'all' | 'low'>('all');

    const filteredProducts = useMemo(() => {
        let filtered = [...products];

        // Search filter
        if (search) {
            const searchLower = search.toLowerCase();
            filtered = filtered.filter(p => p.name.toLowerCase().includes(searchLower));
        }

        // Category filter
        if (categoryFilter !== 'all') {
            const categoryId = Number(categoryFilter);
            filtered = filtered.filter(p => p.category_id === categoryId);
        }

        // Alert filter
        if (alertFilter === 'low') {
            filtered = filtered.filter(p => p.storage_stock < p.storage_reorder_point);
        }

        return filtered.sort((a, b) => a.name.localeCompare(b.name));
    }, [products, search, categoryFilter, alertFilter]);

    const handleEditStart = (product: Product) => {
        setEditingProduct(product.id);
        setEditValues({
            stock: product.storage_stock.toString(),
            reorderPoint: product.storage_reorder_point.toString(),
        });
    };

    const handleEditCancel = () => {
        setEditingProduct(null);
        setEditValues({ stock: '', reorderPoint: '' });
    };

    const handleEditSave = async (productId: number) => {
        const stock = parseInt(editValues.stock, 10);
        const reorderPoint = parseInt(editValues.reorderPoint, 10);

        if (isNaN(stock) || stock < 0 || isNaN(reorderPoint) || reorderPoint < 0) {
            alert('Please enter valid non-negative numbers');
            return;
        }

        setUpdating(true);
        try {
            const { error } = await supabase
                .from('products')
                .update({
                    storage_stock: stock,
                    storage_reorder_point: reorderPoint,
                })
                .eq('id', productId);

            if (error) throw error;

            setEditingProduct(null);
            setEditValues({ stock: '', reorderPoint: '' });
            if (onUpdateComplete) {
                onUpdateComplete();
            }
        } catch (error) {
            console.error('Error updating storage stock:', error);
            alert('Failed to update storage stock. Please try again.');
        } finally {
            setUpdating(false);
        }
    };

    const lowStockCount = useMemo(
        () => products.filter(p => p.storage_stock < p.storage_reorder_point).length,
        [products]
    );

    return (
        <div className="space-y-6">
            {/* Summary */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                        <Warehouse className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900">Storage Stock Management</h3>
                        <p className="text-sm text-slate-500">Manage central warehouse stock levels and reorder points</p>
                    </div>
                </div>
                {lowStockCount > 0 && (
                    <div className="flex items-center gap-2 text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <AlertTriangle className="h-5 w-5" />
                        <span className="font-medium">
                            {lowStockCount} product{lowStockCount !== 1 ? 's' : ''} below reorder point
                        </span>
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="text-xs text-slate-500 mb-1 block">Search</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search products..."
                                className="w-full rounded-lg border border-slate-200 pl-10 pr-3 py-2 text-sm text-slate-700"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 mb-1 block">Category</label>
                        <select
                            value={categoryFilter}
                            onChange={e => setCategoryFilter(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                        >
                            <option value="all">All Categories</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id.toString()}>
                                    {cat.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 mb-1 block">Filter</label>
                        <select
                            value={alertFilter}
                            onChange={e => setAlertFilter(e.target.value as 'all' | 'low')}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                        >
                            <option value="all">All Products</option>
                            <option value="low">Low Stock Only</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Products Table */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Product</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Storage Stock</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Reorder Point</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">Status</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                                        No products found
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map(product => {
                                    const isEditing = editingProduct === product.id;
                                    const isLowStock = product.storage_stock < product.storage_reorder_point;

                                    return (
                                        <tr
                                            key={product.id}
                                            className={`hover:bg-slate-50 ${isLowStock ? 'bg-red-50' : ''}`}
                                        >
                                            <td className="px-4 py-3 text-sm font-medium text-slate-900">
                                                {product.name}
                                                {product.unit_size ? ` (${product.unit_size})` : ''}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right">
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        value={editValues.stock}
                                                        onChange={e => setEditValues(prev => ({ ...prev, stock: e.target.value }))}
                                                        className="w-24 px-2 py-1 border border-slate-300 rounded text-sm text-right"
                                                        min="0"
                                                        autoFocus
                                                        disabled={updating}
                                                    />
                                                ) : (
                                                    <span className="font-medium">{product.storage_stock}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right">
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        value={editValues.reorderPoint}
                                                        onChange={e =>
                                                            setEditValues(prev => ({ ...prev, reorderPoint: e.target.value }))
                                                        }
                                                        className="w-24 px-2 py-1 border border-slate-300 rounded text-sm text-right"
                                                        min="0"
                                                        disabled={updating}
                                                    />
                                                ) : (
                                                    <span className="text-slate-600">{product.storage_reorder_point}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {isLowStock ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                                                        Low Stock
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                        OK
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {isEditing ? (
                                                    <div className="flex items-center gap-2 justify-center">
                                                        <button
                                                            onClick={() => handleEditSave(product.id)}
                                                            disabled={updating}
                                                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                                        >
                                                            {updating ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Check className="h-4 w-4" />
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={handleEditCancel}
                                                            disabled={updating}
                                                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => handleEditStart(product)}
                                                        className="p-1.5 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                                                        title="Edit storage stock"
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

