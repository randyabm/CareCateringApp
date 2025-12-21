'use client';

import { Fragment } from 'react';
import { X, Package, UtensilsCrossed, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Database } from '@/types/database.types';

type Product = Database['public']['Tables']['products']['Row'];
type DietCode = {
    id: number;
    code: string;
    name: string;
    category: 'primary_diet' | 'allergy' | 'dislike' | 'intolerance' | 'meal_service';
    description: string | null;
};

type RestockOrderSummary = {
    type: 'restock';
    locationId: number;
    locationName?: string;
    requestedBy?: string;
    items: Array<{
        productId: number;
        productName: string;
        unitSize?: string | null;
        quantity: number;
    }>;
};

type CateringOrderSummary = {
    type: 'catering';
    locationId: number;
    locationName?: string;
    requestedBy?: string;
    bedNumber: string;
    patientName: string;
    patientUrNumber: string;
    mealServiceRequired?: DietCode;
    primaryDiet?: DietCode;
    allergies: DietCode[];
    allergiesFreeText?: string;
    intolerances: DietCode[];
    intolerancesFreeText?: string;
    dislikes: DietCode[];
    dislikesFreeText?: string;
    otherNotes?: string;
};

type OrderSummary = RestockOrderSummary | CateringOrderSummary;

type OrderConfirmationModalProps = {
    isOpen: boolean;
    summary: OrderSummary | null;
    products?: Product[];
    onConfirm: () => void;
    onCancel: () => void;
    isSubmitting?: boolean;
};

