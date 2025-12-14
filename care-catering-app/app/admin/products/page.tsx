'use client';

import AdminLayout from '@/components/admin/AdminLayout';
import { createClient } from '@/utils/supabase/client';
import { Database } from '@/types/database.types';
import { useEffect, useState } from 'react';
import { Plus, Search, Loader2, Pencil, Save, X, Trash2, ArrowUpDown, Filter, FolderPlus, FileText, Edit2, ArrowLeft } from 'lucide-react';

type Product = Database['public']['Tables']['products']['Row'];
type ProductCategory = Database['public']['Tables']['product_categories']['Row'];
type Template = Database['public']['Tables']['templates']['Row'];
type TemplateItem = Database['public']['Tables']['template_items']['Row'] & {
    product?: Database['public']['Tables']['products']['Row'];
};

export default function ProductsPage() {
    // Data State
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<ProductCategory[]>([]);
    const [loading, setLoading] = useState(true);

    // UI State
    const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'templates'>('products');

    // Product Modal States
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        unit_price: '0.00',
        unit_size: '',
        category_id: '' as string | number,
        requires_approval: false
    });

    // Product Edit State
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<Partial<Product>>({});

    // Product Delete State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [productToDelete, setProductToDelete] = useState<number | null>(null);

    // Category Modal States
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [categoryFormData, setCategoryFormData] = useState({ name: '' });

    // Category Edit State
    const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
    const [editCategoryForm, setEditCategoryForm] = useState<Partial<ProductCategory>>({});

    // Category Delete State
    const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState(false);
    const [categoryToDelete, setCategoryToDelete] = useState<number | null>(null);

    // Filter & Sort State
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Product | 'category_name'; direction: 'asc' | 'desc' } | null>(null);

    // Templates State
    const [templates, setTemplates] = useState<Template[]>([]);
    const [templateView, setTemplateView] = useState<'list' | 'detail'>('list');
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [templateItems, setTemplateItems] = useState<TemplateItem[]>([]);
    const [productsForTemplate, setProductsForTemplate] = useState<Product[]>([]);

    // Template Modal States
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [templateForm, setTemplateForm] = useState<Partial<Template>>({});

    // Template Item Modal States
    const [showTemplateItemModal, setShowTemplateItemModal] = useState(false);
    const [templateItemForm, setTemplateItemForm] = useState<{ product_id?: number; default_par_level: number }>({ default_par_level: 0 });

    const supabase = createClient();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);

        // Fetch Categories
        const { data: catData, error: catError } = await supabase
            .from('product_categories')
            .select('*')
            .order('name');

        if (catError) console.error('Error fetching categories:', catError);
        else setCategories(catData || []);

        // Fetch Products
        const { data: prodData, error: prodError } = await supabase
            .from('products')
            .select('*')
            .order('name');

        if (prodError) console.error('Error fetching products:', prodError);
        else {
            setProducts(prodData || []);
            setProductsForTemplate(prodData || []); // For template dropdown
        }

        // Fetch Templates
        const { data: tempData, error: tempError } = await supabase
            .from('templates')
            .select('*')
            .order('name');

        if (tempError) console.error('Error fetching templates:', tempError);
        else setTemplates(tempData || []);

        setLoading(false);
    };

    const fetchTemplateItems = async (templateId: number) => {
        const { data, error } = await supabase
            .from('template_items')
            .select('*, product:products(*)')
            .eq('template_id', templateId);

        if (data) {
            setTemplateItems(data as any);
        }
    };

    // --- PRODUCT HANDLERS ---

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const { error } = await supabase
            .from('products')
            .insert([{
                name: formData.name,
                unit_price: parseFloat(formData.unit_price),
                unit_size: formData.unit_size,
                requires_approval: formData.requires_approval,
                category_id: formData.category_id ? Number(formData.category_id) : null,
                // Fallback for legacy text column if needed, or leave null
                category: categories.find(c => c.id === Number(formData.category_id))?.name || null
            }]);

        if (error) {
            alert('Error adding product: ' + error.message);
        } else {
            setShowModal(false);
            setFormData({ name: '', unit_price: '0.00', unit_size: '', category_id: '', requires_approval: false });
            fetchData();
        }
    };

    const startEdit = (prod: Product) => {
        setEditingId(prod.id);
        setEditForm(prod);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({});
    };

    const saveEdit = async () => {
        if (!editingId) return;

        const { error } = await supabase
            .from('products')
            .update({
                name: editForm.name,
                category_id: editForm.category_id,
                // Update legacy column for consistency
                category: categories.find(c => c.id === editForm.category_id)?.name || null,
                unit_size: editForm.unit_size,
                unit_price: editForm.unit_price,
                requires_approval: editForm.requires_approval
            })
            .eq('id', editingId);

        if (error) {
            alert('Error updating product: ' + error.message);
        } else {
            setEditingId(null);
            setEditForm({});
            fetchData();
        }
    };

    const confirmDeleteProduct = (id: number) => {
        setProductToDelete(id);
        setShowDeleteModal(true);
    };

    const handleDelete = async () => {
        if (!productToDelete) return;

        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', productToDelete);

        if (error) {
            alert('Error deleting product: ' + error.message);
        } else {
            setShowDeleteModal(false);
            setProductToDelete(null);
            fetchData();
        }
    };

    // --- CATEGORY HANDLERS ---

    const handleCategorySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const { error } = await supabase
            .from('product_categories')
            .insert([{ name: categoryFormData.name }]);

        if (error) {
            alert('Error adding category: ' + error.message);
        } else {
            setShowCategoryModal(false);
            setCategoryFormData({ name: '' });
            fetchData();
        }
    };

    const startEditCategory = (cat: ProductCategory) => {
        setEditingCategoryId(cat.id);
        setEditCategoryForm(cat);
    };

    const cancelEditCategory = () => {
        setEditingCategoryId(null);
        setEditCategoryForm({});
    };

    const saveEditCategory = async () => {
        if (!editingCategoryId) return;

        const { error } = await supabase
            .from('product_categories')
            .update({ name: editCategoryForm.name })
            .eq('id', editingCategoryId);

        if (error) {
            alert('Error updating category: ' + error.message);
        } else {
            setEditingCategoryId(null);
            setEditCategoryForm({});
            fetchData();
        }
    };

    const confirmDeleteCategory = (id: number) => {
        setCategoryToDelete(id);
        setShowDeleteCategoryModal(true);
    };

    const handleDeleteCategory = async () => {
        if (!categoryToDelete) return;

        const { error } = await supabase
            .from('product_categories')
            .delete()
            .eq('id', categoryToDelete);

        if (error) {
            alert('Error deleting category (ensure it has no products first): ' + error.message);
        } else {
            setShowDeleteCategoryModal(false);
            setCategoryToDelete(null);
            fetchData();
        }
    };

    // --- TEMPLATE HANDLERS ---

    const handleOpenTemplate = async (template: Template) => {
        setSelectedTemplate(template);
        await fetchTemplateItems(template.id);
        setTemplateView('detail');
    };

    const handleSaveTemplate = async () => {
        if (!templateForm.name) return;

        if (templateForm.id) {
            await supabase.from('templates').update({
                name: templateForm.name,
                description: templateForm.description
            }).eq('id', templateForm.id);
        } else {
            await supabase.from('templates').insert({
                name: templateForm.name,
                description: templateForm.description
            });
        }
        setShowTemplateModal(false);
        fetchData();
    };

    const handleDeleteTemplate = async (id: number) => {
        if (!confirm('Are you sure? This will delete the template and all its items.')) return;
        await supabase.from('templates').delete().eq('id', id);
        fetchData();
    };

    const handleAddTemplateItem = async () => {
        if (!selectedTemplate || !templateItemForm.product_id) return;

        // Ensure template_id is a valid number
        const templateId = Number(selectedTemplate.id);
        if (!templateId || isNaN(templateId)) {
            alert('Error: Invalid template ID. Please refresh the page.');
            return;
        }

        // Verify template still exists before inserting
        const { data: templateCheck, error: checkError } = await supabase
            .from('templates')
            .select('id')
            .eq('id', templateId)
            .single();

        if (checkError || !templateCheck) {
            alert('Error: Template no longer exists. Please refresh the page.');
            return;
        }

        const { error } = await supabase.from('template_items').insert({
            template_id: templateId,
            product_id: Number(templateItemForm.product_id),
            default_par_level: Number(templateItemForm.default_par_level) || 0
        });

        if (error) {
            alert('Error adding item: ' + error.message);
        } else {
            setShowTemplateItemModal(false);
            setTemplateItemForm({ default_par_level: 0 });
            fetchTemplateItems(templateId);
        }
    };

    const handleDeleteTemplateItem = async (id: number) => {
        if (!confirm('Remove this item?')) return;
        await supabase.from('template_items').delete().eq('id', id);
        if (selectedTemplate) fetchTemplateItems(selectedTemplate.id);
    };

    const handleUpdateTemplateItemPar = async (id: number, newPar: number) => {
        await supabase.from('template_items').update({ default_par_level: newPar }).eq('id', id);
        if (selectedTemplate) fetchTemplateItems(selectedTemplate.id);
    };

    // --- FILTER & SORT ---

    const handleSort = (key: keyof Product | 'category_name') => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getCategoryName = (prod: Product) => {
        if (prod.category_id) {
            return categories.find(c => c.id === prod.category_id)?.name || 'Unknown';
        }
        return prod.category || 'Uncategorized';
    };

    const filteredProducts = products
        .filter(prod => {
            const catName = getCategoryName(prod);
            return (prod.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) &&
                (categoryFilter === '' || catName === categoryFilter || prod.category_id?.toString() === categoryFilter);
        })
        .sort((a, b) => {
            if (!sortConfig) return 0;
            const { key, direction } = sortConfig;

            let valA: any = '';
            let valB: any = '';

            if (key === 'category_name') {
                valA = getCategoryName(a).toLowerCase();
                valB = getCategoryName(b).toLowerCase();
            } else {
                valA = a[key as keyof Product];
                valB = b[key as keyof Product];
            }

            if (valA === valB) return 0;

            const aStr = String(valA ?? '').toLowerCase();
            const bStr = String(valB ?? '').toLowerCase();

            if (key === 'unit_price') {
                // @ts-ignore
                return direction === 'asc' ? (valA - valB) : (valB - valA);
            }

            if (aStr < bStr) return direction === 'asc' ? -1 : 1;
            if (aStr > bStr) return direction === 'asc' ? 1 : -1;
            return 0;
        });

    return (
        <AdminLayout>
            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">
                            {activeTab === 'products' ? 'Products' : 'Product Categories'}
                        </h1>
                        <p className="text-slate-500">Manage groceries, catering items, and categories.</p>
                    </div>
                    <div className="flex gap-3">
                        {activeTab === 'products' ? (
                            <button
                                onClick={() => setShowModal(true)}
                                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                            >
                                <Plus className="h-4 w-4" />
                                Add Product
                            </button>
                        ) : (
                            <button
                                onClick={() => setShowCategoryModal(true)}
                                className="flex items-center gap-2 rounded-lg bg-white border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                                <FolderPlus className="h-4 w-4" />
                                Add Category
                            </button>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-slate-200">
                    <div className="flex gap-6">
                        <button
                            onClick={() => setActiveTab('products')}
                            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'products' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            Products
                        </button>
                        <button
                            onClick={() => setActiveTab('categories')}
                            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'categories' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            Categories
                        </button>
                        <button
                            onClick={() => { setActiveTab('templates'); setTemplateView('list'); }}
                            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'templates' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            Templates
                        </button>
                    </div>
                </div>

                {activeTab === 'products' && (
                    <>
                        {/* Filters */}
                        <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search products..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Filter className="h-4 w-4 text-slate-400" />
                                <select
                                    value={categoryFilter}
                                    onChange={(e) => setCategoryFilter(e.target.value)}
                                    className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                >
                                    <option value="">All Categories</option>
                                    {categories.map(c => (
                                        <option key={c.id} value={c.id.toString()}>{c.name}</option>
                                    ))}
                                    {/* Fallback for unmigrated data if any */}
                                    <option value="Uncategorized">Uncategorized</option>
                                </select>
                            </div>
                            <div className="ml-auto text-sm text-slate-500">
                                {filteredProducts.length} items found
                            </div>
                        </div>

                        {/* Table */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                                    <tr>
                                        <th
                                            className="px-6 py-3 font-medium cursor-pointer hover:bg-slate-100 transition-colors group"
                                            onClick={() => handleSort('name')}
                                        >
                                            <div className="flex items-center gap-1">
                                                Name
                                                <ArrowUpDown className={`h-3 w-3 ${sortConfig?.key === 'name' ? 'text-emerald-600' : 'text-slate-300 group-hover:text-slate-400'}`} />
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-3 font-medium cursor-pointer hover:bg-slate-100 transition-colors group"
                                            onClick={() => handleSort('category_name')}
                                        >
                                            <div className="flex items-center gap-1">
                                                Category
                                                <ArrowUpDown className={`h-3 w-3 ${sortConfig?.key === 'category_name' ? 'text-emerald-600' : 'text-slate-300 group-hover:text-slate-400'}`} />
                                            </div>
                                        </th>
                                        <th className="px-6 py-3 font-medium">Size/Unit</th>
                                        <th
                                            className="px-6 py-3 font-medium cursor-pointer hover:bg-slate-100 transition-colors group"
                                            onClick={() => handleSort('unit_price')}
                                        >
                                            <div className="flex items-center gap-1">
                                                Price
                                                <ArrowUpDown className={`h-3 w-3 ${sortConfig?.key === 'unit_price' ? 'text-emerald-600' : 'text-slate-300 group-hover:text-slate-400'}`} />
                                            </div>
                                        </th>
                                        <th className="px-6 py-3 font-medium">Approval</th>
                                        <th className="px-6 py-3 font-medium w-24">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                                                    <p>Loading products...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredProducts.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                                No products found
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredProducts.map((prod) => (
                                            <tr key={prod.id} className="hover:bg-slate-50 transition-colors">
                                                {editingId === prod.id ? (
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
                                                                value={editForm.category_id || ''}
                                                                onChange={e => setEditForm({ ...editForm, category_id: e.target.value ? Number(e.target.value) : null })}
                                                                className="w-full border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                            >
                                                                <option value="">Unassigned</option>
                                                                {categories.map(c => (
                                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            <input
                                                                value={editForm.unit_size || ''}
                                                                onChange={e => setEditForm({ ...editForm, unit_size: e.target.value })}
                                                                className="w-full border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                            />
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={editForm.unit_price || 0}
                                                                onChange={e => setEditForm({ ...editForm, unit_price: parseFloat(e.target.value) })}
                                                                className="w-full border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                            />
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            <input
                                                                type="checkbox"
                                                                checked={editForm.requires_approval || false}
                                                                onChange={e => setEditForm({ ...editForm, requires_approval: e.target.checked })}
                                                                className="rounded text-emerald-600 focus:ring-emerald-500"
                                                            />
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
                                                        <td className="px-6 py-3 font-medium text-slate-900">{prod.name}</td>
                                                        <td className="px-6 py-3 text-slate-600">{getCategoryName(prod)}</td>
                                                        <td className="px-6 py-3 text-slate-600">{prod.unit_size || '-'}</td>
                                                        <td className="px-6 py-3 text-slate-600">${prod.unit_price?.toFixed(2)}</td>
                                                        <td className="px-6 py-3">
                                                            {prod.requires_approval ? (
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                                                    Required
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-400 text-xs">-</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => startEdit(prod)}
                                                                    className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => confirmDeleteProduct(prod.id)}
                                                                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
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
                )}

                {activeTab === 'categories' && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3 font-medium">Category Name</th>
                                    <th className="px-6 py-3 font-medium">Products Count</th>
                                    <th className="px-6 py-3 font-medium w-24">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr><td colSpan={3} className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-emerald-600" /></td></tr>
                                ) : categories.length === 0 ? (
                                    <tr><td colSpan={3} className="p-6 text-center text-slate-500">No categories found.</td></tr>
                                ) : (
                                    categories.map(cat => {
                                        const prodCount = products.filter(p => p.category_id === cat.id).length;
                                        return (
                                            <tr key={cat.id} className="hover:bg-slate-50 transition-colors">
                                                {editingCategoryId === cat.id ? (
                                                    // Edit Category Mode
                                                    <>
                                                        <td className="px-6 py-3">
                                                            <input
                                                                value={editCategoryForm.name || ''}
                                                                onChange={e => setEditCategoryForm({ ...editCategoryForm, name: e.target.value })}
                                                                className="w-full border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                            />
                                                        </td>
                                                        <td className="px-6 py-3 text-slate-500">{prodCount}</td>
                                                        <td className="px-6 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <button onClick={saveEditCategory} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                                                                    <Save className="h-4 w-4" />
                                                                </button>
                                                                <button onClick={cancelEditCategory} className="p-1 text-slate-400 hover:bg-slate-100 rounded">
                                                                    <X className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </>
                                                ) : (
                                                    // View Category Mode
                                                    <>
                                                        <td className="px-6 py-3 font-medium text-slate-900">{cat.name}</td>
                                                        <td className="px-6 py-3 text-slate-500">{prodCount}</td>
                                                        <td className="px-6 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => startEditCategory(cat)}
                                                                    className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => confirmDeleteCategory(cat.id)}
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
                )}

                {/* Add Product Modal */}
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6">
                            <h2 className="text-xl font-bold mb-4">Add New Product</h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Product Name</label>
                                    <input
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                        placeholder="e.g. Fresh Milk 2L"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Unit / Size</label>
                                    <input
                                        value={formData.unit_size}
                                        onChange={e => setFormData({ ...formData, unit_size: e.target.value })}
                                        className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                        placeholder="e.g. 1 Litre, Box of 100"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                                        <select
                                            value={formData.category_id}
                                            onChange={e => setFormData({ ...formData, category_id: e.target.value })}
                                            className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                        >
                                            <option value="">Select...</option>
                                            {categories.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Price ($)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={formData.unit_price}
                                            onChange={e => setFormData({ ...formData, unit_price: e.target.value })}
                                            className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="approval"
                                        checked={formData.requires_approval}
                                        onChange={e => setFormData({ ...formData, requires_approval: e.target.checked })}
                                        className="rounded text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <label htmlFor="approval" className="text-sm text-slate-700">Requires Manager Approval</label>
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
                                        Create Product
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Add Category Modal */}
                {showCategoryModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6">
                            <h2 className="text-xl font-bold mb-6 text-slate-900">Add New Category</h2>
                            <form onSubmit={handleCategorySubmit}>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Category Name</label>
                                        <input
                                            required
                                            type="text"
                                            value={categoryFormData.name}
                                            onChange={e => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                                            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                                            placeholder="e.g. Frozen Foods"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setShowCategoryModal(false)}
                                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                                    >
                                        Add Category
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Delete Product Modal */}
                {showDeleteModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="w-full max-w-sm bg-white rounded-xl shadow-xl p-6">
                            <h2 className="text-xl font-bold mb-2 text-slate-900">Delete Product</h2>
                            <p className="text-slate-500 mb-6">Are you sure you want to delete this product? This action cannot be undone.</p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setShowDeleteModal(false);
                                        setProductToDelete(null);
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
                )}

                {/* Delete Category Modal */}
                {showDeleteCategoryModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="w-full max-w-sm bg-white rounded-xl shadow-xl p-6">
                            <h2 className="text-xl font-bold mb-2 text-slate-900">Delete Category</h2>
                            <p className="text-slate-500 mb-6">Are you sure you want to delete this category? Ensure no products are assigned to it first.</p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setShowDeleteCategoryModal(false);
                                        setCategoryToDelete(null);
                                    }}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteCategory}
                                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'templates' && (
                    templateView === 'list' ? (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">Template Name</th>
                                        <th className="px-6 py-3 font-medium">Description</th>
                                        <th className="px-6 py-3 font-medium w-32">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                                                    <p>Loading templates...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : templates.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                                                No templates found. Create your first template to get started.
                                            </td>
                                        </tr>
                                    ) : (
                                        templates.map((template) => (
                                            <tr key={template.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-3 font-medium text-slate-900">{template.name}</td>
                                                <td className="px-6 py-3 text-slate-500">
                                                    {template.description || <span className="italic text-slate-400">No description</span>}
                                                </td>
                                                <td className="px-6 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleOpenTemplate(template)}
                                                            className="text-emerald-600 hover:text-emerald-700 font-medium"
                                                            title="Manage Items"
                                                        >
                                                            <FileText className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => { setTemplateForm(template); setShowTemplateModal(true); }}
                                                            className="text-slate-400 hover:text-emerald-600"
                                                            title="Edit"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteTemplate(template.id)}
                                                            className="text-slate-400 hover:text-red-500"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                                <h3 className="font-semibold text-slate-700">Template Items</h3>
                                <button
                                    onClick={() => { setTemplateItemForm({ default_par_level: 0 }); setShowTemplateItemModal(true); }}
                                    className="text-sm bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg hover:bg-emerald-100 font-medium transition-colors"
                                >
                                    + Add Product
                                </button>
                            </div>
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-600 border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">Product</th>
                                        <th className="px-6 py-3 font-medium">Category</th>
                                        <th className="px-6 py-3 font-medium">Default Par Level</th>
                                        <th className="px-6 py-3 font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {templateItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-slate-500">
                                                No items in this template yet. Add products to get started.
                                            </td>
                                        </tr>
                                    ) : (
                                        templateItems.map(item => (
                                            <tr key={item.id} className="hover:bg-slate-50">
                                                <td className="px-6 py-3 font-medium text-slate-800">{item.product?.name}</td>
                                                <td className="px-6 py-3 text-slate-500">{item.product?.category}</td>
                                                <td className="px-6 py-3">
                                                    <input
                                                        type="number"
                                                        value={item.default_par_level}
                                                        onChange={(e) => handleUpdateTemplateItemPar(item.id, parseInt(e.target.value) || 0)}
                                                        className="w-20 border border-slate-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                    />
                                                </td>
                                                <td className="px-6 py-3 text-right">
                                                    <button
                                                        onClick={() => handleDeleteTemplateItem(item.id)}
                                                        className="text-red-500 hover:text-red-700 transition-colors"
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
                    )
                )}

                {/* Template Modal */}
                {showTemplateModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                            <div className="p-6 border-b border-slate-100">
                                <h2 className="text-xl font-bold text-slate-800">
                                    {templateForm.id ? 'Edit Template' : 'New Template'}
                                </h2>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Template Name</label>
                                    <input
                                        type="text"
                                        value={templateForm.name || ''}
                                        onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })}
                                        className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                                        placeholder="e.g., Standard Ward Pantry"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                    <textarea
                                        value={templateForm.description || ''}
                                        onChange={e => setTemplateForm({ ...templateForm, description: e.target.value })}
                                        className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none h-24 resize-none"
                                        placeholder="Optional description..."
                                    />
                                </div>
                            </div>
                            <div className="p-6 bg-slate-50 flex justify-end gap-3">
                                <button
                                    onClick={() => setShowTemplateModal(false)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveTemplate}
                                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                                >
                                    Save Template
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Template Item Modal */}
                {showTemplateItemModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                            <div className="p-6 border-b border-slate-100">
                                <h2 className="text-xl font-bold text-slate-800">Add Product to Template</h2>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Product</label>
                                    <select
                                        value={templateItemForm.product_id || ''}
                                        onChange={e => {
                                            const val = Number(e.target.value);
                                            setTemplateItemForm(prev => ({ ...prev, product_id: val || undefined }));
                                        }}
                                        className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                                    >
                                        <option value="">Select a product...</option>
                                        {productsForTemplate.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} ({p.unit_size || 'N/A'})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Default Par Level</label>
                                    <input
                                        type="number"
                                        value={templateItemForm.default_par_level}
                                        onChange={e => setTemplateItemForm({ ...templateItemForm, default_par_level: parseInt(e.target.value) || 0 })}
                                        className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="p-6 bg-slate-50 flex justify-end gap-3">
                                <button
                                    onClick={() => setShowTemplateItemModal(false)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddTemplateItem}
                                    disabled={!templateItemForm.product_id}
                                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                >
                                    Add Item
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </AdminLayout>
    );
}
