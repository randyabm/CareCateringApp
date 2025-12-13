'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Plus, Search, Edit2, Trash2, FileText, ArrowLeft, Save } from 'lucide-react';
import { Database } from '@/types/database.types';

type Template = Database['public']['Tables']['templates']['Row'];
type TemplateItem = Database['public']['Tables']['template_items']['Row'] & {
    product?: Database['public']['Tables']['products']['Row'];
};
type Product = Database['public']['Tables']['products']['Row'];

export default function TemplatesPage() {
    const supabase = createClient();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'list' | 'detail'>('list');
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [templateItems, setTemplateItems] = useState<TemplateItem[]>([]);
    const [products, setProducts] = useState<Product[]>([]);

    // Edit/Create Template State
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [templateForm, setTemplateForm] = useState<Partial<Template>>({});

    // Add Item State
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [itemForm, setItemForm] = useState<{ product_id?: number; default_par_level: number }>({ default_par_level: 0 });

    useEffect(() => {
        fetchTemplates();
        fetchProducts();
    }, []);

    const fetchTemplates = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('templates')
            .select('*')
            .order('name');
        if (data) setTemplates(data);
        setLoading(false);
    };

    const fetchProducts = async () => {
        const { data } = await supabase.from('products').select('*').order('name');
        if (data) setProducts(data);
    };

    const fetchTemplateItems = async (templateId: number) => {
        const { data, error } = await supabase
            .from('template_items')
            .select('*, product:products(*)')
            .eq('template_id', templateId);

        if (data) {
            // calculated type assertion as supabase join types are tricky
            setTemplateItems(data as any);
        }
    };

    const handleOpenTemplate = async (template: Template) => {
        setSelectedTemplate(template);
        await fetchTemplateItems(template.id);
        setView('detail');
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
        setIsTemplateModalOpen(false);
        fetchTemplates();
    };

    const handleDeleteTemplate = async (id: number) => {
        if (!confirm('Are you sure? This will delete the template and all its items.')) return;
        await supabase.from('templates').delete().eq('id', id);
        fetchTemplates();
    };

    const handleAddItem = async () => {
        if (!selectedTemplate || !itemForm.product_id) return;

        const { error } = await supabase.from('template_items').insert({
            template_id: selectedTemplate.id,
            product_id: itemForm.product_id,
            default_par_level: itemForm.default_par_level
        });

        if (error) {
            alert('Error adding item (maybe duplicate?)');
        } else {
            setIsItemModalOpen(false);
            fetchTemplateItems(selectedTemplate.id);
        }
    };

    const handleDeleteItem = async (id: number) => {
        if (!confirm('Remove this item?')) return;
        await supabase.from('template_items').delete().eq('id', id);
        if (selectedTemplate) fetchTemplateItems(selectedTemplate.id);
    };

    const handleUpdateItemPar = async (id: number, newPar: number) => {
        await supabase.from('template_items').update({ default_par_level: newPar }).eq('id', id);
        if (selectedTemplate) fetchTemplateItems(selectedTemplate.id);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">
                        {view === 'list' ? 'Templates' : `Template: ${selectedTemplate?.name}`}
                    </h1>
                    <p className="text-slate-500 mt-1">Manage stock templates for proactive restocking.</p>
                </div>
                {view === 'list' ? (
                    <button
                        onClick={() => { setTemplateForm({}); setIsTemplateModalOpen(true); }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <Plus className="h-5 w-5" />
                        Create Template
                    </button>
                ) : (
                    <button
                        onClick={() => setView('list')}
                        className="text-slate-600 hover:text-slate-900 flex items-center gap-2"
                    >
                        <ArrowLeft className="h-5 w-5" />
                        Back to List
                    </button>
                )}
            </div>

            {view === 'list' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {templates.map(template => (
                        <div key={template.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                                    <FileText className="h-6 w-6" />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setTemplateForm(template); setIsTemplateModalOpen(true); }}
                                        className="p-1 text-slate-400 hover:text-emerald-600 transition-colors"
                                    >
                                        <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteTemplate(template.id)}
                                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                            <h3 className="text-lg font-semibold text-slate-800 mb-2">{template.name}</h3>
                            <p className="text-sm text-slate-500 mb-6 line-clamp-2">{template.description || 'No description provided.'}</p>
                            <button
                                onClick={() => handleOpenTemplate(template)}
                                className="w-full py-2 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors border border-slate-200"
                            >
                                Manage Items
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="font-semibold text-slate-700">Template Items</h3>
                        <button
                            onClick={() => { setItemForm({ default_par_level: 0 }); setIsItemModalOpen(true); }}
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
                                                onChange={(e) => handleUpdateItemPar(item.id, parseInt(e.target.value) || 0)}
                                                className="w-20 border border-slate-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                            />
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <button
                                                onClick={() => handleDeleteItem(item.id)}
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
            )}

            {/* Template Modal */}
            {isTemplateModalOpen && (
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
                                onClick={() => setIsTemplateModalOpen(false)}
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

            {/* Add Item Modal */}
            {isItemModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-slate-100">
                            <h2 className="text-xl font-bold text-slate-800">Add Product to Template</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Product</label>
                                <select
                                    value={itemForm.product_id || ''}
                                    onChange={e => {
                                        const val = Number(e.target.value);
                                        setItemForm(prev => ({ ...prev, product_id: val || undefined }));
                                    }}
                                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                                >
                                    <option value="">Select a product...</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.unit_size || 'N/A'})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Default Par Level</label>
                                <input
                                    type="number"
                                    value={itemForm.default_par_level}
                                    onChange={e => setItemForm({ ...itemForm, default_par_level: parseInt(e.target.value) || 0 })}
                                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 flex justify-end gap-3">
                            <button
                                onClick={() => setIsItemModalOpen(false)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddItem}
                                disabled={!itemForm.product_id}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                            >
                                Add Item
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
