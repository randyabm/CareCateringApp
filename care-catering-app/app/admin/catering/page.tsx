'use client';

import AdminLayout from '@/components/admin/AdminLayout';
import { createClient } from '@/utils/supabase/client';
import { useEffect, useState } from 'react';
import { Plus, Search, Loader2, Pencil, Save, Trash2 } from 'lucide-react';

type MealService = {
    id: number;
    name: string;
    code: string;
    order_start_time: string | null;
    order_end_time: string | null;
    description: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
};

type DietCode = {
    id: number;
    code: string;
    name: string;
    category: 'primary_diet' | 'allergy' | 'dislike' | 'intolerance' | 'meal_service';
    description: string | null;
    is_active: boolean;
    created_at: string;
    deleted_at: string | null;
};

type TabType = 'meal_services' | 'diet_codes' | 'allergies' | 'dislikes' | 'intolerances';

export default function CateringPage() {
    const [activeTab, setActiveTab] = useState<TabType>('meal_services');
    const [loading, setLoading] = useState(true);

    // Meal Services State
    const [mealServices, setMealServices] = useState<MealService[]>([]);
    const [showMealServiceModal, setShowMealServiceModal] = useState(false);
    const [editingMealServiceId, setEditingMealServiceId] = useState<number | null>(null);
    const [mealServiceForm, setMealServiceForm] = useState({
        name: '',
        code: '',
        order_start_time: '',
        order_end_time: '',
        description: '',
        is_active: true
    });
    const [mealServiceToDelete, setMealServiceToDelete] = useState<number | null>(null);
    const [showDeleteMealServiceModal, setShowDeleteMealServiceModal] = useState(false);
    const [mealServiceSearch, setMealServiceSearch] = useState('');
    const [showDeletedMealServices, setShowDeletedMealServices] = useState(false);

    // Diet Codes State (for all categories)
    const [dietCodes, setDietCodes] = useState<DietCode[]>([]);
    const [showDietCodeModal, setShowDietCodeModal] = useState(false);
    const [editingDietCodeId, setEditingDietCodeId] = useState<number | null>(null);
    const [dietCodeForm, setDietCodeForm] = useState({
        code: '',
        name: '',
        description: '',
        is_active: true
    });
    const [dietCodeToDelete, setDietCodeToDelete] = useState<number | null>(null);
    const [showDeleteDietCodeModal, setShowDeleteDietCodeModal] = useState(false);
    const [dietCodeSearch, setDietCodeSearch] = useState('');
    const [showDeletedDietCodes, setShowDeletedDietCodes] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'meal_services') {
                const { data, error } = await supabase
                    .from('meal_services')
                    .select('*')
                    .order('name', { ascending: true });

                if (error) throw error;
                setMealServices(data || []);
            } else {
                let category: string;
                switch (activeTab) {
                    case 'diet_codes':
                        category = 'primary_diet';
                        break;
                    case 'allergies':
                        category = 'allergy';
                        break;
                    case 'dislikes':
                        category = 'dislike';
                        break;
                    case 'intolerances':
                        category = 'intolerance';
                        break;
                    default:
                        category = 'primary_diet';
                }

                const { data, error } = await supabase
                    .from('diet_codes')
                    .select('*')
                    .eq('category', category)
                    .order('code', { ascending: true });

                if (error) throw error;
                setDietCodes(data || []);
            }
        } catch (error: any) {
            console.error('Error fetching data:', error);
            alert('Error loading data: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Meal Service Handlers
    const handleMealServiceSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mealServiceForm.name || !mealServiceForm.code) {
            alert('Please fill in all required fields');
            return;
        }

        if (mealServiceForm.order_start_time && mealServiceForm.order_end_time) {
            if (mealServiceForm.order_start_time >= mealServiceForm.order_end_time) {
                alert('End time must be after start time');
                return;
            }
        }

        try {
            const updateData = {
                name: mealServiceForm.name,
                code: mealServiceForm.code,
                order_start_time: mealServiceForm.order_start_time || null,
                order_end_time: mealServiceForm.order_end_time || null,
                description: mealServiceForm.description || null,
                is_active: mealServiceForm.is_active
            };

            if (editingMealServiceId) {
                const { error } = await supabase
                    .from('meal_services')
                    .update(updateData)
                    .eq('id', editingMealServiceId);

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('meal_services')
                    .insert([updateData]);

                if (error) throw error;
            }

            setShowMealServiceModal(false);
            setEditingMealServiceId(null);
            setMealServiceForm({ name: '', code: '', order_start_time: '', order_end_time: '', description: '', is_active: true });
            fetchData();
        } catch (error: any) {
            alert('Error saving meal service: ' + error.message);
        }
    };

    const startEditMealService = (ms: MealService) => {
        setEditingMealServiceId(ms.id);
        setMealServiceForm({
            name: ms.name,
            code: ms.code,
            order_start_time: ms.order_start_time || '',
            order_end_time: ms.order_end_time || '',
            description: ms.description || '',
            is_active: ms.is_active
        });
        setShowMealServiceModal(true);
    };

    const handleDeleteMealService = async () => {
        if (!mealServiceToDelete) return;

        try {
            // Soft delete: set is_active to false and deleted_at to current timestamp
            const { error } = await supabase
                .from('meal_services')
                .update({
                    is_active: false,
                    deleted_at: new Date().toISOString()
                })
                .eq('id', mealServiceToDelete);

            if (error) throw error;
            setShowDeleteMealServiceModal(false);
            setMealServiceToDelete(null);
            fetchData();
        } catch (error: any) {
            alert('Error deleting meal service: ' + error.message);
        }
    };

    // Diet Code Handlers
    const handleDietCodeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!dietCodeForm.code || !dietCodeForm.name) {
            alert('Please fill in all required fields');
            return;
        }

        try {
            let category: string;
            switch (activeTab) {
                case 'diet_codes':
                    category = 'primary_diet';
                    break;
                case 'allergies':
                    category = 'allergy';
                    break;
                case 'dislikes':
                    category = 'dislike';
                    break;
                case 'intolerances':
                    category = 'intolerance';
                    break;
                default:
                    category = 'primary_diet';
            }

            if (editingDietCodeId) {
                const { error } = await supabase
                    .from('diet_codes')
                    .update({
                        code: dietCodeForm.code,
                        name: dietCodeForm.name,
                        description: dietCodeForm.description || null,
                        is_active: dietCodeForm.is_active
                    })
                    .eq('id', editingDietCodeId);

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('diet_codes')
                    .insert([{
                        code: dietCodeForm.code,
                        name: dietCodeForm.name,
                        category: category as any,
                        description: dietCodeForm.description || null,
                        is_active: dietCodeForm.is_active
                    }]);

                if (error) throw error;
            }

            setShowDietCodeModal(false);
            setEditingDietCodeId(null);
            setDietCodeForm({ code: '', name: '', description: '', is_active: true });
            fetchData();
        } catch (error: any) {
            alert('Error saving diet code: ' + error.message);
        }
    };

    const startEditDietCode = (dc: DietCode) => {
        setEditingDietCodeId(dc.id);
        setDietCodeForm({
            code: dc.code,
            name: dc.name,
            description: dc.description || '',
            is_active: dc.is_active
        });
        setShowDietCodeModal(true);
    };

    const handleDeleteDietCode = async () => {
        if (!dietCodeToDelete) return;

        try {
            // Soft delete: set is_active to false and deleted_at to current timestamp
            const { error } = await supabase
                .from('diet_codes')
                .update({
                    is_active: false,
                    deleted_at: new Date().toISOString()
                })
                .eq('id', dietCodeToDelete);

            if (error) throw error;
            setShowDeleteDietCodeModal(false);
            setDietCodeToDelete(null);
            fetchData();
        } catch (error: any) {
            alert('Error deleting diet code: ' + error.message);
        }
    };

    const formatTime = (time: string) => {
        // Convert HH:MM:SS to HH:MM format
        if (time && time.includes(':')) {
            const parts = time.split(':');
            return `${parts[0]}:${parts[1]}`;
        }
        return time;
    };

    const filteredMealServices = mealServices.filter(ms => {
        const matchesSearch = ms.name.toLowerCase().includes(mealServiceSearch.toLowerCase()) ||
            ms.code.toLowerCase().includes(mealServiceSearch.toLowerCase());
        
        // Filter by deleted status
        if (showDeletedMealServices) {
            return matchesSearch && ms.deleted_at !== null;
        } else {
            return matchesSearch && ms.deleted_at === null;
        }
    });

    const filteredDietCodes = dietCodes.filter(dc => {
        const matchesSearch = dc.code.toLowerCase().includes(dietCodeSearch.toLowerCase()) ||
            dc.name.toLowerCase().includes(dietCodeSearch.toLowerCase());
        
        // Filter by deleted status
        if (showDeletedDietCodes) {
            return matchesSearch && dc.deleted_at !== null;
        } else {
            return matchesSearch && dc.deleted_at === null;
        }
    });

    const getTabTitle = () => {
        switch (activeTab) {
            case 'meal_services':
                return 'Meal Services';
            case 'diet_codes':
                return 'Diet Codes';
            case 'allergies':
                return 'Allergies';
            case 'dislikes':
                return 'Dislikes';
            case 'intolerances':
                return 'Intolerances';
            default:
                return 'Catering';
        }
    };

    return (
        <AdminLayout>
            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Catering Configuration</h1>
                        <p className="text-slate-500">Manage meal services, diet codes, allergies, and dietary preferences.</p>
                    </div>
                    <div className="flex gap-3">
                        {activeTab === 'meal_services' ? (
                            <button
                                onClick={() => {
                                    setEditingMealServiceId(null);
                                    setMealServiceForm({ name: '', code: '', order_start_time: '', order_end_time: '', description: '', is_active: true });
                                    setShowMealServiceModal(true);
                                }}
                                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                            >
                                <Plus className="h-4 w-4" />
                                Add Meal Service
                            </button>
                        ) : (
                            <button
                                onClick={() => {
                                    setEditingDietCodeId(null);
                                    setDietCodeForm({ code: '', name: '', description: '', is_active: true });
                                    setShowDietCodeModal(true);
                                }}
                                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                            >
                                <Plus className="h-4 w-4" />
                                Add {getTabTitle().slice(0, -1)}
                            </button>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-slate-200">
                    <div className="flex gap-6">
                        {(['meal_services', 'diet_codes', 'allergies', 'dislikes', 'intolerances'] as TabType[]).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === tab
                                        ? 'border-emerald-600 text-emerald-600'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {tab === 'meal_services' ? 'Meal Services' :
                                 tab === 'diet_codes' ? 'Diet Codes' :
                                 tab === 'allergies' ? 'Allergies' :
                                 tab === 'dislikes' ? 'Dislikes' :
                                 'Intolerances'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Meal Services Tab */}
                {activeTab === 'meal_services' && (
                    <>
                        {/* Search */}
                        <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search meal services..."
                                    value={mealServiceSearch}
                                    onChange={(e) => setMealServiceSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={showDeletedMealServices}
                                        onChange={(e) => setShowDeletedMealServices(e.target.checked)}
                                        className="rounded text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span>Show deleted</span>
                                </label>
                                <div className="text-sm text-slate-500">
                                    {filteredMealServices.length} items found
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">Name</th>
                                        <th className="px-6 py-3 font-medium">Code</th>
                                        <th className="px-6 py-3 font-medium">Order Window</th>
                                        <th className="px-6 py-3 font-medium">Description</th>
                                        <th className="px-6 py-3 font-medium">Status</th>
                                        <th className="px-6 py-3 font-medium w-24">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                                                    <p>Loading meal services...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredMealServices.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                                No meal services found
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredMealServices.map((ms) => (
                                            <tr key={ms.id} className={`hover:bg-slate-50 transition-colors ${ms.deleted_at ? 'opacity-60' : ''}`}>
                                                <td className="px-6 py-3 font-medium">
                                                    {ms.name}
                                                    {ms.deleted_at && (
                                                        <span className="ml-2 text-xs text-red-600 font-normal">(Deleted)</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-3 text-slate-600">{ms.code}</td>
                                                <td className="px-6 py-3">
                                                    {ms.order_start_time && ms.order_end_time ? (
                                                        <span className="text-sm text-slate-600">
                                                            {formatTime(ms.order_start_time)} - {formatTime(ms.order_end_time)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-sm text-slate-400 italic">Not limited</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-3 text-slate-500">{ms.description || '-'}</td>
                                                <td className="px-6 py-3">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                        ms.deleted_at
                                                            ? 'bg-red-100 text-red-700'
                                                            : ms.is_active
                                                            ? 'bg-emerald-100 text-emerald-700'
                                                            : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                        {ms.deleted_at ? 'Deleted' : ms.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3">
                                                    <div className="flex items-center gap-2">
                                                        {!ms.deleted_at && (
                                                            <>
                                                                <button
                                                                    onClick={() => startEditMealService(ms)}
                                                                    className="p-1 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                                                                    title="Edit"
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setMealServiceToDelete(ms.id);
                                                                        setShowDeleteMealServiceModal(true);
                                                                    }}
                                                                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            </>
                                                        )}
                                                        {ms.deleted_at && (
                                                            <span className="text-xs text-slate-400 italic">Cannot edit deleted items</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {/* Diet Codes, Allergies, Dislikes, Intolerances Tabs */}
                {activeTab !== 'meal_services' && (
                    <>
                        {/* Search */}
                        <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder={`Search ${getTabTitle().toLowerCase()}...`}
                                    value={dietCodeSearch}
                                    onChange={(e) => setDietCodeSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={showDeletedDietCodes}
                                        onChange={(e) => setShowDeletedDietCodes(e.target.checked)}
                                        className="rounded text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span>Show deleted</span>
                                </label>
                                <div className="text-sm text-slate-500">
                                    {filteredDietCodes.length} items found
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">Code</th>
                                        <th className="px-6 py-3 font-medium">Name</th>
                                        <th className="px-6 py-3 font-medium">Description</th>
                                        <th className="px-6 py-3 font-medium">Status</th>
                                        <th className="px-6 py-3 font-medium w-24">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                                                    <p>Loading {getTabTitle().toLowerCase()}...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredDietCodes.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                                No {getTabTitle().toLowerCase()} found
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredDietCodes.map((dc) => (
                                            <tr key={dc.id} className={`hover:bg-slate-50 transition-colors ${dc.deleted_at ? 'opacity-60' : ''}`}>
                                                <td className="px-6 py-3 font-medium">
                                                    {dc.code}
                                                    {dc.deleted_at && (
                                                        <span className="ml-2 text-xs text-red-600 font-normal">(Deleted)</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-3 text-slate-600">{dc.name}</td>
                                                <td className="px-6 py-3 text-slate-500">{dc.description || '-'}</td>
                                                <td className="px-6 py-3">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                        dc.deleted_at
                                                            ? 'bg-red-100 text-red-700'
                                                            : dc.is_active
                                                            ? 'bg-emerald-100 text-emerald-700'
                                                            : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                        {dc.deleted_at ? 'Deleted' : dc.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3">
                                                    <div className="flex items-center gap-2">
                                                        {!dc.deleted_at && (
                                                            <>
                                                                <button
                                                                    onClick={() => startEditDietCode(dc)}
                                                                    className="p-1 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                                                                    title="Edit"
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setDietCodeToDelete(dc.id);
                                                                        setShowDeleteDietCodeModal(true);
                                                                    }}
                                                                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            </>
                                                        )}
                                                        {dc.deleted_at && (
                                                            <span className="text-xs text-slate-400 italic">Cannot edit deleted items</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {/* Meal Service Modal */}
                {showMealServiceModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
                            <div className="p-6 border-b border-slate-200">
                                <h2 className="text-xl font-semibold text-slate-900">
                                    {editingMealServiceId ? 'Edit Meal Service' : 'Add Meal Service'}
                                </h2>
                            </div>
                            <form onSubmit={handleMealServiceSubmit} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={mealServiceForm.name}
                                        onChange={(e) => setMealServiceForm({ ...mealServiceForm, name: e.target.value })}
                                        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Code <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={mealServiceForm.code}
                                        onChange={(e) => setMealServiceForm({ ...mealServiceForm, code: e.target.value.toUpperCase() })}
                                        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                        required
                                        maxLength={10}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Order Window - Start Time
                                        </label>
                                        <input
                                            type="time"
                                            value={mealServiceForm.order_start_time}
                                            onChange={(e) => setMealServiceForm({ ...mealServiceForm, order_start_time: e.target.value })}
                                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                            placeholder="HH:MM"
                                        />
                                        <p className="text-xs text-slate-500 mt-1">Time from which orders can be placed</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Order Window - End Time
                                        </label>
                                        <input
                                            type="time"
                                            value={mealServiceForm.order_end_time}
                                            onChange={(e) => setMealServiceForm({ ...mealServiceForm, order_end_time: e.target.value })}
                                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                            placeholder="HH:MM"
                                        />
                                        <p className="text-xs text-slate-500 mt-1">Time until which orders can be placed</p>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Description
                                    </label>
                                    <textarea
                                        value={mealServiceForm.description}
                                        onChange={(e) => setMealServiceForm({ ...mealServiceForm, description: e.target.value })}
                                        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                        rows={3}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="meal_service_active"
                                        checked={mealServiceForm.is_active}
                                        onChange={(e) => setMealServiceForm({ ...mealServiceForm, is_active: e.target.checked })}
                                        className="rounded text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <label htmlFor="meal_service_active" className="text-sm text-slate-700">
                                        Active
                                    </label>
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="submit"
                                        className="flex-1 bg-emerald-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-700 transition-colors"
                                    >
                                        <Save className="h-4 w-4 inline mr-2" />
                                        Save
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowMealServiceModal(false);
                                            setEditingMealServiceId(null);
                                            setMealServiceForm({ name: '', code: '', order_start_time: '', order_end_time: '', description: '', is_active: true });
                                        }}
                                        className="flex-1 bg-slate-100 text-slate-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-200 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Diet Code Modal */}
                {showDietCodeModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
                            <div className="p-6 border-b border-slate-200">
                                <h2 className="text-xl font-semibold text-slate-900">
                                    {editingDietCodeId ? `Edit ${getTabTitle().slice(0, -1)}` : `Add ${getTabTitle().slice(0, -1)}`}
                                </h2>
                            </div>
                            <form onSubmit={handleDietCodeSubmit} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Code <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={dietCodeForm.code}
                                        onChange={(e) => setDietCodeForm({ ...dietCodeForm, code: e.target.value.toUpperCase() })}
                                        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                        required
                                        maxLength={10}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={dietCodeForm.name}
                                        onChange={(e) => setDietCodeForm({ ...dietCodeForm, name: e.target.value })}
                                        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Description
                                    </label>
                                    <textarea
                                        value={dietCodeForm.description}
                                        onChange={(e) => setDietCodeForm({ ...dietCodeForm, description: e.target.value })}
                                        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                        rows={3}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="diet_code_active"
                                        checked={dietCodeForm.is_active}
                                        onChange={(e) => setDietCodeForm({ ...dietCodeForm, is_active: e.target.checked })}
                                        className="rounded text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <label htmlFor="diet_code_active" className="text-sm text-slate-700">
                                        Active
                                    </label>
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="submit"
                                        className="flex-1 bg-emerald-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-700 transition-colors"
                                    >
                                        <Save className="h-4 w-4 inline mr-2" />
                                        Save
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowDietCodeModal(false);
                                            setEditingDietCodeId(null);
                                            setDietCodeForm({ code: '', name: '', description: '', is_active: true });
                                        }}
                                        className="flex-1 bg-slate-100 text-slate-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-200 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Delete Meal Service Modal */}
                {showDeleteMealServiceModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
                            <div className="p-6 border-b border-slate-200">
                                <h2 className="text-xl font-semibold text-slate-900">Delete Meal Service</h2>
                            </div>
                            <div className="p-6">
                                <p className="text-slate-600 mb-4">
                                    Are you sure you want to delete this meal service? 
                                    <br />
                                    <span className="text-sm text-slate-500 mt-2 block">
                                        The meal service will be marked as deleted but preserved in the database for historical records. 
                                        Existing orders will not be affected.
                                    </span>
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleDeleteMealService}
                                        className="flex-1 bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-700 transition-colors"
                                    >
                                        Delete
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowDeleteMealServiceModal(false);
                                            setMealServiceToDelete(null);
                                        }}
                                        className="flex-1 bg-slate-100 text-slate-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-200 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Diet Code Modal */}
                {showDeleteDietCodeModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
                            <div className="p-6 border-b border-slate-200">
                                <h2 className="text-xl font-semibold text-slate-900">Delete {getTabTitle().slice(0, -1)}</h2>
                            </div>
                            <div className="p-6">
                                <p className="text-slate-600 mb-4">
                                    Are you sure you want to delete this {getTabTitle().slice(0, -1).toLowerCase()}? 
                                    <br />
                                    <span className="text-sm text-slate-500 mt-2 block">
                                        The {getTabTitle().slice(0, -1).toLowerCase()} will be marked as deleted but preserved in the database for historical records. 
                                        Existing orders will not be affected.
                                    </span>
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleDeleteDietCode}
                                        className="flex-1 bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-700 transition-colors"
                                    >
                                        Delete
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowDeleteDietCodeModal(false);
                                            setDietCodeToDelete(null);
                                        }}
                                        className="flex-1 bg-slate-100 text-slate-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-200 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

