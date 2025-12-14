'use client';

import AdminLayout from '@/components/admin/AdminLayout';
import { createClient } from '@/utils/supabase/client';
import { Database } from '@/types/database.types';
import { useEffect, useState } from 'react';
import { Plus, Search, Loader2, Pencil, Save, X, Trash2, FolderPlus, ArrowUpDown, Package, FileText } from 'lucide-react';

type Location = Database['public']['Tables']['locations']['Row'];
type LocationGroup = Database['public']['Tables']['location_groups']['Row'];
type LocationProduct = Database['public']['Tables']['location_products']['Row'] & { product?: Database['public']['Tables']['products']['Row'] };
type Product = Database['public']['Tables']['products']['Row'];
type Template = Database['public']['Tables']['templates']['Row'];

export default function LocationsPage() {
    const [locations, setLocations] = useState<Location[]>([]);
    const [groups, setGroups] = useState<LocationGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'locations' | 'groups'>('locations');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterGroup, setFilterGroup] = useState<string>('all');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    // Modal States
    const [showModal, setShowModal] = useState(false);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [locationToDelete, setLocationToDelete] = useState<number | null>(null);
    const [showDeleteGroupModal, setShowDeleteGroupModal] = useState(false);
    const [groupToDelete, setGroupToDelete] = useState<number | null>(null);

    // Stock Management State
    const [showStockModal, setShowStockModal] = useState(false);
    const [selectedLocationForStock, setSelectedLocationForStock] = useState<Location | null>(null);
    const [locationStock, setLocationStock] = useState<LocationProduct[]>([]);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [allTemplates, setAllTemplates] = useState<Template[]>([]);
    const [stockLoading, setStockLoading] = useState(false);
    const [stockForm, setStockForm] = useState<{ product_id?: number; par_level: number }>({ par_level: 0 });
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('');

    // Form States
    const [formData, setFormData] = useState({
        name: '',
        responsible_name: '',
        approver_email: '',
        group_id: '' as string | number
    });

    const [groupFormData, setGroupFormData] = useState({ name: '' });

    // Location Edit State
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<Partial<Location>>({});

    // Group Edit State
    const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
    const [editGroupForm, setEditGroupForm] = useState<Partial<LocationGroup>>({});

    const supabase = createClient();

    useEffect(() => {
        fetchLocations();
    }, []);

    const fetchLocations = async () => {
        setLoading(true);

        // Fetch locations
        const { data: locData, error: locError } = await supabase
            .from('locations')
            .select('*')
            .order('name');

        // Fetch groups
        const { data: groupData, error: groupError } = await supabase
            .from('location_groups')
            .select('*')
            .order('name');

        if (locError) console.error('Error fetching locations:', locError);
        if (groupError) console.error('Error fetching groups:', groupError);

        if (locData) setLocations(locData);
        if (groupData) setGroups(groupData);

        setLoading(false);
    };

    // Create Handler
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const { error } = await supabase
            .from('locations')
            .insert([{
                ...formData,
                group_id: formData.group_id ? Number(formData.group_id) : null
            }]);

        if (error) {
            alert('Error adding location: ' + error.message);
        } else {
            setShowModal(false);
            setFormData({ name: '', responsible_name: '', approver_email: '', group_id: '' });
            fetchLocations();
        }
    };

    const handleGroupSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const { error } = await supabase
            .from('location_groups')
            .insert([groupFormData]);

        if (error) {
            alert('Error adding group: ' + error.message);
        } else {
            setShowGroupModal(false);
            setGroupFormData({ name: '' });
            fetchLocations();
        }
    };

    // Edit Handlers
    const startEdit = (loc: Location) => {
        setEditingId(loc.id);
        setEditForm(loc);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({});
    };

    const saveEdit = async () => {
        if (!editingId) return;

        const { error } = await supabase
            .from('locations')
            .update({
                name: editForm.name,
                responsible_name: editForm.responsible_name,
                approver_email: editForm.approver_email,
                is_active: editForm.is_active,
                group_id: editForm.group_id
            })
            .eq('id', editingId);

        if (error) {
            alert('Error updating location: ' + error.message);
        } else {
            setEditingId(null);
            setEditForm({});
            fetchLocations();
        }
    };

    const confirmDeleteLocation = (id: number) => {
        setLocationToDelete(id);
        setShowDeleteModal(true);
    };

    const handleDelete = async () => {
        if (!locationToDelete) return;

        const { error } = await supabase
            .from('locations')
            .delete()
            .eq('id', locationToDelete);

        if (error) {
            alert('Error deleting location: ' + error.message);
        } else {
            setShowDeleteModal(false);
            setLocationToDelete(null);
            fetchLocations();
        }
    };

    const confirmDeleteGroup = (id: number) => {
        setGroupToDelete(id);
        setShowDeleteGroupModal(true);
    };

    const handleDeleteGroup = async () => {
        if (!groupToDelete) return;

        // Optimistic requirement: Check if group has locations? 
        // Supabase might restrict delete if FK exists.
        // For now, let's try delete and catch error.

        const { error } = await supabase
            .from('location_groups')
            .delete()
            .eq('id', groupToDelete);

        if (error) {
            alert('Error deleting group (ensure it is empty first): ' + error.message);
        } else {
            setShowDeleteGroupModal(false);
            setGroupToDelete(null);
            fetchLocations();
        }
    };

    const startEditGroup = (group: LocationGroup) => {
        setEditingGroupId(group.id);
        setEditGroupForm(group);
    };

    const cancelEditGroup = () => {
        setEditingGroupId(null);
        setEditGroupForm({});
    };

    const saveEditGroup = async () => {
        if (!editingGroupId) return;

        const { error } = await supabase
            .from('location_groups')
            .update({ name: editGroupForm.name })
            .eq('id', editingGroupId);

        if (error) {
            alert('Error updating group: ' + error.message);
        } else {
            setEditingGroupId(null);
            setEditGroupForm({});
            fetchLocations();
        }
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortedAndFilteredLocations = () => {
        let filtered = locations.filter(loc => {
            const matchesSearch = loc.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesGroup = filterGroup === 'all'
                ? true
                : filterGroup === 'unassigned'
                    ? loc.group_id === null
                    : loc.group_id === Number(filterGroup);
            return matchesSearch && matchesGroup;
        });

        if (sortConfig) {
            filtered.sort((a, b) => {
                let aValue: any;
                let bValue: any;

                if (sortConfig.key === 'group_name') {
                    aValue = groups.find(g => g.id === a.group_id)?.name || '';
                    bValue = groups.find(g => g.id === b.group_id)?.name || '';
                } else {
                    // @ts-ignore
                    aValue = a[sortConfig.key];
                    // @ts-ignore
                    bValue = b[sortConfig.key];
                }

                if (aValue === null) aValue = '';
                if (bValue === null) bValue = '';

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return filtered;
    };



    // Stock Logic
    const openStockModal = async (loc: Location) => {
        setSelectedLocationForStock(loc);
        setShowStockModal(true);
        setStockLoading(true);

        // Fetch Stock
        const { data: stock } = await supabase
            .from('location_products')
            .select('*, product:products(*)')
            .eq('location_id', loc.id);

        // Fetch Products and Templates for dropdowns
        const { data: prods } = await supabase.from('products').select('*').order('name');
        const { data: temps } = await supabase.from('templates').select('*').order('name');

        if (stock) setLocationStock(stock as any);
        if (prods) setAllProducts(prods);
        if (temps) setAllTemplates(temps);
        setStockLoading(false);
    };

    const handleAddStock = async () => {
        if (!selectedLocationForStock || !stockForm.product_id) return;

        const { error } = await supabase.from('location_products').insert({
            location_id: selectedLocationForStock.id,
            product_id: stockForm.product_id,
            par_level: stockForm.par_level
        });

        if (error) {
            alert('Error adding stock (already exists?): ' + error.message);
        } else {
            // Refresh stock
            const { data } = await supabase
                .from('location_products')
                .select('*, product:products(*)')
                .eq('location_id', selectedLocationForStock.id);
            if (data) setLocationStock(data as any);
            setStockForm({ par_level: 0 }); // reset form
        }
    };

    const handleUpdatePar = async (item: LocationProduct, newPar: number) => {
        if (!selectedLocationForStock) return;
        if (newPar < 1) return;

        let query = supabase
            .from('location_products')
            .update({ par_level: newPar })
            .eq('location_id', selectedLocationForStock.id)
            .eq('product_id', item.product_id);

        if (item.id) {
            query = query.eq('id', item.id);
        }

        await query;

        // Keep local state in sync even if the row id is missing/duplicate
        setLocationStock(prev =>
            prev.map(row =>
                row.location_id === selectedLocationForStock.id && row.product_id === item.product_id
                    ? { ...row, par_level: newPar }
                    : row
            )
        );
    };

    const handleParInputChange = (item: LocationProduct, rawValue: string) => {
        const parsed = parseInt(rawValue, 10);
        if (Number.isNaN(parsed)) return;
        handleUpdatePar(item, Math.max(1, parsed));
    };

    const handleRemoveStock = async (item: LocationProduct) => {
        if (!selectedLocationForStock) return;
        if (!confirm(`Remove ${item.product?.name || 'this product'} from location?`)) return;

        await supabase
            .from('location_products')
            .delete()
            .eq('location_id', selectedLocationForStock.id)
            .eq('product_id', item.product_id);

        // Keep UI in sync by refetching the latest stock
        const { data } = await supabase
            .from('location_products')
            .select('*, product:products(*)')
            .eq('location_id', selectedLocationForStock.id);

        if (data) {
            setLocationStock(data as any);
        } else {
            setLocationStock(prev => prev.filter(row => row.product_id !== item.product_id));
        }
    };

    const handleApplyTemplate = async () => {
        if (!selectedLocationForStock || !selectedTemplateId) return;

        // Fetch template items
        const { data: items } = await supabase.from('template_items').select('*').eq('template_id', selectedTemplateId);

        if (!items || items.length === 0) {
            alert('Template has no items.');
            return;
        }

        const updates = items.map(item => ({
            location_id: selectedLocationForStock.id,
            product_id: item.product_id,
            par_level: item.default_par_level
        }));

        const { error } = await supabase.from('location_products').upsert(updates, { onConflict: 'location_id, product_id' }); // UpSert to overwrite or add

        if (error) {
            alert('Error applying template: ' + error.message);
        } else {
            alert('Template applied successfully!');
            // Refresh stock
            const { data } = await supabase
                .from('location_products')
                .select('*, product:products(*)')
                .eq('location_id', selectedLocationForStock.id);
            if (data) setLocationStock(data as any);
            setSelectedTemplateId('');
        }
    };

    // Grouping Logic
    const groupedLocations = groups.map(group => ({
        ...group,
        locations: locations.filter(l => l.group_id === group.id)
    }));

    const unassignedLocations = locations.filter(l => !l.group_id);

    return (
        <AdminLayout>
            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-slate-900">
                        {activeTab === 'locations' ? 'Locations' : 'Groups'}
                    </h1>
                    <div className="flex gap-3">
                        {activeTab === 'groups' ? (
                            <button
                                onClick={() => setShowGroupModal(true)}
                                className="flex items-center gap-2 bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                <FolderPlus className="h-5 w-5" />
                                Add Group
                            </button>
                        ) : (
                            <button
                                onClick={() => setShowModal(true)}
                                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
                            >
                                <Plus className="h-5 w-5" />
                                Add Location
                            </button>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-slate-200">
                    <div className="flex gap-6">
                        <button
                            onClick={() => setActiveTab('locations')}
                            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'locations' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            Locations
                        </button>
                        <button
                            onClick={() => setActiveTab('groups')}
                            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'groups' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            Groups
                        </button>
                    </div>
                </div>

                {activeTab === 'locations' && (
                    <>
                        {/* Search Bar and Filter */}
                        <div className="flex gap-4">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search locations..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 pl-10 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                                />
                            </div>
                            <div className="w-48">
                                <select
                                    value={filterGroup}
                                    onChange={(e) => setFilterGroup(e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                                >
                                    <option value="all">All Groups</option>
                                    <option value="unassigned">Unassigned</option>
                                    {groups.map(g => (
                                        <option key={g.id} value={g.id}>{g.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Render Logic: Flat List */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                                    <tr>
                                        <th
                                            className="px-6 py-3 font-medium cursor-pointer hover:text-emerald-600 transition-colors"
                                            onClick={() => handleSort('name')}
                                        >
                                            <div className="flex items-center gap-1">
                                                Name
                                                <ArrowUpDown className="h-3 w-3" />
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-3 font-medium cursor-pointer hover:text-emerald-600 transition-colors"
                                            onClick={() => handleSort('group_name')}
                                        >
                                            <div className="flex items-center gap-1">
                                                Group
                                                <ArrowUpDown className="h-3 w-3" />
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-3 font-medium cursor-pointer hover:text-emerald-600 transition-colors"
                                            onClick={() => handleSort('responsible_name')}
                                        >
                                            <div className="flex items-center gap-1">
                                                Responsible Person
                                                <ArrowUpDown className="h-3 w-3" />
                                            </div>
                                        </th>
                                        <th className="px-6 py-3 font-medium">Approver Email</th>
                                        <th className="px-6 py-3 font-medium">Status</th>
                                        <th className="px-6 py-3 font-medium w-24">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        <tr><td colSpan={6} className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-emerald-600" /></td></tr>
                                    ) : getSortedAndFilteredLocations().length === 0 ? (
                                        <tr><td colSpan={6} className="p-6 text-center text-slate-500">No locations found.</td></tr>
                                    ) : (
                                        getSortedAndFilteredLocations().map((loc) => (
                                            <tr key={loc.id} className="hover:bg-slate-50 transition-colors">
                                                {editingId === loc.id ? (
                                                    // Edit Mode
                                                    <>
                                                        <td className="px-6 py-3">
                                                            <input
                                                                value={editForm.name || ''}
                                                                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                                className="w-full border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                            />
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            <select
                                                                value={editForm.group_id || ''}
                                                                onChange={e => setEditForm({ ...editForm, group_id: e.target.value ? Number(e.target.value) : null })}
                                                                className="w-full border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                            >
                                                                <option value="">Unassigned</option>
                                                                {groups.map(g => (
                                                                    <option key={g.id} value={g.id}>{g.name}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            <input
                                                                value={editForm.responsible_name || ''}
                                                                onChange={e => setEditForm({ ...editForm, responsible_name: e.target.value })}
                                                                className="w-full border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                            />
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            <input
                                                                value={editForm.approver_email || ''}
                                                                onChange={e => setEditForm({ ...editForm, approver_email: e.target.value })}
                                                                className="w-full border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                            />
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            <select
                                                                value={editForm.is_active ? 'true' : 'false'}
                                                                onChange={e => setEditForm({ ...editForm, is_active: e.target.value === 'true' })}
                                                                className="border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                            >
                                                                <option value="true">Active</option>
                                                                <option value="false">Inactive</option>
                                                            </select>
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <button onClick={saveEdit} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                                                                    <Save className="h-4 w-4" />
                                                                </button>
                                                                <button onClick={cancelEdit} className="p-1 text-slate-400 hover:bg-slate-100 rounded">
                                                                    <X className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </>
                                                ) : (
                                                    // View Mode
                                                    <>
                                                        <td className="px-6 py-3 font-medium text-slate-900">{loc.name}</td>
                                                        <td className="px-6 py-3 text-slate-500">
                                                            {groups.find(g => g.id === loc.group_id)?.name || <span className="text-slate-300">-</span>}
                                                        </td>
                                                        <td className="px-6 py-3 text-slate-600">{loc.responsible_name || '-'}</td>
                                                        <td className="px-6 py-3 text-slate-600">{loc.approver_email || '-'}</td>
                                                        <td className="px-6 py-3">
                                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${loc.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                                                {loc.is_active ? 'Active' : 'Inactive'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => startEdit(loc)}
                                                                    className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => confirmDeleteLocation(loc.id)}
                                                                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => openStockModal(loc)}
                                                                    className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                                    title="Manage Stock"
                                                                >
                                                                    <Package className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )
                }

                {
                    activeTab === 'groups' && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">Group Name</th>
                                        <th className="px-6 py-3 font-medium">Locations Count</th>
                                        <th className="px-6 py-3 font-medium w-24">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        <tr><td colSpan={3} className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-emerald-600" /></td></tr>
                                    ) : groups.length === 0 ? (
                                        <tr><td colSpan={3} className="p-6 text-center text-slate-500">No groups found.</td></tr>
                                    ) : (
                                        groups.map(group => {
                                            const locCount = locations.filter(l => l.group_id === group.id).length;
                                            return (
                                                <tr key={group.id} className="hover:bg-slate-50 transition-colors">
                                                    {editingGroupId === group.id ? (
                                                        // Edit Group Mode
                                                        <>
                                                            <td className="px-6 py-3">
                                                                <input
                                                                    value={editGroupForm.name || ''}
                                                                    onChange={e => setEditGroupForm({ ...editGroupForm, name: e.target.value })}
                                                                    className="w-full border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                                />
                                                            </td>
                                                            <td className="px-6 py-3 text-slate-500">{locCount}</td>
                                                            <td className="px-6 py-3">
                                                                <div className="flex items-center gap-2">
                                                                    <button onClick={saveEditGroup} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                                                                        <Save className="h-4 w-4" />
                                                                    </button>
                                                                    <button onClick={cancelEditGroup} className="p-1 text-slate-400 hover:bg-slate-100 rounded">
                                                                        <X className="h-4 w-4" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </>
                                                    ) : (
                                                        // View Group Mode
                                                        <>
                                                            <td className="px-6 py-3 font-medium text-slate-900">{group.name}</td>
                                                            <td className="px-6 py-3 text-slate-500">{locCount}</td>
                                                            <td className="px-6 py-3">
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        onClick={() => startEditGroup(group)}
                                                                        className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                                                    >
                                                                        <Pencil className="h-4 w-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => confirmDeleteGroup(group.id)}
                                                                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )
                }


                {/* Confirm Delete Group Modal */}
                {
                    showDeleteGroupModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                            <div className="w-full max-w-sm bg-white rounded-xl shadow-xl p-6">
                                <h2 className="text-xl font-bold mb-2 text-slate-900">Delete Group</h2>
                                <p className="text-slate-500 mb-6">Are you sure you want to delete this group? Locations in this group should be moved or deleted first.</p>
                                <div className="flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteGroupModal(false)}
                                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDeleteGroup}
                                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Add Group Modal */}
                {
                    showGroupModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                            <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6">
                                <h2 className="text-xl font-bold mb-6 text-slate-900">Add New Group</h2>
                                <form onSubmit={handleGroupSubmit}>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Group Name</label>
                                            <input
                                                required
                                                type="text"
                                                value={groupFormData.name}
                                                onChange={e => setGroupFormData({ ...groupFormData, name: e.target.value })}
                                                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                                                placeholder="e.g. Level 6"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-3 mt-6">
                                        <button
                                            type="button"
                                            onClick={() => setShowGroupModal(false)}
                                            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                                        >
                                            Add Group
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )
                }

                {/* Add Location Modal - UPDATED */}
                {
                    showModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                            <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6">
                                <h2 className="text-xl font-bold mb-6 text-slate-900">Add New Location</h2>
                                <form onSubmit={handleSubmit}>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Location Name</label>
                                            <input
                                                required
                                                type="text"
                                                value={formData.name}
                                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                                                placeholder="e.g. Ward 3A"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Group (Optional)</label>
                                            <select
                                                value={formData.group_id}
                                                onChange={e => setFormData({ ...formData, group_id: e.target.value })}
                                                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                                            >
                                                <option value="">Unassigned</option>
                                                {groups.map(g => (
                                                    <option key={g.id} value={g.id}>{g.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Responsible Person</label>
                                            <input
                                                type="text"
                                                value={formData.responsible_name}
                                                onChange={e => setFormData({ ...formData, responsible_name: e.target.value })}
                                                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                                                placeholder="e.g. Nurse Ratched"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Approver Email</label>
                                            <input
                                                type="email"
                                                value={formData.approver_email}
                                                onChange={e => setFormData({ ...formData, approver_email: e.target.value })}
                                                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                                                placeholder="approver@hospital.com"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-3 mt-6">
                                        <button
                                            type="button"
                                            onClick={() => setShowModal(false)}
                                            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                                        >
                                            Add Location
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )
                }

                {/* Delete Confirmation Modal */}
                {
                    showDeleteModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                            <div className="w-full max-w-sm bg-white rounded-xl shadow-xl p-6">
                                <h2 className="text-xl font-bold mb-2 text-slate-900">Delete Location</h2>
                                <p className="text-slate-500 mb-6">Are you sure you want to delete this location? This action cannot be undone.</p>
                                <div className="flex justify-end gap-3">
                                    <button
                                        onClick={() => {
                                            setShowDeleteModal(false);
                                            setLocationToDelete(null);
                                        }}
                                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleDelete}
                                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }


                {/* Stock Management Modal */}
                {
                    showStockModal && selectedLocationForStock && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                            <div className="w-full max-w-4xl bg-white rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
                                <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-900">Manage Stock: {selectedLocationForStock.name}</h2>
                                        <p className="text-sm text-slate-500">Assign products and set par levels.</p>
                                    </div>
                                    <button onClick={() => setShowStockModal(false)} className="text-slate-400 hover:text-slate-700">
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>

                                <div className="p-6 overflow-y-auto flex-1">
                                    <div className="flex flex-col md:flex-row gap-6 mb-8">
                                        {/* Add Product Form */}
                                        <div className="flex-1 space-y-3">
                                            <h3 className="font-semibold text-slate-700">Add Single Product</h3>
                                            <div className="flex gap-2">
                                                <select
                                                    value={stockForm.product_id || ''}
                                                    onChange={e => {
                                                        const val = Number(e.target.value);
                                                        setStockForm(prev => ({ ...prev, product_id: val || undefined }));
                                                    }}
                                                    className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                >
                                                    <option value="">Select Product...</option>
                                                    {allProducts.map(p => (
                                                        <option key={p.id} value={p.id}>{p.name} ({p.unit_size})</option>
                                                    ))}
                                                </select>
                                                <input
                                                    type="number"
                                                    placeholder="Par"
                                                    value={stockForm.par_level}
                                                    onChange={e => setStockForm({ ...stockForm, par_level: parseInt(e.target.value) || 0 })}
                                                    className="w-20 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                />
                                                <button
                                                    onClick={handleAddStock}
                                                    disabled={!stockForm.product_id}
                                                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm disabled:opacity-50"
                                                >
                                                    Add
                                                </button>
                                            </div>
                                        </div>

                                        {/* Apply Template Form */}
                                        <div className="flex-1 space-y-3 border-l pl-6 border-slate-100">
                                            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                                                <FileText className="h-4 w-4 text-slate-400" />
                                                Apply Template
                                            </h3>
                                            <div className="flex gap-2">
                                                <select
                                                    value={selectedTemplateId}
                                                    onChange={e => setSelectedTemplateId(e.target.value ? parseInt(e.target.value) : '')}
                                                    className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                >
                                                    <option value="">Select Template...</option>
                                                    {allTemplates.map(t => (
                                                        <option key={t.id} value={t.id}>{t.name}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={handleApplyTemplate}
                                                    disabled={!selectedTemplateId}
                                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
                                                >
                                                    Apply
                                                </button>
                                            </div>
                                            <p className="text-xs text-slate-400">Applying a template will add items and update existing pars.</p>
                                        </div>
                                    </div>

                                    {/* Stock Table */}
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                                            <tr>
                                                <th className="px-6 py-3 font-medium">Product</th>
                                                <th className="px-6 py-3 font-medium">Category</th>
                                                <th className="px-6 py-3 font-medium">Par Level</th>
                                                <th className="px-6 py-3 font-medium text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {stockLoading ? (
                                                <tr><td colSpan={4} className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-emerald-600" /></td></tr>
                                            ) : locationStock.length === 0 ? (
                                                <tr><td colSpan={4} className="p-6 text-center text-slate-500">No stock assigned.</td></tr>
                                            ) : (
                                                locationStock.map(item => (
                                                    <tr key={item.id} className="hover:bg-slate-50">
                                                        <td className="px-6 py-3 font-medium text-slate-900">{item.product?.name}</td>
                                                        <td className="px-6 py-3 text-slate-500">{item.product?.category || '-'}</td>
                                                        <td className="px-6 py-3">
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                value={item.par_level}
                                                                onChange={(e) => handleParInputChange(item, e.target.value)}
                                                                className="w-24 border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-emerald-500 outline-none"
                                                            />
                                                        </td>
                                                        <td className="px-6 py-3 text-right">
                                                            <button
                                                                onClick={() => handleRemoveStock(item)}
                                                                className="text-red-500 hover:text-red-700"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )
                }
            </div>
        </AdminLayout >
    );
}
