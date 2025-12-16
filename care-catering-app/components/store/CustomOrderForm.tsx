'use client';

import { useMemo, useState } from 'react';
import type { Database } from '@/types/database.types';
import { createClient } from '@/utils/supabase/client';
import { Loader2, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

type Location = Database['public']['Tables']['locations']['Row'];
type Product = Database['public']['Tables']['products']['Row'];

type CustomOrderFormProps = {
    locations: Location[];
    products: Product[];
    onCreated?: () => void;
};

type Line = {
    id: number;
    productId: number | null;
    quantity: number;
};

export function CustomOrderForm({ locations, products, onCreated }: CustomOrderFormProps) {
    const supabase = createClient();
    const [locationId, setLocationId] = useState<number | ''>('');
    const [lines, setLines] = useState<Line[]>([{ id: 1, productId: null, quantity: 1 }]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const productOptions = useMemo(
        () => products.sort((a, b) => a.name.localeCompare(b.name)),
        [products]
    );

    const handleAddLine = () => {
        setLines(prev => [...prev, { id: Date.now(), productId: null, quantity: 1 }]);
    };

    const handleRemoveLine = (id: number) => {
        setLines(prev => (prev.length === 1 ? prev : prev.filter(l => l.id !== id)));
    };

    const handleLineChange = (id: number, updates: Partial<Line>) => {
        setLines(prev => prev.map(l => (l.id === id ? { ...l, ...updates } : l)));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!locationId) {
            setError('Please select a location.');
            return;
        }

        const validLines = lines
            .filter(l => l.productId && l.quantity > 0)
            .map(l => ({ productId: l.productId as number, quantity: l.quantity }));

        if (validLines.length === 0) {
            setError('Add at least one product with quantity greater than 0.');
            return;
        }

        setSubmitting(true);

        try {
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({
                    location_id: locationId,
                    type: 'proactive_restock',
                    status: 'pending',
                })
                .select()
                .single();

            if (orderError) throw orderError;
            if (!order) throw new Error('Order was not created.');

            const itemsPayload = validLines.map(l => ({
                order_id: order.id,
                product_id: l.productId,
                quantity: l.quantity,
            }));

            const { error: itemsError } = await supabase.from('order_items').insert(itemsPayload);
            if (itemsError) throw itemsError;

            setSuccess(`Order #${order.id} created successfully.`);
            setLines([{ id: 1, productId: null, quantity: 1 }]);
            if (onCreated) onCreated();
        } catch (err) {
            console.error('Error creating custom order', err);
            setError(err instanceof Error ? err.message : 'Failed to create order.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-slate-900">New Custom Order</h2>
                <p className="text-sm text-slate-500">
                    Build an order manually from storage to deliver to a single location.
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Location</label>
                        <select
                            value={locationId}
                            onChange={e => setLocationId(e.target.value ? Number(e.target.value) : '')}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                        >
                            <option value="">Select location...</option>
                            {locations.map(loc => (
                                <option key={loc.id} value={loc.id}>
                                    {loc.name}
                                </option>
                            ))}
                        </select>
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
                            Add line
                        </button>
                    </div>
                    <div className="divide-y divide-slate-200">
                        {lines.map(line => (
                            <div key={line.id} className="flex flex-col md:flex-row items-stretch md:items-center gap-2 px-3 py-2">
                                <div className="flex-1">
                                    <label className="block text-[11px] font-medium text-slate-500 mb-0.5">Product</label>
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
                                </div>
                                <div className="w-28">
                                    <label className="block text-[11px] font-medium text-slate-500 mb-0.5">Quantity</label>
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
                        ))}
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
                            <>Create Order</>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}


