'use client';

import { X, Package, UtensilsCrossed, Loader2 } from 'lucide-react';
import type { Database } from '@/types/database.types';

type OrderRow = Database['public']['Views']['report_orders_summary']['Row'];
type MovementRow = Database['public']['Views']['report_stock_movements']['Row'];
type CateringDetail = Database['public']['Tables']['catering_details']['Row'];
type DietCode = Database['public']['Tables']['diet_codes']['Row'];

type OrderDetailsModalProps = {
    isOpen: boolean;
    order: OrderRow | null;
    items: MovementRow[];
    cateringDetail: CateringDetail | null;
    dietaryFlags: DietCode[];
    loading: boolean;
    onClose: () => void;
};

const STATUS_STYLES: Record<OrderRow['status'], string> = {
    pending: 'bg-amber-50 text-amber-800 border-amber-200',
    approved: 'bg-sky-50 text-sky-800 border-sky-200',
    processing: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    delivered: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    cancelled: 'bg-red-50 text-red-800 border-red-200',
};

export function OrderDetailsModal({
    isOpen,
    order,
    items,
    cateringDetail,
    dietaryFlags,
    loading,
    onClose,
}: OrderDetailsModalProps) {
    if (!isOpen || !order) return null;

    const allergies = dietaryFlags.filter(dc => dc.category === 'allergy');
    const intolerances = dietaryFlags.filter(dc => dc.category === 'intolerance');
    const dislikes = dietaryFlags.filter(dc => dc.category === 'dislike');
    const primaryDiet = cateringDetail?.primary_diet_id 
        ? dietaryFlags.find(dc => dc.id === cateringDetail.primary_diet_id && dc.category === 'primary_diet')
        : null;
    const mealService = cateringDetail?.meal_service_required_id
        ? dietaryFlags.find(dc => dc.id === cateringDetail.meal_service_required_id && dc.category === 'meal_service')
        : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        {order.type === 'catering' ? (
                            <UtensilsCrossed className="h-6 w-6 text-orange-600" />
                        ) : (
                            <Package className="h-6 w-6 text-emerald-600" />
                        )}
                        <div>
                            <h2 className="text-xl font-semibold text-slate-900">
                                Order #{order.order_id}
                            </h2>
                            <p className="text-sm text-slate-500">
                                {new Date(order.created_at).toLocaleString()}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="px-6 py-4 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="flex flex-col items-center gap-3">
                                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                                <p className="text-sm text-slate-600">Loading order details...</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Order Info */}
                            <div className="bg-slate-50 rounded-lg p-4">
                                <h3 className="text-sm font-semibold text-slate-900 mb-3">Order Information</h3>
                                <div className={`grid gap-3 text-sm ${order.type === 'catering' ? 'grid-cols-2' : 'grid-cols-2'}`}>
                                    <div>
                                        <span className="text-slate-600 font-medium">Type:</span>
                                        <span className="ml-2 text-slate-900 capitalize">
                                            {order.type === 'grocery' ? 'Restock' : order.type}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-600 font-medium">Status:</span>
                                        <span
                                            className={`ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[order.status]}`}
                                        >
                                            {order.status}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-600 font-medium">Requested By:</span>
                                        <span className="ml-2 text-slate-900">
                                            {order.requested_by || order.user_name || order.user_id || 'Unknown'}
                                        </span>
                                    </div>
                                    {order.type !== 'catering' && (
                                        <>
                                            <div>
                                                <span className="text-slate-600 font-medium">Items:</span>
                                                <span className="ml-2 text-slate-900">{order.items_count}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-600 font-medium">Total Quantity:</span>
                                                <span className="ml-2 text-slate-900">{order.total_quantity || 0}</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Catering Details */}
                            {order.type === 'catering' && cateringDetail && (
                                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                                    <h3 className="text-sm font-semibold text-orange-900 mb-3">Patient Information</h3>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        {cateringDetail.patient_name && (
                                            <div>
                                                <span className="text-orange-700 font-medium">Patient Name:</span>
                                                <span className="ml-2 text-orange-900">{cateringDetail.patient_name}</span>
                                            </div>
                                        )}
                                        {cateringDetail.patient_ur_number && (
                                            <div>
                                                <span className="text-orange-700 font-medium">UR Number:</span>
                                                <span className="ml-2 text-orange-900">{cateringDetail.patient_ur_number}</span>
                                            </div>
                                        )}
                                        <div>
                                            <span className="text-orange-700 font-medium">Bed Number:</span>
                                            <span className="ml-2 text-orange-900">{cateringDetail.bed_number}</span>
                                        </div>
                                    </div>

                                    {/* Dietary Requirements */}
                                    {(allergies.length > 0 ||
                                        intolerances.length > 0 ||
                                        dislikes.length > 0 ||
                                        cateringDetail.allergies_free_text ||
                                        cateringDetail.intolerances_free_text ||
                                        cateringDetail.dislikes_free_text ||
                                        primaryDiet ||
                                        mealService) && (
                                        <div className="mt-4 pt-4 border-t border-orange-200">
                                            <h4 className="text-xs font-semibold text-orange-900 mb-2">Dietary Requirements</h4>
                                            <div className="space-y-2 text-sm">
                                                {mealService && (
                                                    <div>
                                                        <span className="text-orange-700 font-medium">Meal Service:</span>
                                                        <span className="ml-2 text-orange-900">
                                                            {mealService.name}
                                                            {mealService.code && <span className="text-orange-600"> ({mealService.code})</span>}
                                                        </span>
                                                    </div>
                                                )}
                                                {primaryDiet && (
                                                    <div>
                                                        <span className="text-orange-700 font-medium">Primary Diet:</span>
                                                        <span className="ml-2 text-orange-900">
                                                            {primaryDiet.name}
                                                            {primaryDiet.code && <span className="text-orange-600"> ({primaryDiet.code})</span>}
                                                        </span>
                                                    </div>
                                                )}
                                                {allergies.length > 0 && (
                                                    <div>
                                                        <span className="text-orange-700 font-medium">Allergies:</span>
                                                        <div className="flex flex-wrap gap-2 mt-1">
                                                            {allergies.map(allergy => (
                                                                <span
                                                                    key={allergy.id}
                                                                    className="inline-flex items-center rounded-full bg-red-100 border border-red-300 px-2 py-1 text-xs font-medium text-red-800"
                                                                >
                                                                    {allergy.name}
                                                                    {allergy.code && <span className="ml-1 text-red-600">({allergy.code})</span>}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {cateringDetail.allergies_free_text && (
                                                    <div>
                                                        <span className="text-orange-700 font-medium">Other Allergies:</span>
                                                        <span className="ml-2 text-orange-800">{cateringDetail.allergies_free_text}</span>
                                                    </div>
                                                )}
                                                {intolerances.length > 0 && (
                                                    <div>
                                                        <span className="text-orange-700 font-medium">Intolerances:</span>
                                                        <div className="flex flex-wrap gap-2 mt-1">
                                                            {intolerances.map(intolerance => (
                                                                <span
                                                                    key={intolerance.id}
                                                                    className="inline-flex items-center rounded-full bg-orange-100 border border-orange-300 px-2 py-1 text-xs font-medium text-orange-800"
                                                                >
                                                                    {intolerance.name}
                                                                    {intolerance.code && <span className="ml-1 text-orange-600">({intolerance.code})</span>}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {cateringDetail.intolerances_free_text && (
                                                    <div>
                                                        <span className="text-orange-700 font-medium">Other Intolerances:</span>
                                                        <span className="ml-2 text-orange-800">{cateringDetail.intolerances_free_text}</span>
                                                    </div>
                                                )}
                                                {dislikes.length > 0 && (
                                                    <div>
                                                        <span className="text-orange-700 font-medium">Dislikes:</span>
                                                        <div className="flex flex-wrap gap-2 mt-1">
                                                            {dislikes.map(dislike => (
                                                                <span
                                                                    key={dislike.id}
                                                                    className="inline-flex items-center rounded-full bg-amber-100 border border-amber-300 px-2 py-1 text-xs font-medium text-amber-800"
                                                                >
                                                                    {dislike.name}
                                                                    {dislike.code && <span className="ml-1 text-amber-600">({dislike.code})</span>}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {cateringDetail.dislikes_free_text && (
                                                    <div>
                                                        <span className="text-orange-700 font-medium">Other Dislikes:</span>
                                                        <span className="ml-2 text-orange-800">{cateringDetail.dislikes_free_text}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {cateringDetail.other_notes && (
                                        <div className="mt-4 pt-4 border-t border-orange-200">
                                            <span className="text-orange-700 font-medium text-sm">Additional Notes:</span>
                                            <p className="mt-1 text-sm text-orange-800 whitespace-pre-line">{cateringDetail.other_notes}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Order Items - Only show for non-catering orders */}
                            {order.type !== 'catering' && (
                                items.length > 0 ? (
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-900 mb-3">Order Items</h3>
                                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                                            <table className="min-w-full divide-y divide-slate-200">
                                                <thead className="bg-slate-50">
                                                    <tr>
                                                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase">
                                                            Product
                                                        </th>
                                                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 uppercase">
                                                            Quantity
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200 bg-white">
                                                    {items.map(item => (
                                                        <tr key={item.movement_id}>
                                                            <td className="px-4 py-3 text-sm text-slate-900">
                                                                {item.product_name ?? '—'}
                                                                {item.unit_size && (
                                                                    <span className="text-slate-500 ml-1">({item.unit_size})</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-right text-slate-900 font-medium">
                                                                {item.quantity}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot className="bg-slate-50">
                                                    <tr>
                                                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                                                            Total Items
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900">
                                                            {items.reduce((sum, item) => sum + item.quantity, 0)}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-slate-50 rounded-lg p-4 text-center text-sm text-slate-500">
                                        No items found for this order.
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end px-6 py-4 border-t border-slate-200 bg-slate-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