export function OrderConfirmationModal({
    isOpen,
    summary,
    products = [],
    onConfirm,
    onCancel,
    isSubmitting = false,
}: OrderConfirmationModalProps) {
    if (!isOpen || !summary) return null;

    const getProductName = (productId: number) => {
        const product = products.find(p => p.id === productId);
        return product ? product.name : `Product #${productId}`;
    };

    const getProductUnitSize = (productId: number) => {
        const product = products.find(p => p.id === productId);
        return product?.unit_size;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        {summary.type === 'restock' ? (
                            <Package className="h-6 w-6 text-emerald-600" />
                        ) : (
                            <UtensilsCrossed className="h-6 w-6 text-orange-600" />
                        )}
                        <h2 className="text-xl font-semibold text-slate-900">
                            Confirm {summary.type === 'restock' ? 'Restock' : 'Catering'} Order
                        </h2>
                    </div>
                    <button
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors disabled:opacity-50"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="px-6 py-4 overflow-y-auto flex-1">
                    <div className="space-y-4">
                        {/* Location Info */}
                        <div className="bg-slate-50 rounded-lg p-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <p className="text-sm font-medium text-slate-700 mb-1">Location</p>
                                    <p className="text-base text-slate-900 font-medium">
                                        {summary.locationName && summary.locationName.trim() !== '' 
                                            ? summary.locationName 
                                            : `Location ID: ${summary.locationId}`}
                                    </p>
                                </div>
                                {summary.requestedBy && (
                                    <div>
                                        <p className="text-sm font-medium text-slate-700 mb-1">Requested By</p>
                                        <p className="text-base text-slate-900 font-medium">
                                            {summary.requestedBy}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Restock Order Details */}
                        {summary.type === 'restock' && (
                            <div>
                                <h3 className="text-sm font-semibold text-slate-700 mb-3">Order Items</h3>
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
                                            {summary.items.map((item, index) => (
                                                <tr key={index}>
                                                    <td className="px-4 py-3 text-sm text-slate-900">
                                                        {getProductName(item.productId)}
                                                        {getProductUnitSize(item.productId) && (
                                                            <span className="text-slate-500 ml-1">
                                                                ({getProductUnitSize(item.productId)})
                                                            </span>
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
                                                    {summary.items.reduce((sum, item) => sum + item.quantity, 0)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Catering Order Details */}
                        {summary.type === 'catering' && (
                            <div className="space-y-4">
                                {/* Patient Info */}
                                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                                    <h3 className="text-sm font-semibold text-orange-900 mb-3">Patient Information</h3>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <p className="text-orange-700 font-medium mb-1">Patient Name</p>
                                            <p className="text-orange-900 font-medium">{summary.patientName}</p>
                                        </div>
                                        <div>
                                            <p className="text-orange-700 font-medium mb-1">UR Number</p>
                                            <p className="text-orange-900 font-medium">{summary.patientUrNumber}</p>
                                        </div>
                                        <div>
                                            <p className="text-orange-700 font-medium mb-1">Bed Number</p>
                                            <p className="text-orange-900">{summary.bedNumber}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Meal Service */}
                                {summary.mealServiceRequired && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                        <p className="text-xs font-medium text-blue-700 mb-1">Meal Service Required</p>
                                        <p className="text-sm text-blue-900 font-medium">
                                            {summary.mealServiceRequired.name}
                                            {summary.mealServiceRequired.code && (
                                                <span className="text-blue-600 ml-2">
                                                    ({summary.mealServiceRequired.code})
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                )}

                                {/* Dietary Requirements */}
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Dietary Requirements</h3>
                                    <div className="space-y-3">
                                        {summary.primaryDiet && (
                                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                                                <p className="text-xs font-medium text-emerald-700 mb-1">
                                                    Primary Diet
                                                </p>
                                                <p className="text-sm text-emerald-900 font-medium">
                                                    {summary.primaryDiet.name}
                                                    {summary.primaryDiet.code && (
                                                        <span className="text-emerald-600 ml-2">
                                                            ({summary.primaryDiet.code})
                                                        </span>
                                                    )}
                                                </p>
                                                {summary.primaryDiet.description && (
                                                    <p className="text-xs text-emerald-700 mt-1">
                                                        {summary.primaryDiet.description}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {(summary.allergies.length > 0 || summary.allergiesFreeText) && (
                                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                                <p className="text-xs font-medium text-red-700 mb-2">Food Allergies</p>
                                                {summary.allergies.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mb-2">
                                                        {summary.allergies.map(allergy => (
                                                            <span
                                                                key={allergy.id}
                                                                className="inline-flex items-center rounded-full bg-red-100 border border-red-300 px-3 py-1 text-xs font-medium text-red-800"
                                                            >
                                                                {allergy.name}
                                                                {allergy.code && (
                                                                    <span className="ml-1 text-red-600">({allergy.code})</span>
                                                                )}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {summary.allergiesFreeText && (
                                                    <p className="text-xs text-red-800 mt-2">
                                                        <span className="font-medium">Other:</span> {summary.allergiesFreeText}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {(summary.intolerances.length > 0 || summary.intolerancesFreeText) && (
                                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                                                <p className="text-xs font-medium text-orange-700 mb-2">Food Intolerances</p>
                                                {summary.intolerances.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mb-2">
                                                        {summary.intolerances.map(intolerance => (
                                                            <span
                                                                key={intolerance.id}
                                                                className="inline-flex items-center rounded-full bg-orange-100 border border-orange-300 px-3 py-1 text-xs font-medium text-orange-800"
                                                            >
                                                                {intolerance.name}
                                                                {intolerance.code && (
                                                                    <span className="ml-1 text-orange-600">({intolerance.code})</span>
                                                                )}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {summary.intolerancesFreeText && (
                                                    <p className="text-xs text-orange-800 mt-2">
                                                        <span className="font-medium">Other:</span> {summary.intolerancesFreeText}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {(summary.dislikes.length > 0 || summary.dislikesFreeText) && (
                                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                                <p className="text-xs font-medium text-amber-700 mb-2">Food Dislikes</p>
                                                {summary.dislikes.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mb-2">
                                                        {summary.dislikes.map(dislike => (
                                                            <span
                                                                key={dislike.id}
                                                                className="inline-flex items-center rounded-full bg-amber-100 border border-amber-300 px-3 py-1 text-xs font-medium text-amber-800"
                                                            >
                                                                {dislike.name}
                                                                {dislike.code && (
                                                                    <span className="ml-1 text-amber-600">({dislike.code})</span>
                                                                )}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {summary.dislikesFreeText && (
                                                    <p className="text-xs text-amber-800 mt-2">
                                                        <span className="font-medium">Other:</span> {summary.dislikesFreeText}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Additional Notes */}
                                {summary.otherNotes && (
                                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                                        <p className="text-xs font-medium text-slate-700 mb-1">Additional Notes</p>
                                        <p className="text-sm text-slate-900 whitespace-pre-line">
                                            {summary.otherNotes}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Warning Message */}
                        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-amber-800">
                                Please review the order details above. Once confirmed, the order will be submitted and
                                cannot be modified.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
                    <button
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="h-4 w-4" />
                                Confirm Order
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

