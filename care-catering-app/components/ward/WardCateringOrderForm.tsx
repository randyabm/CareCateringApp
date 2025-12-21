'use client';

import { useMemo, useState, useEffect } from 'react';
import type { Database } from '@/types/database.types';
import { createClient } from '@/utils/supabase/client';
import { Loader2, CheckCircle2, AlertCircle, UtensilsCrossed, X } from 'lucide-react';
import { getMockUser, isTestMode } from '@/lib/mockAuth';
import { OrderConfirmationModal } from './OrderConfirmationModal';

type Location = Database['public']['Tables']['locations']['Row'];
// Define DietCode type manually since it may not be in generated types
type DietCode = {
    id: number;
    code: string;
    name: string;
    category: 'primary_diet' | 'allergy' | 'dislike' | 'intolerance' | 'meal_service';
    description: string | null;
    is_active: boolean;
    created_at: string;
};

// Meal service with time information
type MealServiceWithTime = {
    id: number; // diet_code id for form submission
    code: string;
    name: string;
    description: string | null;
    order_end_time: string | null; // Cut-off time
    order_start_time: string | null;
};

type WardCateringOrderFormProps = {
    locationId: number | null;
    locationName?: string | null;
    onCreated?: () => void;
};

export function WardCateringOrderForm({ locationId, locationName, onCreated }: WardCateringOrderFormProps) {
    const supabase = createClient();
    const [dietCodes, setDietCodes] = useState<DietCode[]>([]);
    const [mealServicesWithTime, setMealServicesWithTime] = useState<MealServiceWithTime[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    // Form state - Order Information
    const [requestedBy, setRequestedBy] = useState('');
    
    // Form state - Patient Data Section
    const [patientName, setPatientName] = useState('');
    const [patientUrNumber, setPatientUrNumber] = useState('');
    const [bedNumber, setBedNumber] = useState('');
    const [mealServiceRequiredId, setMealServiceRequiredId] = useState<number | ''>('');
    const [primaryDietId, setPrimaryDietId] = useState<number | ''>('');
    
    // Dietary restrictions
    const [selectedAllergies, setSelectedAllergies] = useState<number[]>([]);
    const [allergiesFreeText, setAllergiesFreeText] = useState('');
    const [selectedIntolerances, setSelectedIntolerances] = useState<number[]>([]);
    const [intolerancesFreeText, setIntolerancesFreeText] = useState('');
    const [selectedDislikes, setSelectedDislikes] = useState<number[]>([]);
    const [dislikesFreeText, setDislikesFreeText] = useState('');
    
    const [otherNotes, setOtherNotes] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch diet codes (exclude deleted ones)
                const { data: dietCodesData, error: dietCodesError } = await supabase
                    .from('diet_codes')
                    .select('*')
                    .eq('is_active', true)
                    .is('deleted_at', null)
                    .order('category')
                    .order('name');

                if (dietCodesError) {
                    console.error('Error fetching diet codes:', dietCodesError);
                    throw dietCodesError;
                }
                
                setDietCodes(dietCodesData || []);

                // Fetch meal services with time information (exclude deleted ones)
                const { data: mealServicesData, error: mealServicesError } = await supabase
                    .from('meal_services')
                    .select('*')
                    .eq('is_active', true)
                    .is('deleted_at', null)
                    .order('name');

                if (mealServicesError) {
                    console.error('Error fetching meal services:', mealServicesError);
                    // Don't throw - meal services might not be accessible, but we can still use diet_codes
                } else {
                    // Merge meal_services with diet_codes by code to get the diet_code ID
                    const mealServicesMerged: MealServiceWithTime[] = (mealServicesData || [])
                        .map(ms => {
                            // Find matching diet_code by code
                            const dietCode = (dietCodesData || []).find(
                                dc => dc.code === ms.code && dc.category === 'meal_service'
                            );
                            
                            if (dietCode) {
                                return {
                                    id: dietCode.id, // Use diet_code id for form submission
                                    code: ms.code,
                                    name: ms.name,
                                    description: ms.description,
                                    order_end_time: ms.order_end_time,
                                    order_start_time: ms.order_start_time,
                                };
                            }
                            return null;
                        })
                        .filter((ms): ms is MealServiceWithTime => ms !== null);
                    
                    setMealServicesWithTime(mealServicesMerged);
                    console.log('Fetched meal services with time:', mealServicesMerged.length);
                }
            } catch (err) {
                console.error('Error fetching data', err);
                setError('Failed to load data.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Use meal services with time if available, otherwise fall back to diet_codes
    // Sort by cut-off time (order_end_time) when available
    const mealServices = useMemo(() => {
        let services: MealServiceWithTime[];
        
        if (mealServicesWithTime.length > 0) {
            services = [...mealServicesWithTime];
        } else {
            // Fallback to diet_codes if meal_services table is not accessible
            services = dietCodes
                .filter(dc => dc.category === 'meal_service')
                .map(dc => ({
                    id: dc.id,
                    code: dc.code,
                    name: dc.name,
                    description: dc.description,
                    order_end_time: null,
                    order_start_time: null,
                }));
        }
        
        // Sort by cut-off time (order_end_time)
        // Services with cut-off times come first, sorted by time
        // Services without cut-off times come last, sorted by name
        return services.sort((a, b) => {
            // If both have cut-off times, sort by time
            if (a.order_end_time && b.order_end_time) {
                return a.order_end_time.localeCompare(b.order_end_time);
            }
            // If only one has cut-off time, it comes first
            if (a.order_end_time && !b.order_end_time) return -1;
            if (!a.order_end_time && b.order_end_time) return 1;
            // If neither has cut-off time, sort by name
            return a.name.localeCompare(b.name);
        });
    }, [mealServicesWithTime, dietCodes]);

    // Helper function to format time (HH:MM:SS to HH:MM)
    const formatTime = (time: string | null): string => {
        if (!time) return '';
        // Convert HH:MM:SS to HH:MM format
        if (time.includes(':')) {
            const parts = time.split(':');
            return `${parts[0]}:${parts[1]}`;
        }
        return time;
    };

    // Helper function to convert time string to minutes for comparison
    const timeToMinutes = (time: string): number => {
        const parts = time.split(':');
        return parseInt(parts[0]) * 60 + parseInt(parts[1] || '0');
    };

    // Auto-select meal service based on current time when meal services are loaded
    useEffect(() => {
        if (mealServices.length > 0 && !mealServiceRequiredId) {
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            
            // Helper to check if current time is within a meal service's order window
            const isTimeInWindow = (startTime: string | null, endTime: string | null): boolean => {
                if (!startTime || !endTime) return false;
                
                const startMinutes = timeToMinutes(startTime);
                const endMinutes = timeToMinutes(endTime);
                
                // Handle case where window spans midnight (e.g., 22:00 - 02:00)
                if (startMinutes > endMinutes) {
                    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
                }
                
                return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
            };
            
            // First, try to find a meal service where current time is within order window
            const activeService = mealServices.find(service => 
                isTimeInWindow(service.order_start_time, service.order_end_time)
            );
            
            if (activeService) {
                setMealServiceRequiredId(activeService.id);
                return;
            }
            
            // If no active service found, default to breakfast
            // Look for breakfast by name (case-insensitive)
            const breakfast = mealServices.find(service => 
                service.name.toLowerCase().includes('breakfast')
            );
            
            if (breakfast) {
                setMealServiceRequiredId(breakfast.id);
                return;
            }
            
            // If no breakfast found, select the first service (should be earliest by cut-off time)
            if (mealServices[0]) {
                setMealServiceRequiredId(mealServices[0].id);
            }
        }
    }, [mealServices, mealServiceRequiredId]);
    const primaryDiets = useMemo(
        () => dietCodes.filter(dc => dc.category === 'primary_diet'),
        [dietCodes]
    );
    const allergies = useMemo(
        () => dietCodes.filter(dc => dc.category === 'allergy'),
        [dietCodes]
    );
    const intolerances = useMemo(
        () => dietCodes.filter(dc => dc.category === 'intolerance'),
        [dietCodes]
    );
    const dislikes = useMemo(
        () => dietCodes.filter(dc => dc.category === 'dislike'),
        [dietCodes]
    );

    const toggleAllergy = (dietCodeId: number) => {
        setSelectedAllergies(prev =>
            prev.includes(dietCodeId) ? prev.filter(id => id !== dietCodeId) : [...prev, dietCodeId]
        );
    };

    const toggleIntolerance = (dietCodeId: number) => {
        setSelectedIntolerances(prev =>
            prev.includes(dietCodeId) ? prev.filter(id => id !== dietCodeId) : [...prev, dietCodeId]
        );
    };

    const toggleDislike = (dietCodeId: number) => {
        setSelectedDislikes(prev =>
            prev.includes(dietCodeId) ? prev.filter(id => id !== dietCodeId) : [...prev, dietCodeId]
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

        if (!patientName.trim()) {
            setError('Patient name is required.');
            return;
        }

        if (!patientUrNumber.trim()) {
            setError('Patient UR Number is required.');
            return;
        }

        if (!bedNumber.trim()) {
            setError('Bed number is required.');
            return;
        }

        if (!requestedBy.trim()) {
            setError('Requested By is required.');
            return;
        }

        if (!mealServiceRequiredId) {
            setError('Meal Service Required is required.');
            return;
        }

        if (!primaryDietId) {
            setError('Primary diet is required.');
            return;
        }

        // Show confirmation modal instead of submitting directly
        setShowConfirmModal(true);
    };

    const handleConfirmOrder = async () => {
        if (!locationId || !patientName.trim() || !patientUrNumber.trim() || !bedNumber.trim() || !requestedBy.trim() || !mealServiceRequiredId || !primaryDietId) return;

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

            // Create the order
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({
                    user_id: userId,
                    location_id: locationId,
                    type: 'catering',
                    status: 'pending',
                    requested_by: requestedBy.trim() || null,
                })
                .select()
                .single();

            if (orderError) throw orderError;
            if (!order) throw new Error('Order was not created.');

            // Create catering details
            const { error: detailsError } = await supabase.from('catering_details').insert({
                order_id: order.id,
                primary_diet_id: primaryDietId as number,
                meal_service_required_id: mealServiceRequiredId as number,
                bed_number: bedNumber.trim(),
                patient_name: patientName.trim(),
                patient_ur_number: patientUrNumber.trim(),
                allergies_free_text: allergiesFreeText.trim() || null,
                intolerances_free_text: intolerancesFreeText.trim() || null,
                dislikes_free_text: dislikesFreeText.trim() || null,
                other_notes: otherNotes.trim() || null,
            });

            if (detailsError) throw detailsError;

            // Create dietary flags (allergies, intolerances, and dislikes)
            const dietaryFlags = [...selectedAllergies, ...selectedIntolerances, ...selectedDislikes].map(dietCodeId => ({
                order_id: order.id,
                diet_code_id: dietCodeId,
            }));

            if (dietaryFlags.length > 0) {
                const { error: flagsError } = await supabase.from('order_dietary_flags').insert(dietaryFlags);
                if (flagsError) throw flagsError;
            }

            setSuccess(`Catering order #${order.id} created successfully for bed ${bedNumber}.`);
            
            // Reset form
            setRequestedBy('');
            setPatientName('');
            setPatientUrNumber('');
            setBedNumber('');
            setMealServiceRequiredId('');
            setPrimaryDietId('');
            setSelectedAllergies([]);
            setAllergiesFreeText('');
            setSelectedIntolerances([]);
            setIntolerancesFreeText('');
            setSelectedDislikes([]);
            setDislikesFreeText('');
            setOtherNotes('');

            if (onCreated) onCreated();
        } catch (err) {
            console.error('Error creating catering order', err);
            
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
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
                <p className="mt-2 text-sm text-slate-600">Loading diet codes...</p>
            </div>
        );
    }

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
                    <UtensilsCrossed className="h-5 w-5 text-emerald-600" />
                    <h2 className="text-lg font-semibold text-slate-900">New Catering Order</h2>
                </div>
                <p className="text-sm text-slate-500">
                    Place a meal order for a patient with dietary requirements and restrictions.
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

            <form onSubmit={handleSubmit} className="space-y-6">
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

                {/* Patient Data Section */}
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                    <h3 className="text-sm font-semibold text-slate-900 mb-4">Patient Data</h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Patient's Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={patientName}
                                    onChange={e => setPatientName(e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                                    placeholder="Enter patient's full name"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Patient's UR Number <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={patientUrNumber}
                                    onChange={e => setPatientUrNumber(e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                                    placeholder="Enter UR number"
                                    required
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Bed Number <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={bedNumber}
                                onChange={e => setBedNumber(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                                placeholder="e.g., 6.2.12"
                                required
                            />
                        </div>
                    </div>
                </div>

                {/* Meal Service and Primary Diet */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Meal Service Required <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={mealServiceRequiredId}
                            onChange={e => setMealServiceRequiredId(e.target.value ? Number(e.target.value) : '')}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                            required
                        >
                            <option value="">Select meal service...</option>
                            {mealServices.map(service => (
                                <option key={service.id} value={service.id}>
                                    {service.name} {service.code && `(${service.code})`}
                                    {service.order_end_time && ` - Cut-off: ${formatTime(service.order_end_time)}`}
                                </option>
                            ))}
                        </select>
                        {mealServices.length === 0 && (
                            <p className="mt-1 text-xs text-amber-600">
                                No meal services available. Please contact an administrator to add meal services.
                            </p>
                        )}
                        {(() => {
                            const selectedService = mealServices.find(s => s.id === mealServiceRequiredId);
                            if (!selectedService) return null;
                            
                            return (
                                <div className="mt-1 space-y-1">
                                    {selectedService.description && (
                                        <p className="text-xs text-slate-500">
                                            {selectedService.description}
                                        </p>
                                    )}
                                    {selectedService.order_end_time && (
                                        <p className="text-xs font-medium text-slate-700">
                                            Cut-off time: <span className="text-red-600">{formatTime(selectedService.order_end_time)}</span>
                                        </p>
                                    )}
                                    {selectedService.order_start_time && selectedService.order_end_time && (
                                        <p className="text-xs text-slate-500">
                                            Order window: {formatTime(selectedService.order_start_time)} - {formatTime(selectedService.order_end_time)}
                                        </p>
                                    )}
                                </div>
                            );
                        })()}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Primary Diet <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={primaryDietId}
                            onChange={e => setPrimaryDietId(e.target.value ? Number(e.target.value) : '')}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                            required
                        >
                            <option value="">Select primary diet...</option>
                            {primaryDiets.map(diet => (
                                <option key={diet.id} value={diet.id}>
                                    {diet.name} {diet.code && `(${diet.code})`}
                                </option>
                            ))}
                        </select>
                        {primaryDiets.find(d => d.id === primaryDietId)?.description && (
                            <p className="mt-1 text-xs text-slate-500">
                                {primaryDiets.find(d => d.id === primaryDietId)?.description}
                            </p>
                        )}
                    </div>
                </div>

                {/* Food Allergies */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Food Allergies
                    </label>
                    {allergies.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                            {allergies.map(allergy => (
                                <button
                                    key={allergy.id}
                                    type="button"
                                    onClick={() => toggleAllergy(allergy.id)}
                                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                                        selectedAllergies.includes(allergy.id)
                                            ? 'bg-red-50 border-red-300 text-red-700'
                                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    {allergy.name}
                                    {allergy.code && <span className="text-slate-500">({allergy.code})</span>}
                                    {selectedAllergies.includes(allergy.id) && (
                                        <X className="h-3 w-3 ml-1" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                    <div>
                        <label className="block text-xs text-slate-600 mb-1">
                            Add other allergies not in list:
                        </label>
                        <input
                            type="text"
                            value={allergiesFreeText}
                            onChange={e => setAllergiesFreeText(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                            placeholder="Enter additional allergies..."
                        />
                    </div>
                </div>

                {/* Food Intolerances */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Food Intolerances
                    </label>
                    {intolerances.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                            {intolerances.map(intolerance => (
                                <button
                                    key={intolerance.id}
                                    type="button"
                                    onClick={() => toggleIntolerance(intolerance.id)}
                                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                                        selectedIntolerances.includes(intolerance.id)
                                            ? 'bg-orange-50 border-orange-300 text-orange-700'
                                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    {intolerance.name}
                                    {intolerance.code && <span className="text-slate-500">({intolerance.code})</span>}
                                    {selectedIntolerances.includes(intolerance.id) && (
                                        <X className="h-3 w-3 ml-1" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                    <div>
                        <label className="block text-xs text-slate-600 mb-1">
                            Add other intolerances not in list:
                        </label>
                        <input
                            type="text"
                            value={intolerancesFreeText}
                            onChange={e => setIntolerancesFreeText(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                            placeholder="Enter additional intolerances..."
                        />
                    </div>
                </div>

                {/* Food Dislikes */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Food Dislikes
                    </label>
                    {dislikes.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                            {dislikes.map(dislike => (
                                <button
                                    key={dislike.id}
                                    type="button"
                                    onClick={() => toggleDislike(dislike.id)}
                                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                                        selectedDislikes.includes(dislike.id)
                                            ? 'bg-amber-50 border-amber-300 text-amber-700'
                                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    {dislike.name}
                                    {dislike.code && <span className="text-slate-500">({dislike.code})</span>}
                                    {selectedDislikes.includes(dislike.id) && (
                                        <X className="h-3 w-3 ml-1" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                    <div>
                        <label className="block text-xs text-slate-600 mb-1">
                            Add other dislikes not in list:
                        </label>
                        <input
                            type="text"
                            value={dislikesFreeText}
                            onChange={e => setDislikesFreeText(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                            placeholder="Enter additional dislikes..."
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Additional Notes</label>
                    <textarea
                        value={otherNotes}
                        onChange={e => setOtherNotes(e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                        placeholder="Any special instructions or requirements..."
                    />
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
            <OrderConfirmationModal
                isOpen={showConfirmModal}
                summary={{
                    type: 'catering',
                    locationId: locationId!,
                    locationName: locationName || undefined,
                    requestedBy: requestedBy.trim() || undefined,
                    bedNumber: bedNumber.trim(),
                    patientName: patientName.trim(),
                    patientUrNumber: patientUrNumber.trim(),
                    mealServiceRequired: mealServiceRequiredId
                        ? dietCodes.find(dc => dc.id === mealServiceRequiredId && dc.category === 'meal_service')
                        : undefined,
                    primaryDiet: primaryDietId
                        ? dietCodes.find(dc => dc.id === primaryDietId && dc.category === 'primary_diet')
                        : undefined,
                    allergies: dietCodes.filter(dc => selectedAllergies.includes(dc.id)),
                    allergiesFreeText: allergiesFreeText.trim() || undefined,
                    intolerances: dietCodes.filter(dc => selectedIntolerances.includes(dc.id)),
                    intolerancesFreeText: intolerancesFreeText.trim() || undefined,
                    dislikes: dietCodes.filter(dc => selectedDislikes.includes(dc.id)),
                    dislikesFreeText: dislikesFreeText.trim() || undefined,
                    otherNotes: otherNotes.trim() || undefined,
                }}
                onConfirm={handleConfirmOrder}
                onCancel={() => setShowConfirmModal(false)}
                isSubmitting={submitting}
            />
        </div>
    );
}

