'use client';

import { useMemo, useState } from 'react';
import type { Database } from '@/types/database.types';
import { createClient } from '@/utils/supabase/client';
import { Loader2, Plus, Trash2, CheckCircle2, AlertCircle, Package } from 'lucide-react';
import { getMockUser, isTestMode } from '@/lib/mockAuth';
import { OrderConfirmationModal } from './OrderConfirmationModal';

type Location = Database['public']['Tables']['locations']['Row'];
type Product = Database['public']['Tables']['products']['Row'];
type LocationProduct = Database['public']['Views']['report_stock_by_location']['Row'];

type WardRestockOrderFormProps = {
    locationId: number | null;
    locationName?: string | null;
    products: Product[];
    locationProducts?: LocationProduct[];
    onCreated?: () => void;
};

type Line = {
    id: number;
    productId: number | null;
    quantity: number;
    currentStock?: number;
    parLevel?: number;
};

export function WardRestockOrderForm({
    locationId,
    locationName,
    products,
    locationProducts = [],
    onCreated,
}: WardRestockOrderFormProps) {
    const supabase = createClient();
    const [requestedBy, setRequestedBy] = useState('');
    const [lines, setLines] = useState<Line[]>([{ id: 1, productId: null, quantity: 1 }]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [pendingOrder, setPendingOrder] = useState<{
        items: Array<{ productId: number; quantity: number }>;
    } | null>(null);

    const productOptions = useMemo(() => {
        // Filter products that are available for this location (if locationProducts provided)
        if (locationProducts.length > 0) {
            const availableProductIds = new Set(locationProducts.map(lp => lp.product_id));
            return products
                .filter(p => availableProductIds.has(p.id))
                .sort((a, b) => a.name.localeCompare(b.name));
        }
        return products.sort((a, b) => a.name.localeCompare(b.name));
    }, [products, locationProducts]);

    const getProductStockInfo = (productId: number | null) => {
        if (!productId || locationProducts.length === 0) return null;
        const lp = locationProducts.find(lp => lp.product_id === productId);
        return lp ? { currentStock: lp.current_stock, parLevel: lp.par_level } : null;
    };

    const handleAddLine = () => {
        setLines(prev => [...prev, { id: Date.now(), productId: null, quantity: 1 }]);
    };

    const handleRemoveLine = (id: number) => {
        setLines(prev => (prev.length === 1 ? prev : prev.filter(l => l.id !== id)));
    };

    const handleLineChange = (id: number, updates: Partial<Line>) => {
        setLines(prev =>
            prev.map(l => {
                if (l.id === id) {
                    const updated = { ...l, ...updates };
                    // Update stock info when product changes
                    if (updates.productId !== undefined) {
                        const stockInfo = getProductStockInfo(updates.productId ?? null);
                        return { ...updated, ...stockInfo };
                    }
                    return updated;
                }
                return l;
            })
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!locationId) {
            setError('No location assigned. Please contact an administrator.');
            return;
        }

        const validLines = lines
            .filter(l => l.productId && l.quantity > 0)
            .map(l => ({ productId: l.productId as number, quantity: l.quantity }));

        if (validLines.length === 0) {
            setError('Add at least one product with quantity greater than 0.');
            return;
        }

        // Show confirmation modal instead of submitting directly
        setPendingOrder({ items: validLines });
        setShowConfirmModal(true);
    };

    const handleConfirmOrder = async () => {
        if (!pendingOrder || !locationId || !requestedBy.trim()) return;

        setSubmitting(true);
        setShowConfirmModal(false);

        try {
            // Get user (mock or real)
            let userId: string | null = null;
            if (isTestMode()) {
                // In test mode, we don't pass user_id to avoid RLS issues
                // The RLS policy should allow insertion with null user_id for test mode
                userId = null;
            } else {
                const {
                    data: { user },
                } = await supabase.auth.getUser();
                userId = user?.id ?? null;
            }

            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({
                    user_id: userId,
                    location_id: locationId,
                    type: 'grocery',
                    status: 'pending',
                    requested_by: requestedBy.trim() || null,
                })
                .select()
                .single();

            if (orderError) throw orderError;
            if (!order) throw new Error('Order was not created.');

            const itemsPayload = pendingOrder.items.map(l => ({
                order_id: order.id,
                product_id: l.productId,
                quantity: l.quantity,
            }));

            const { error: itemsError } = await supabase.from('order_items').insert(itemsPayload);
            if (itemsError) throw itemsError;

            setSuccess(`Restock order #${order.id} created successfully. It will be reviewed by the store team.`);
            setRequestedBy('');
            setLines([{ id: 1, productId: null, quantity: 1 }]);
            setPendingOrder(null);
            if (onCreated) onCreated();
        } catch (err) {
            console.error('Error creating restock order', err);
            
            // Better error handling for Supabase errors
            let errorMessage = 'Failed to create order.';
            
            if (err instanceof Error) {
                errorMessage = err.message;
            } else if (err && typeof err === 'object') {
                // Handle Supabase PostgrestError
                if ('message' in err) {
                    errorMessage = String(err.message);
                } else if ('code' in err) {
                    errorMessage = `Database error: ${err.code}`;
                } else {
                    // Try to stringify the error object
                    try {
                        errorMessage = JSON.stringify(err);
                    } catch {
                        errorMessage = 'Unknown error occurred';
                    }
                }
            }
            
            setError(errorMessage);
            setPendingOrder(null);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancelConfirm = () => {
        setShowConfirmModal(false);
        setPendingOrder(null);
    };

    if (!locationId) {
        return (
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 text-center">
                <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No Location Assigned</h3>
                <p className="text-sm text-slate-600">
                    You need to be assigned to a location to place orders. Please contact an administrator.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-4">
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <Package className="h-5 w-5 text-emerald-600" />
                    <h2 className="text-lg font-semibold text-slate-900">New Restock Order</h2>
                </div>
                <p className="text-sm text-slate-500">
                    Request supplies for your ward. Orders will be reviewed and processed by the store team.
                </p>
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                </div>
            )}

            {success && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{success}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Order Information */}
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                    <h3 className="text-sm font-semibold text-slate-900 mb-4">Order Information</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Requested By <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={requestedBy}
                                onChange={e => setRequestedBy(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                                placeholder="Enter your name"
                                required
                            />
                            <p className="mt-1 text-xs text-slate-500">
                                Enter the name of the person making this request
                            </p>
                        </div>
                    </div>
                </div>

                <div className="border border-slate-200 rounded-lg">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50">
                        <span className="text-xs font-semibold text-slate-600 uppercase">Items</span>
                        <button
                            type="button"
                            onClick={handleAddLine}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        >
                            <Plus className="h-3 w-3" />
                            Add item
                        </button>
                    </div>
                    <div className="divide-y divide-slate-200">
                        {lines.map(line => {
                            const stockInfo = line.productId ? getProductStockInfo(line.productId) : null;
                            return (
                                <div
                                    key={line.id}
                                    className="flex flex-col md:flex-row items-stretch md:items-center gap-2 px-3 py-3"
                                >
                                    <div className="flex-1">
                                        <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                                            Product
                                        </label>
                                        <select
                                            value={line.productId ?? ''}
                                            onChange={e =>
                                                handleLineChange(line.id, {
                                                    productId: e.target.value ? Number(e.target.value) : null,
                                                })
                                            }
                                            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
                                        >
                                            <option value="">Select product...</option>
                                            {productOptions.map(p => {
                                                const label = p.unit_size ? `${p.name} (${p.unit_size})` : p.name;
                                                return (
                                                    <option key={p.id} value={p.id}>
                                                        {label}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                        {stockInfo && (
                                            <div className="mt-1 text-xs text-slate-500">
                                                Current: {stockInfo.currentStock} | Par Level: {stockInfo.parLevel}
                                            </div>
                                        )}
                                    </div>
                                    <div className="w-28">
                                        <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                                            Quantity
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={line.quantity}
                                            onChange={e =>
                                                handleLineChange(line.id, {
                                                    quantity: Math.max(1, Number(e.target.value) || 1),
                                                })
                                            }
                                            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800 text-right"
                                        />
                                    </div>
                                    <div className="self-center">
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveLine(line.id)}
                                            className="inline-flex items-center justify-center rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                                            disabled={lines.length === 1}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Creating order...
                            </>
                        ) : (
                            <>Submit Order</>
                        )}
                    </button>
                </div>
            </form>

            {/* Confirmation Modal */}
            {pendingOrder && (
                <OrderConfirmationModal
                    isOpen={showConfirmModal}
                    summary={{
                        type: 'restock',
                        locationId: locationId!,
                        locationName: locationName ? locationName : undefined,
                        requestedBy: requestedBy.trim() || undefined,
                        items: pendingOrder.items.map(item => ({
                            productId: item.productId,
                            productName: products.find(p => p.id === item.productId)?.name || `Product #${item.productId}`,
                            unitSize: products.find(p => p.id === item.productId)?.unit_size || null,
                            quantity: item.quantity,
                        })),
                    }}
                    products={products}
                    onConfirm={handleConfirmOrder}
                    onCancel={handleCancelConfirm}
                    isSubmitting={submitting}
                />
            )}
        </div>
    );
}

