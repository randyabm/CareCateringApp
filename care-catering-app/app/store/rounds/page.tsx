'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Database } from '@/types/database.types';
import { LocationTreeSelect, LocationTreeValue } from '@/components/admin/LocationTreeSelect';
import { useNotes } from '@/components/notes/NotesProvider';
import { Loader2, StickyNote, AlertCircle, CheckCircle2 } from 'lucide-react';
import { listNotes, NoteRow } from '@/lib/notes';

type StockRow = Database['public']['Views']['report_stock_by_location']['Row'];
type OrderSummaryRow = Database['public']['Views']['report_orders_summary']['Row'];
type MovementRow = Database['public']['Views']['report_stock_movements']['Row'];
type Location = Database['public']['Tables']['locations']['Row'];
type LocationGroup = Database['public']['Tables']['location_groups']['Row'];
type Product = Database['public']['Tables']['products']['Row'];

type Line = {
    productId: number;
    productName: string;
    unitSize: string | null;
    systemStock: number;
    parLevel: number;
    realStock: number;
    deliverQty: number;
    futureFlag: boolean;
    futureQty: number;
    isExtra: boolean;
};

export default function StoreRoundingPage() {
    const supabase = useMemo(() => createClient(), []);
    const { openDrawer, setLocationContext } = useNotes();

    const [loading, setLoading] = useState(true);
    const [locations, setLocations] = useState<Location[]>([]);
    const [groups, setGroups] = useState<LocationGroup[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [locationSelection, setLocationSelection] = useState<LocationTreeValue>('all');
    const [stockData, setStockData] = useState<StockRow[]>([]);
    const [ordersData, setOrdersData] = useState<OrderSummaryRow[]>([]);
    const [activeLocationId, setActiveLocationId] = useState<number | null>(null);

    const [recentNotes, setRecentNotes] = useState<NoteRow[]>([]);
    const [recentNotesLoading, setRecentNotesLoading] = useState(false);

    const [lines, setLines] = useState<Line[]>([]);
    const [pendingImmediate, setPendingImmediate] = useState<Line[]>([]);
    const [pendingFuture, setPendingFuture] = useState<Line[]>([]);
    const [showConfirm, setShowConfirm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [orderDetailsLoading, setOrderDetailsLoading] = useState(false);
    const [orderDetailsError, setOrderDetailsError] = useState<string | null>(null);
    const [selectedOrder, setSelectedOrder] = useState<OrderSummaryRow | null>(null);
    const [selectedOrderItems, setSelectedOrderItems] = useState<MovementRow[]>([]);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [
                { data: locs, error: locError },
                { data: groupRows, error: groupError },
                { data: stockRows, error: stockError },
                { data: prodRows, error: prodError },
                { data: orderRows, error: orderError },
            ] = await Promise.all([
                supabase.from('locations').select('*').order('name'),
                supabase.from('location_groups').select('*').order('name'),
                supabase.from('report_stock_by_location').select('*').order('location_name'),
                supabase.from('products').select('*').order('name'),
                supabase
                    .from('report_orders_summary')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(50),
            ]);

            if (locError) throw locError;
            if (groupError) throw groupError;
            if (stockError) throw stockError;
            if (prodError) throw prodError;
            if (orderError) throw orderError;

            setLocations(locs ?? []);
            setGroups(groupRows ?? []);
            setStockData(stockRows ?? []);
            setProducts(prodRows ?? []);
            setOrdersData(orderRows ?? []);

            if (!activeLocationId && locs && locs.length > 0) {
                setLocationSelection(`location:${locs[0].id}`);
            }
        } catch (err) {
            console.error('Error loading rounding data', err);
            setError('Failed to load rounding data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Derive activeLocationId from location tree selection
    useEffect(() => {
        let selectedId: number | null = null;
        if (locationSelection.startsWith('location:')) {
            selectedId = Number(locationSelection.split(':')[1]);
        } else if (locationSelection.startsWith('group:')) {
            const groupId = Number(locationSelection.split(':')[1]);
            const firstInGroup = locations.find(loc => loc.group_id === groupId);
            selectedId = firstInGroup?.id ?? null;
        }
        setActiveLocationId(selectedId);
    }, [locationSelection, locations]);

    useEffect(() => {
        if (activeLocationId) {
            setLocationContext(activeLocationId);
        }
    }, [activeLocationId, setLocationContext]);

    // Load last notes for the active location
    useEffect(() => {
        if (!activeLocationId) {
            setRecentNotes([]);
            return;
        }

        let cancelled = false;
        const loadNotes = async () => {
            setRecentNotesLoading(true);
            try {
                const { data, error } = await listNotes({
                    locationId: activeLocationId,
                    includeGeneral: false,
                });
                if (!error && data && !cancelled) {
                    const latest = (data as NoteRow[])
                        .filter((n: NoteRow) => !n.resolved)
                        .sort(
                            (a: NoteRow, b: NoteRow) =>
                                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                        )
                        .slice(0, 3);
                    setRecentNotes(latest);
                } else if (!cancelled) {
                    setRecentNotes([]);
                }
            } finally {
                if (!cancelled) {
                    setRecentNotesLoading(false);
                }
            }
        };

        loadNotes();

        return () => {
            cancelled = true;
        };
    }, [activeLocationId]);

    // Build counting lines when location or stock data changes
    useEffect(() => {
        if (!activeLocationId) {
            setLines([]);
            return;
        }

        const locationStock = stockData.filter(r => r.location_id === activeLocationId);
        const nextLines: Line[] = locationStock.map(row => {
            const productName = row.product_name || 'Unknown';
            const unitSize = row.unit_size ?? null;
            const systemStock = row.current_stock;
            const parLevel = row.par_level;
            const suggestedQty = Math.max(parLevel - systemStock, 0);

            return {
                productId: row.product_id,
                productName: unitSize ? `${productName} (${unitSize})` : productName,
                unitSize,
                systemStock,
                parLevel,
                realStock: systemStock,
                deliverQty: suggestedQty,
                futureFlag: false,
                futureQty: 0,
                isExtra: false,
            };
        });

        setLines(nextLines);
    }, [activeLocationId, stockData]);

    const updateLine = (productId: number, updater: (line: Line) => Line) => {
        setLines(prev => prev.map(line => (line.productId === productId ? updater(line) : line)));
    };

    const handleRealStockChange = (productId: number, value: number) => {
        updateLine(productId, line => {
            const realStock = Math.max(0, value);
            const suggestedDeliver = Math.max(line.parLevel - realStock, 0);
            const futureGap = Math.max(line.parLevel - (realStock + suggestedDeliver), 0);
            return {
                ...line,
                realStock,
                deliverQty: suggestedDeliver,
                futureQty: line.futureFlag ? futureGap : line.futureQty,
            };
        });
    };

    const handleDeliverQtyChange = (productId: number, value: number) => {
        updateLine(productId, line => {
            const deliverQty = Math.max(0, value);
            const futureGap = Math.max(line.parLevel - (line.realStock + deliverQty), 0);
            return {
                ...line,
                deliverQty,
                futureQty: line.futureFlag ? futureGap : line.futureQty,
            };
        });
    };

    const handleFutureFlagChange = (productId: number, checked: boolean) => {
        updateLine(productId, line => {
            const futureGap = Math.max(line.parLevel - (line.realStock + line.deliverQty), 0);
            return {
                ...line,
                futureFlag: checked,
                futureQty: checked ? futureGap : 0,
            };
        });
    };

    const handleFutureQtyChange = (productId: number, value: number) => {
        updateLine(productId, line => ({
            ...line,
            futureQty: Math.max(0, value),
        }));
    };

    const addExtraLine = () => {
        setLines(prev => [
            ...prev,
            {
                productId: 0,
                productName: 'Select product',
                unitSize: null,
                systemStock: 0,
                parLevel: 0,
                realStock: 0,
                deliverQty: 0,
                futureFlag: false,
                futureQty: 0,
                isExtra: true,
            },
        ]);
    };

    const handleExtraProductChange = (productId: number, index: number) => {
        const product = products.find(p => p.id === productId) ?? null;
        setLines(prev =>
            prev.map((line, i) => {
                if (i !== index) return line;
                return {
                    ...line,
                    productId,
                    productName: product
                        ? product.unit_size
                            ? `${product.name} (${product.unit_size})`
                            : product.name
                        : 'Product',
                };
            })
        );
    };

    const openConfirmDialog = () => {
        if (!activeLocationId) {
            setError('Please select a location first.');
            return;
        }

        const immediateLines = lines.filter(line => line.productId && line.deliverQty > 0);
        const futureLines = lines.filter(line => line.productId && line.futureFlag && line.futureQty > 0);

        if (immediateLines.length === 0 && futureLines.length === 0) {
            setError('No quantities to order. Adjust deliver or future quantities first.');
            return;
        }

        setPendingImmediate(immediateLines);
        setPendingFuture(futureLines);
        setShowConfirm(true);
        setError(null);
        setSuccess(null);
    };

    const createOrders = async () => {
        if (!activeLocationId) {
            setError('Please select a location first.');
            return;
        }

        if (pendingImmediate.length === 0 && pendingFuture.length === 0) {
            setError('No quantities to order. Adjust deliver or future quantities first.');
            return;
        }

        setSubmitting(true);
        setError(null);
        setSuccess(null);

        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            const messages: string[] = [];

            // Immediate delivery order (proactive_restock)
            if (pendingImmediate.length > 0) {
                const { data: order, error: orderError } = await supabase
                    .from('orders')
                    .insert({
                        user_id: user?.id ?? null,
                        location_id: activeLocationId,
                        type: 'proactive_restock',
                        status: 'delivered',
                        assignment_type: 'store_man',
                        requested_by: 'N/A',
                    })
                    .select()
                    .single();

                if (orderError) throw orderError;
                if (!order) throw new Error('Failed to create immediate delivery order.');

                const itemsPayload = pendingImmediate.map(line => ({
                    order_id: order.id,
                    product_id: line.productId,
                    quantity: line.deliverQty,
                }));

                const { error: itemsError } = await supabase.from('order_items').insert(itemsPayload);
                if (itemsError) throw itemsError;

                // Update stock in the location to reflect delivered quantities
                for (const line of pendingImmediate) {
                    const newStock = line.realStock + line.deliverQty;
                    const { error: stockError } = await supabase
                        .from('location_products')
                        .update({ current_stock: newStock })
                        .eq('location_id', activeLocationId)
                        .eq('product_id', line.productId);
                    if (stockError) throw stockError;
                }

                messages.push(`Order #${order.id} (delivered now)`);
            }

            // Future order
            if (pendingFuture.length > 0) {
                const { data: futureOrder, error: futureOrderError } = await supabase
                    .from('orders')
                    .insert({
                        user_id: user?.id ?? null,
                        location_id: activeLocationId,
                        type: 'future_order',
                        status: 'pending',
                        assignment_type: 'store_man',
                        requested_by: 'N/A',
                    })
                    .select()
                    .single();

                if (futureOrderError) throw futureOrderError;
                if (!futureOrder) throw new Error('Failed to create future order.');

                const futureItemsPayload = pendingFuture.map(line => ({
                    order_id: futureOrder.id,
                    product_id: line.productId,
                    quantity: line.futureQty,
                }));

                const { error: futureItemsError } = await supabase.from('order_items').insert(futureItemsPayload);
                if (futureItemsError) throw futureItemsError;

                messages.push(`Order #${futureOrder.id} (future)`);
            }

            setSuccess(`Created ${messages.join(' and ')}.`);
            setShowConfirm(false);
            setPendingImmediate([]);
            setPendingFuture([]);
            await loadData();
        } catch (err) {
            console.error('Error creating orders from rounding view', err);
            setError('Failed to create orders. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const currentLocation = locations.find(l => l.id === activeLocationId) ?? null;
    const recentOrdersForLocation = useMemo(
        () =>
            ordersData
                .filter(o => o.location_id === activeLocationId)
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 5),
        [ordersData, activeLocationId]
    );

    const openOrderDetails = async (order: OrderSummaryRow) => {
        setSelectedOrder(order);
        setSelectedOrderItems([]);
        setOrderDetailsError(null);
        setOrderDetailsLoading(true);
        try {
            const { data, error } = await supabase
                .from('report_stock_movements')
                .select('*')
                .eq('order_id', order.order_id)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setSelectedOrderItems((data as MovementRow[]) ?? []);
        } catch (err) {
            console.error('Error loading order details', err);
            setOrderDetailsError('Failed to load order details. Please try again.');
        } finally {
            setOrderDetailsLoading(false);
        }
    };

    const noteColorMap: Record<string, string> = {
        yellow: 'bg-amber-50 border-amber-200',
        blue: 'bg-blue-50 border-blue-200',
        green: 'bg-emerald-50 border-emerald-200',
        purple: 'bg-purple-50 border-purple-200',
        red: 'bg-red-50 border-red-200',
    };

    const formatNoteDate = (dateString?: string | null) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString();
    };

    if (loading) {
        return (
            <div className="min-h-screen w-full bg-gradient-to-br from-background to-secondary dark:from-background dark:to-cyan-950/20 text-foreground p-8">
                <div className="max-w-6xl mx-auto flex items-center justify-center h-96">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                        <p className="text-slate-600">Loading rounding view...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-background to-secondary dark:from-background dark:to-cyan-950/20 text-foreground p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <header className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/store"
                            className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                            ← Back to Store
                        </Link>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-bold text-primary mb-1">Rounding Mode</h1>
                            <p className="text-muted-foreground">
                                Pick a location, count real stock, and create both delivered and future restock orders.
                            </p>
                        </div>
                    </div>
                </header>

                {/* Location selector */}
                <section className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase">Locations</p>
                            <p className="text-xs text-slate-500">
                                Choose a location to work on. Products for that location will appear below.
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <LocationTreeSelect
                            groups={groups}
                            locations={locations}
                            value={locationSelection}
                            onChange={setLocationSelection}
                            label="Location"
                        />
                        {currentLocation && (
                            <div className="flex items-center justify-end gap-2">
                                <button
                                    onClick={() =>
                                        openDrawer({
                                            locationId: currentLocation.id,
                                            locationName: currentLocation.name,
                                        })
                                    }
                                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
                                >
                                    <StickyNote className="h-4 w-4 text-amber-500" />
                                    <span className="text-xs font-medium">Notes for {currentLocation.name}</span>
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                {/* Recent notes for this location */}
                {currentLocation && (
                    <section className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold text-slate-500 uppercase">
                                    Notes for {currentLocation.name}
                                </p>
                                <p className="text-xs text-slate-500">Last 3 notes for this location.</p>
                            </div>
                        </div>
                        {recentNotesLoading ? (
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading notes...
                            </div>
                        ) : recentNotes.length === 0 ? (
                            <p className="text-xs text-slate-500">No recent notes for this location.</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {recentNotes.map(note => (
                                    <div
                                        key={note.id}
                                        className={`rounded-lg border px-3 py-2 text-xs text-slate-800 flex flex-col gap-1 ${
                                            noteColorMap[note.color ?? 'yellow'] ??
                                            noteColorMap.yellow
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1">
                                                <StickyNote className="h-3 w-3 text-amber-600" />
                                                <span className="font-semibold">
                                                    {note.location_id
                                                        ? currentLocation.name
                                                        : 'General'}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-slate-500">
                                                {formatNoteDate(note.created_at)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-800 line-clamp-4">
                                            {note.message}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {/* Error / success messages */}
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

                {/* Products and counting table */}
                {currentLocation && lines.length > 0 ? (
                    <section className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-sm font-semibold text-slate-900">
                                    {currentLocation.name} – Count stock and set orders
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Enter the real stock you see. Use the deliver and future columns to decide what is sent now
                                    and what becomes a future order.
                                </p>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600 uppercase">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Product</th>
                                        <th className="px-3 py-2 text-right">System</th>
                                        <th className="px-3 py-2 text-right">Par</th>
                                        <th className="px-3 py-2 text-right">Real stock</th>
                                        <th className="px-3 py-2 text-right">Deliver now qty</th>
                                        <th className="px-3 py-2 text-center">Future?</th>
                                        <th className="px-3 py-2 text-right">Future qty</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {lines.map((line, index) => (
                                        <tr key={`${line.productId}-${line.isExtra ? 'extra' : 'base'}-${index}`} className="hover:bg-slate-50">
                                            <td className="px-3 py-2 text-slate-900">
                                                {line.isExtra ? (
                                                    <select
                                                        value={line.productId || ''}
                                                        onChange={e =>
                                                            handleExtraProductChange(
                                                                e.target.value ? Number(e.target.value) : 0,
                                                                index
                                                            )
                                                        }
                                                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
                                                    >
                                                        <option value="">Select product...</option>
                                                        {products.map(p => (
                                                            <option key={p.id} value={p.id}>
                                                                {p.unit_size ? `${p.name} (${p.unit_size})` : p.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    line.productName
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right text-slate-600">{line.systemStock}</td>
                                            <td className="px-3 py-2 text-right text-slate-600">{line.parLevel}</td>
                                            <td className="px-3 py-2 text-right">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={line.realStock}
                                                    onChange={e => handleRealStockChange(line.productId, Number(e.target.value) || 0)}
                                                    className="w-24 px-2 py-1 border border-slate-300 rounded text-sm text-right"
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={line.deliverQty}
                                                    onChange={e =>
                                                        handleDeliverQtyChange(line.productId, Number(e.target.value) || 0)
                                                    }
                                                    className="w-24 px-2 py-1 border border-slate-300 rounded text-sm text-right"
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={line.futureFlag}
                                                    onChange={e => handleFutureFlagChange(line.productId, e.target.checked)}
                                                    className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={line.futureQty}
                                                    onChange={e =>
                                                        handleFutureQtyChange(line.productId, Number(e.target.value) || 0)
                                                    }
                                                    disabled={!line.futureFlag}
                                                    className="w-24 px-2 py-1 border border-slate-300 rounded text-sm text-right disabled:bg-slate-50"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex items-center justify-between">
                            <button
                                type="button"
                                onClick={addExtraLine}
                                className="px-3 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-xs font-medium text-slate-700"
                            >
                                + Add product
                            </button>
                            <button
                                type="button"
                                onClick={openConfirmDialog}
                                disabled={submitting}
                                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Creating orders...
                                    </>
                                ) : (
                                    <>Create delivered & future orders</>
                                )}
                            </button>
                        </div>

                        {/* Recent orders for this location */}
                        {recentOrdersForLocation.length > 0 && (
                            <div className="mt-6 border-t border-slate-200 pt-4">
                                <h3 className="text-xs font-semibold text-slate-700 mb-2 uppercase">
                                    Last 5 orders for this location
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-xs">
                                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase">
                                            <tr>
                                                <th className="px-2 py-1 text-left">Order</th>
                                                <th className="px-2 py-1 text-left">Date</th>
                                                <th className="px-2 py-1 text-left">Type</th>
                                                <th className="px-2 py-1 text-left">Status</th>
                                                <th className="px-2 py-1 text-right">Items</th>
                                                <th className="px-2 py-1 text-right">Qty</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {recentOrdersForLocation.map(order => (
                                                <tr
                                                    key={order.order_id}
                                                    className="hover:bg-slate-50 cursor-pointer"
                                                    onClick={() => openOrderDetails(order)}
                                                >
                                                    <td className="px-2 py-1 text-slate-800">#{order.order_id}</td>
                                                    <td className="px-2 py-1 text-slate-600">
                                                        {new Date(order.created_at).toLocaleString()}
                                                    </td>
                                                    <td className="px-2 py-1 text-slate-600 capitalize">
                                                        {order.type?.replace('_', ' ') ?? '—'}
                                                    </td>
                                                    <td className="px-2 py-1 text-slate-600">{order.status}</td>
                                                    <td className="px-2 py-1 text-right text-slate-700">
                                                        {order.items_count}
                                                    </td>
                                                    <td className="px-2 py-1 text-right text-slate-700">
                                                        {order.total_quantity}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </section>
                ) : (
                    <section className="bg-slate-50 rounded-lg border border-slate-200 p-8 text-center text-slate-500">
                        <p>Select a location above to see its products and start counting.</p>
                    </section>
                )}

                {/* Confirmation dialog for delivered / future orders */}
                {showConfirm && currentLocation && (
                    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
                        <div className="w-full max-w-lg rounded-lg bg-white shadow-xl border border-slate-200">
                            <div className="px-4 py-3 border-b border-slate-200">
                                <h2 className="text-sm font-semibold text-slate-900">Confirm delivered order</h2>
                                <p className="text-xs text-slate-500 mt-1">
                                    You are about to mark the delivered quantities as received in{' '}
                                    <span className="font-medium">{currentLocation.name}</span> and create a future order (if any
                                    future lines exist).
                                </p>
                            </div>
                            <div className="px-4 py-3 max-h-80 overflow-y-auto text-sm">
                                {pendingImmediate.length > 0 ? (
                                    <>
                                        <p className="text-xs font-semibold text-slate-600 mb-2 uppercase">Delivered now</p>
                                        <ul className="space-y-1 mb-3">
                                            {pendingImmediate.map(line => (
                                                <li key={line.productId} className="flex justify-between gap-2 text-slate-700">
                                                    <span className="truncate">{line.productName}</span>
                                                    <span className="font-medium">+{line.deliverQty}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </>
                                ) : (
                                    <p className="text-xs text-slate-500 mb-3">
                                        No delivered quantities; only a future order will be created.
                                    </p>
                                )}
                                {pendingFuture.length > 0 && (
                                    <>
                                        <p className="text-xs font-semibold text-slate-600 mb-2 uppercase">Future order</p>
                                        <ul className="space-y-1">
                                            {pendingFuture.map(line => (
                                                <li key={line.productId} className="flex justify-between gap-2 text-slate-700">
                                                    <span className="truncate">{line.productName}</span>
                                                    <span className="font-medium">+{line.futureQty}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </>
                                )}
                            </div>
                            <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!submitting) {
                                            setShowConfirm(false);
                                        }
                                    }}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={createOrders}
                                    disabled={submitting}
                                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            Confirming...
                                        </>
                                    ) : (
                                        <>Confirm delivered & future</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Order details dialog */}
                {selectedOrder && (
                    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
                        <div className="w-full max-w-3xl rounded-lg bg-white shadow-xl border border-slate-200">
                            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                                <div>
                                    <h2 className="text-sm font-semibold text-slate-900">
                                        Order #{selectedOrder.order_id} details
                                    </h2>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {new Date(selectedOrder.created_at).toLocaleString()} •{' '}
                                        {selectedOrder.type?.replace('_', ' ')} • {selectedOrder.status}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!orderDetailsLoading) {
                                            setSelectedOrder(null);
                                            setSelectedOrderItems([]);
                                            setOrderDetailsError(null);
                                        }
                                    }}
                                    className="text-xs font-medium text-slate-600 hover:text-slate-900"
                                >
                                    Close
                                </button>
                            </div>
                            <div className="px-4 py-3 max-h-96 overflow-y-auto text-sm space-y-3">
                                {orderDetailsError && (
                                    <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                                        <AlertCircle className="h-4 w-4" />
                                        <span>{orderDetailsError}</span>
                                    </div>
                                )}
                                {orderDetailsLoading ? (
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Loading order items...
                                    </div>
                                ) : selectedOrderItems.length === 0 ? (
                                    <p className="text-xs text-slate-500">No items found for this order.</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-xs">
                                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase">
                                                <tr>
                                                    <th className="px-2 py-1 text-left">Product</th>
                                                    <th className="px-2 py-1 text-left">Category</th>
                                                    <th className="px-2 py-1 text-right">Qty</th>
                                                    <th className="px-2 py-1 text-left">Location</th>
                                                    <th className="px-2 py-1 text-left">User</th>
                                                    <th className="px-2 py-1 text-left">Created at</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {selectedOrderItems.map(item => (
                                                    <tr key={item.movement_id}>
                                                        <td className="px-2 py-1 text-slate-800">
                                                            {item.product_name ?? '—'}
                                                            {item.unit_size ? ` (${item.unit_size})` : ''}
                                                        </td>
                                                        <td className="px-2 py-1 text-slate-600">
                                                            {item.category_name ?? '—'}
                                                        </td>
                                                        <td className="px-2 py-1 text-right text-slate-800">
                                                            {item.quantity}
                                                        </td>
                                                        <td className="px-2 py-1 text-slate-600">
                                                            {item.location_name ?? '—'}
                                                        </td>
                                                        <td className="px-2 py-1 text-slate-600">
                                                            {item.user_name ?? '—'}
                                                        </td>
                                                        <td className="px-2 py-1 text-slate-500">
                                                            {new Date(item.created_at).toLocaleString()}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

