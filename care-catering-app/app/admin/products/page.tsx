'use client';

import AdminLayout from '@/components/admin/AdminLayout';
import { createClient } from '@/utils/supabase/client';
import { Database } from '@/types/database.types';
import { useEffect, useState, useRef } from 'react';
import { Plus, Search, Loader2, Pencil, Save, X, Trash2, ArrowUpDown, Filter, FolderPlus, FileText, Edit2, ArrowLeft, Upload } from 'lucide-react';

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
    const [showInlineAddForm, setShowInlineAddForm] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        unit_price: '0.00',
        unit_size: '',
        category_id: '' as string | number,
        requires_approval: false,
        storage_stock: 0,
        storage_reorder_point: 0
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
    const [templateItemForm, setTemplateItemForm] = useState<{ product_id?: number; default_par_level: number }>({ default_par_level: 1 });
    const [templateProductSearch, setTemplateProductSearch] = useState('');
    const [showTemplateProductDropdown, setShowTemplateProductDropdown] = useState(false);
    const templateProductDropdownRef = useRef<HTMLDivElement>(null);
    const [showTemplateInlineAddForm, setShowTemplateInlineAddForm] = useState(false);

    // CSV Upload States
    const [showCsvModal, setShowCsvModal] = useState(false);
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [csvUploading, setCsvUploading] = useState(false);
    const [csvResults, setCsvResults] = useState<{ 
        new: number; 
        updated: number; 
        updatedProducts: string[];
        errors: string[] 
    } | null>(null);

    const supabase = createClient();

    useEffect(() => {
        fetchData();
    }, []);

    // Close template product dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (templateProductDropdownRef.current && !templateProductDropdownRef.current.contains(event.target as Node)) {
                setShowTemplateProductDropdown(false);
            }
        };

        if (showTemplateProductDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showTemplateProductDropdown]);

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

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const { error } = await supabase
            .from('products')
            .insert([{
                name: formData.name,
                unit_price: parseFloat(formData.unit_price),
                unit_size: formData.unit_size,
                requires_approval: formData.requires_approval,
                storage_stock: Math.max(0, Number(formData.storage_stock) || 0),
                storage_reorder_point: Math.max(0, Number(formData.storage_reorder_point) || 0),
                category_id: formData.category_id ? Number(formData.category_id) : null,
                // Fallback for legacy text column if needed, or leave null
                category: categories.find(c => c.id === Number(formData.category_id))?.name || null
            }]);

        if (error) {
            alert('Error adding product: ' + error.message);
        } else {
            setShowModal(false);
            setShowInlineAddForm(false);
            setFormData({ name: '', unit_price: '0.00', unit_size: '', category_id: '', requires_approval: false, storage_stock: 0, storage_reorder_point: 0 });
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
                requires_approval: editForm.requires_approval,
                storage_stock: Math.max(0, editForm.storage_stock ?? 0),
                storage_reorder_point: Math.max(0, editForm.storage_reorder_point ?? 0)
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

    const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveEdit();
        }
    };

    const handleAddKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
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
        setShowTemplateInlineAddForm(false);
        setTemplateItemForm({ default_par_level: 1 });
        setTemplateProductSearch('');
        setShowTemplateProductDropdown(false);
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

        // Validate par level is greater than 0
        const parLevel = Number(templateItemForm.default_par_level);
        if (!parLevel || parLevel <= 0) {
            alert('Error: Default Par Level must be greater than 0.');
            return;
        }

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

        // Check if item already exists in template
        const productId = Number(templateItemForm.product_id);
        const { data: existingItem } = await supabase
            .from('template_items')
            .select('id, product:products(name)')
            .eq('template_id', templateId)
            .eq('product_id', productId)
            .single();

        if (existingItem) {
            const productName = (existingItem.product as any)?.name || 'this product';
            alert(`Error: ${productName} already exists in this template.`);
            return;
        }

        const { error } = await supabase.from('template_items').insert({
            template_id: templateId,
            product_id: productId,
            default_par_level: parLevel
        });

        if (error) {
            // Check if it's a unique constraint violation (duplicate)
            if (error.code === '23505' || error.message.includes('duplicate') || error.message.includes('unique')) {
                alert('Error: This item already exists in the template.');
            } else {
                alert('Error adding item: ' + error.message);
            }
        } else {
            setShowTemplateItemModal(false);
            setShowTemplateInlineAddForm(false);
            setTemplateItemForm({ default_par_level: 1 });
            setTemplateProductSearch('');
            setShowTemplateProductDropdown(false);
            fetchTemplateItems(templateId);
        }
    };

    // Filter products for template modal based on search and exclude already added products
    const existingTemplateProductIds = templateItems.map(item => item.product_id).filter(Boolean);
    const filteredTemplateProducts = productsForTemplate.filter(p => {
        // Exclude products already in the template
        if (existingTemplateProductIds.includes(p.id)) return false;
        
        // Filter by search term
        if (!templateProductSearch.trim()) return true;
        const searchLower = templateProductSearch.toLowerCase();
        return p.name.toLowerCase().includes(searchLower) ||
               (p.unit_size && p.unit_size.toLowerCase().includes(searchLower)) ||
               (p.category && p.category.toLowerCase().includes(searchLower));
    });

    const handleTemplateProductSelect = (product: Product) => {
        setTemplateItemForm(prev => ({ ...prev, product_id: product.id }));
        setTemplateProductSearch(product.name);
        setShowTemplateProductDropdown(false);
    };

    const handleDeleteTemplateItem = async (id: number) => {
        if (!confirm('Remove this item?')) return;
        await supabase.from('template_items').delete().eq('id', id);
        if (selectedTemplate) fetchTemplateItems(selectedTemplate.id);
    };

    const handleUpdateTemplateItemPar = async (id: number, newPar: number) => {
        const safePar = Math.max(1, newPar || 1);
        await supabase.from('template_items').update({ default_par_level: safePar }).eq('id', id);
        if (selectedTemplate) fetchTemplateItems(selectedTemplate.id);
    };

    // --- CSV UPLOAD HANDLERS ---

    const parseCSV = (text: string): Array<Record<string, string>> => {
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        if (lines.length === 0) return [];

        // Helper function to parse CSV line handling quoted fields
        const parseCSVLine = (line: string): string[] => {
            const result: string[] = [];
            let current = '';
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                const nextChar = line[i + 1];

                if (char === '"') {
                    if (inQuotes && nextChar === '"') {
                        // Escaped quote
                        current += '"';
                        i++; // Skip next quote
                    } else {
                        // Toggle quote state
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    // End of field
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }

            // Add last field
            result.push(current.trim());
            return result;
        };

        // Parse header
        const headerLine = parseCSVLine(lines[0]);
        const headers = headerLine.map(h => h.toLowerCase().replace(/^"|"$/g, '').trim());
        const rows: Array<Record<string, string>> = [];

        // Parse data rows
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            if (values.length === 0 || values.every(v => !v)) continue; // Skip empty rows

            const row: Record<string, string> = {};
            headers.forEach((header, index) => {
                let value = values[index] || '';
                // Remove surrounding quotes if present
                value = value.replace(/^"|"$/g, '');
                row[header] = value;
            });
            rows.push(row);
        }

        return rows;
    };

    const findCategoryId = (categoryName: string): number | null => {
        if (!categoryName) return null;
        const category = categories.find(
            c => c.name.toLowerCase().trim() === categoryName.toLowerCase().trim()
        );
        return category?.id || null;
    };

    const handleCsvUpload = async () => {
        if (!csvFile) return;

        setCsvUploading(true);
        setCsvResults(null);

        try {
            const text = await csvFile.text();
            const rows = parseCSV(text);

            if (rows.length === 0) {
                setCsvResults({ new: 0, updated: 0, updatedProducts: [], errors: ['CSV file is empty or invalid'] });
                setCsvUploading(false);
                return;
            }

            const productsToProcess: Array<{
                name: string;
                unit_price: number;
                unit_size?: string | null;
                category_id?: number | null;
                category?: string | null;
                requires_approval: boolean;
            }> = [];

            const errors: string[] = [];

            // Map CSV columns to product fields
            // Expected columns: name, price, unit_size, category, requires_approval
            rows.forEach((row, index) => {
                const rowNum = index + 2; // +2 because index is 0-based and we skip header

                // Required: name
                const name = (row.name || row['product name'] || row.product || '').trim();
                if (!name) {
                    errors.push(`Row ${rowNum}: Missing product name`);
                    return;
                }

                // Price (required, default to 0)
                const priceStr = (row.price || row['unit price'] || row['unit_price'] || '0').trim();
                const price = parseFloat(priceStr) || 0;

                // Unit size (optional)
                const unitSize = (row['unit size'] || row['unit_size'] || row.size || row.unit || '').trim() || null;

                // Category (optional, can be name or ID)
                const categoryInput = (row.category || row['category name'] || row['category_id'] || '').trim();
                let categoryId: number | null = null;
                let categoryName: string | null = null;

                if (categoryInput) {
                    // Try to parse as number (category ID)
                    const parsedId = parseInt(categoryInput);
                    if (!isNaN(parsedId)) {
                        categoryId = categories.find(c => c.id === parsedId)?.id || null;
                    } else {
                        // Treat as category name
                        categoryId = findCategoryId(categoryInput);
                        categoryName = categoryId ? null : categoryInput; // Only set if not found
                    }
                }

                // Requires approval (optional, default false)
                const requiresApproval = (
                    row['requires approval'] || 
                    row['requires_approval'] || 
                    row.approval || 
                    'false'
                ).trim().toLowerCase() === 'true' || 
                (row['requires approval'] || row['requires_approval'] || row.approval || '').trim() === '1';

                productsToProcess.push({
                    name,
                    unit_price: price,
                    unit_size: unitSize,
                    category_id: categoryId,
                    category: categoryName,
                    requires_approval: requiresApproval
                });
            });

            if (productsToProcess.length === 0) {
                setCsvResults({ new: 0, updated: 0, updatedProducts: [], errors: errors.length > 0 ? errors : ['No valid products to import'] });
                setCsvUploading(false);
                return;
            }

            // Check for existing products by name (case-insensitive)
            const existingProductsMap = new Map<string, Product>();
            products.forEach(prod => {
                const key = prod.name.toLowerCase().trim();
                existingProductsMap.set(key, prod);
            });

            // Separate new products from existing ones
            const productsToInsert: typeof productsToProcess = [];
            const productsToUpdate: Array<{ id: number; name: string; data: typeof productsToProcess[0] }> = [];
            const updatedProductNames: string[] = [];

            productsToProcess.forEach(product => {
                const productKey = product.name.toLowerCase().trim();
                const existing = existingProductsMap.get(productKey);

                if (existing) {
                    // Product exists - prepare for update
                    productsToUpdate.push({
                        id: existing.id,
                        name: existing.name,
                        data: product
                    });
                    updatedProductNames.push(product.name);
                } else {
                    // New product - prepare for insert
                    productsToInsert.push(product);
                }
            });

            let newCount = 0;
            let updatedCount = 0;
            const insertErrors: string[] = [];
            const updateErrors: string[] = [];

            // Insert new products in batches
            if (productsToInsert.length > 0) {
                const batchSize = 100;
                for (let i = 0; i < productsToInsert.length; i += batchSize) {
                    const batch = productsToInsert.slice(i, i + batchSize);
                    const { error } = await supabase
                        .from('products')
                        .insert(batch);

                    if (error) {
                        insertErrors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
                    } else {
                        newCount += batch.length;
                    }
                }
            }

            // Update existing products - only update category and price
            for (const productUpdate of productsToUpdate) {
                const updateData: any = {
                    unit_price: productUpdate.data.unit_price
                };

                // Update category if provided in CSV
                // category_id is set if category was found by ID or name
                // category is set only if category name was provided but not found in categories
                if (productUpdate.data.category_id !== null && productUpdate.data.category_id !== undefined) {
                    // Category ID was found/parsed - update both ID and name
                    updateData.category_id = productUpdate.data.category_id;
                    const category = categories.find(c => c.id === productUpdate.data.category_id);
                    updateData.category = category?.name || null;
                } else if (productUpdate.data.category) {
                    // Category name provided but ID not found - set as text category
                    updateData.category = productUpdate.data.category;
                    updateData.category_id = null;
                }
                // If no category provided (both null/undefined), don't update category fields

                const { error } = await supabase
                    .from('products')
                    .update(updateData)
                    .eq('id', productUpdate.id);

                if (error) {
                    updateErrors.push(`${productUpdate.name}: ${error.message}`);
                } else {
                    updatedCount++;
                }
            }

            setCsvResults({
                new: newCount,
                updated: updatedCount,
                updatedProducts: updatedProductNames,
                errors: [...errors, ...insertErrors, ...updateErrors]
            });

            if (newCount > 0 || updatedCount > 0) {
                // Refresh data
                await fetchData();
            }
        } catch (error: any) {
            setCsvResults({
                new: 0,
                updated: 0,
                updatedProducts: [],
                errors: [`Error processing CSV: ${error.message}`],
            });
        } finally {
            setCsvUploading(false);
        }
    };

    const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
                setCsvFile(file);
                setCsvResults(null);
            } else {
                alert('Please select a CSV file');
                e.target.value = '';
            }
        }
    };

    const resetCsvUpload = () => {
        setCsvFile(null);
        setCsvResults(null);
        setShowCsvModal(false);
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
                            {activeTab === 'products' ? 'Products' : activeTab === 'categories' ? 'Product Categories' : 'Templates'}
                        </h1>
                        <p className="text-slate-500">
                            {activeTab === 'products' ? 'Manage groceries, catering items, and categories.' : activeTab === 'categories' ? 'Manage groceries, catering items, and categories.' : 'Manage stock templates for proactive restocking.'}
                        </p>
                    </div>
                    <div className="flex gap-3">
                        {activeTab === 'products' ? (
                            <>
                                <button
                                    onClick={() => setShowCsvModal(true)}
                                    className="flex items-center gap-2 rounded-lg bg-white border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                    <Upload className="h-4 w-4" />
                                    Upload CSV
                                </button>
                                <button
                                    onClick={() => {
                                        if (showInlineAddForm) {
                                            // Cancel add mode
                                            setShowInlineAddForm(false);
                                            setFormData({ name: '', unit_price: '0.00', unit_size: '', category_id: '', requires_approval: false, storage_stock: 0, storage_reorder_point: 0 });
                                        } else {
                                            // Show add form
                                            setShowInlineAddForm(true);
                                            setFormData({ name: '', unit_price: '0.00', unit_size: '', category_id: '', requires_approval: false, storage_stock: 0, storage_reorder_point: 0 });
                                        }
                                    }}
                                    className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                                >
                                    <Plus className="h-4 w-4" />
                                    {showInlineAddForm ? 'Cancel' : 'Add Product'}
                                </button>
                            </>
                        ) : activeTab === 'categories' ? (
                            <button
                                onClick={() => setShowCategoryModal(true)}
                                className="flex items-center gap-2 rounded-lg bg-white border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                                <FolderPlus className="h-4 w-4" />
                                Add Category
                            </button>
                        ) : (
                            <button
                                onClick={() => { setTemplateForm({}); setShowTemplateModal(true); }}
                                className="flex items-center gap-2 rounded-lg bg-white border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                                <FileText className="h-4 w-4" />
                                Add Template
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
                                        <th className="px-6 py-3 font-medium">Storage Stock</th>
                                        <th className="px-6 py-3 font-medium">Reorder Point</th>
                                        <th className="px-6 py-3 font-medium">Approval</th>
                                        <th className="px-6 py-3 font-medium w-24">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {/* Inline Add Form */}
                                    {showInlineAddForm && (
                                        <tr className="bg-emerald-50/50">
                                            <td className="px-6 py-3">
                                                <input
                                                    value={formData.name}
                                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                    onFocus={(e) => e.target.select()}
                                                    onKeyDown={handleAddKeyDown}
                                                    placeholder="Product Name"
                                                    className="w-full border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                    autoFocus
                                                />
                                            </td>
                                            <td className="px-6 py-3">
                                                <select
                                                    value={formData.category_id}
                                                    onChange={e => setFormData({ ...formData, category_id: e.target.value })}
                                                    onKeyDown={handleAddKeyDown}
                                                    className="w-full border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                >
                                                    <option value="">Select...</option>
                                                    {categories.map(c => (
                                                        <option key={c.id} value={c.id}>{c.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-6 py-3">
                                                <input
                                                    value={formData.unit_size}
                                                    onChange={e => setFormData({ ...formData, unit_size: e.target.value })}
                                                    onFocus={(e) => e.target.select()}
                                                    onKeyDown={handleAddKeyDown}
                                                    placeholder="Size/Unit"
                                                    className="w-full border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                />
                                            </td>
                                            <td className="px-6 py-3">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={formData.unit_price}
                                                    onChange={e => setFormData({ ...formData, unit_price: e.target.value })}
                                                    onFocus={(e) => e.target.select()}
                                                    onKeyDown={handleAddKeyDown}
                                                    placeholder="Price"
                                                    className="w-full border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                />
                                            </td>
                                            <td className="px-6 py-3">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={formData.storage_stock}
                                                    onChange={e => setFormData({ ...formData, storage_stock: parseInt(e.target.value) || 0 })}
                                                    onFocus={(e) => e.target.select()}
                                                    onKeyDown={handleAddKeyDown}
                                                    placeholder="Storage Stock"
                                                    className="w-full border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                />
                                            </td>
                                            <td className="px-6 py-3">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={formData.storage_reorder_point}
                                                    onChange={e => setFormData({ ...formData, storage_reorder_point: parseInt(e.target.value) || 0 })}
                                                    onFocus={(e) => e.target.select()}
                                                    onKeyDown={handleAddKeyDown}
                                                    placeholder="Reorder Point"
                                                    className="w-full border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                />
                                            </td>
                                            <td className="px-6 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.requires_approval}
                                                    onChange={e => setFormData({ ...formData, requires_approval: e.target.checked })}
                                                    className="rounded text-emerald-600 focus:ring-emerald-500"
                                                />
                                            </td>
                                            <td className="px-6 py-3">
                                                <div className="flex items-center gap-2">
                                                    <button 
                                                        onClick={() => handleSubmit()} 
                                                        disabled={!formData.name}
                                                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded disabled:opacity-50"
                                                    >
                                                        <Save className="h-4 w-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            setShowInlineAddForm(false);
                                                            setFormData({ name: '', unit_price: '0.00', unit_size: '', category_id: '', requires_approval: false, storage_stock: 0, storage_reorder_point: 0 });
                                                        }} 
                                                        className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    {loading ? (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                                                    <p>Loading products...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredProducts.length === 0 && !showInlineAddForm ? (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                                                No products found
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredProducts.map((prod) => (
                                            <tr 
                                                key={prod.id} 
                                                className="hover:bg-slate-50 transition-colors cursor-pointer"
                                                onDoubleClick={() => {
                                                    if (editingId !== prod.id) {
                                                        startEdit(prod);
                                                    }
                                                }}
                                            >
                                                {editingId === prod.id ? (
                                                    // Edit Mode
                                                    <>
                                                        <td className="px-6 py-3">
                                                            <input
                                                                value={editForm.name || ''}
                                                                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                                onFocus={(e) => e.target.select()}
                                                                onKeyDown={handleEditKeyDown}
                                                                className="w-full border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                            />
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            <select
                                                                value={editForm.category_id || ''}
                                                                onChange={e => setEditForm({ ...editForm, category_id: e.target.value ? Number(e.target.value) : null })}
                                                                onKeyDown={handleEditKeyDown}
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
                                                                onFocus={(e) => e.target.select()}
                                                                onKeyDown={handleEditKeyDown}
                                                                className="w-full border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                            />
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={editForm.unit_price || 0}
                                                                onChange={e => setEditForm({ ...editForm, unit_price: parseFloat(e.target.value) })}
                                                                onFocus={(e) => e.target.select()}
                                                                onKeyDown={handleEditKeyDown}
                                                                className="w-full border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                            />
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                value={editForm.storage_stock ?? 0}
                                                                onChange={e => setEditForm({ ...editForm, storage_stock: parseInt(e.target.value) || 0 })}
                                                                onFocus={(e) => e.target.select()}
                                                                onKeyDown={handleEditKeyDown}
                                                                className="w-full border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                            />
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                value={editForm.storage_reorder_point ?? 0}
                                                                onChange={e => setEditForm({ ...editForm, storage_reorder_point: parseInt(e.target.value) || 0 })}
                                                                onFocus={(e) => e.target.select()}
                                                                onKeyDown={handleEditKeyDown}
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
                                                        <td className="px-6 py-3 text-slate-600">
                                                            <div className="flex items-center gap-2">
                                                                <span>{prod.storage_stock ?? 0}</span>
                                                                {(prod.storage_stock ?? 0) < (prod.storage_reorder_point ?? 0) && (
                                                                    <span className="text-xs text-red-600 font-medium">Low</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-3 text-slate-600">{prod.storage_reorder_point ?? 0}</td>
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
                                                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
                                            <tr 
                                                key={cat.id} 
                                                className="hover:bg-slate-50 transition-colors cursor-pointer"
                                                onDoubleClick={() => {
                                                    if (editingCategoryId !== cat.id) {
                                                        startEditCategory(cat);
                                                    }
                                                }}
                                            >
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
                                                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Storage Stock</label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={formData.storage_stock}
                                            onChange={e => setFormData({ ...formData, storage_stock: parseInt(e.target.value) || 0 })}
                                            className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Reorder Point</label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={formData.storage_reorder_point}
                                            onChange={e => setFormData({ ...formData, storage_reorder_point: parseInt(e.target.value) || 0 })}
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
                                    onClick={() => { 
                                        if (showTemplateInlineAddForm) {
                                            // Cancel add mode
                                            setShowTemplateInlineAddForm(false);
                                            setTemplateItemForm({ default_par_level: 1 });
                                            setTemplateProductSearch('');
                                            setShowTemplateProductDropdown(false);
                                        } else {
                                            // Show add form
                                            setShowTemplateInlineAddForm(true);
                                            setTemplateItemForm({ default_par_level: 1 });
                                            setTemplateProductSearch('');
                                            setShowTemplateProductDropdown(false);
                                        }
                                    }}
                                    className="text-sm bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg hover:bg-emerald-100 font-medium transition-colors"
                                >
                                    {showTemplateInlineAddForm ? 'Cancel' : '+ Add Product'}
                                </button>
                            </div>
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-600 border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">Product</th>
                                        <th className="px-6 py-3 font-medium">Size/Unit</th>
                                        <th className="px-6 py-3 font-medium">Default Par Level</th>
                                        <th className="px-6 py-3 font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {/* Inline Add Form */}
                                    {showTemplateInlineAddForm && (
                                        <tr className="bg-emerald-50/50">
                                            <td className="px-6 py-3" colSpan={4}>
                                                <div className="flex items-center gap-4">
                                                    <div className="flex-1 relative" ref={templateProductDropdownRef}>
                                                        <div className="relative">
                                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                            <input
                                                                type="text"
                                                                value={templateProductSearch}
                                                                onChange={(e) => {
                                                                    setTemplateProductSearch(e.target.value);
                                                                    setShowTemplateProductDropdown(true);
                                                                    if (!e.target.value) {
                                                                        setTemplateItemForm(prev => ({ ...prev, product_id: undefined }));
                                                                    }
                                                                }}
                                                                onFocus={() => setShowTemplateProductDropdown(true)}
                                                                placeholder="Type to search products..."
                                                                className="w-full border rounded-lg pl-10 pr-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                                                                autoFocus
                                                            />
                                                            {templateItemForm.product_id && (
                                                                <button
                                                                    onClick={() => {
                                                                        setTemplateProductSearch('');
                                                                        setTemplateItemForm(prev => ({ ...prev, product_id: undefined }));
                                                                    }}
                                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                                >
                                                                    <X className="h-4 w-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                        {showTemplateProductDropdown && templateProductSearch.trim() && filteredTemplateProducts.length > 0 && (
                                                            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                                                {filteredTemplateProducts.map(product => (
                                                                    <button
                                                                        key={product.id}
                                                                        onClick={() => handleTemplateProductSelect(product)}
                                                                        className="w-full text-left px-4 py-2 hover:bg-emerald-50 transition-colors border-b border-slate-100 last:border-b-0"
                                                                    >
                                                                        <div className="font-medium text-slate-900">{product.name}</div>
                                                                        <div className="text-xs text-slate-500">
                                                                            {product.unit_size || 'N/A'} {product.category ? `• ${product.category}` : ''}
                                                                        </div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {showTemplateProductDropdown && templateProductSearch.trim() && filteredTemplateProducts.length === 0 && (
                                                            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-4 text-center text-slate-500 text-sm">
                                                                No products found matching "{templateProductSearch}"
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="w-32">
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={templateItemForm.default_par_level}
                                                            onChange={e => {
                                                                const val = parseInt(e.target.value) || 1;
                                                                setTemplateItemForm({ ...templateItemForm, default_par_level: val < 1 ? 1 : val });
                                                            }}
                                                            placeholder="Par Level"
                                                            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={async () => {
                                                                if (templateItemForm.product_id) {
                                                                    await handleAddTemplateItem();
                                                                    setShowTemplateInlineAddForm(false);
                                                                }
                                                            }}
                                                            disabled={!templateItemForm.product_id}
                                                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                                        >
                                                            <Save className="h-4 w-4" />
                                                            Add
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setShowTemplateInlineAddForm(false);
                                                                setTemplateItemForm({ default_par_level: 1 });
                                                                setTemplateProductSearch('');
                                                                setShowTemplateProductDropdown(false);
                                                            }}
                                                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    {templateItems.length === 0 && !showTemplateInlineAddForm ? (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-slate-500">
                                                No items in this template yet. Add products to get started.
                                            </td>
                                        </tr>
                                    ) : (
                                        templateItems.map((item, index) => (
                                            <tr key={item.id ?? `template-item-${item.template_id}-${item.product_id}-${index}`} className="hover:bg-slate-50">
                                                <td className="px-6 py-3 font-medium text-slate-800">{item.product?.name}</td>
                                                <td className="px-6 py-3 text-slate-500">{item.product?.unit_size || '-'}</td>
                                                <td className="px-6 py-3">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={item.default_par_level}
                                                        onChange={(e) => handleUpdateTemplateItemPar(item.id, parseInt(e.target.value) || 1)}
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

                {/* CSV Upload Modal */}
                {showCsvModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl p-6 max-h-[90vh] overflow-y-auto">
                            <h2 className="text-xl font-bold mb-4 text-slate-900">Upload Products from CSV</h2>
                            
                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Select CSV File
                                    </label>
                                    <input
                                        type="file"
                                        accept=".csv"
                                        onChange={handleCsvFileChange}
                                        className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                        disabled={csvUploading}
                                    />
                                </div>

                                <div className="bg-slate-50 p-4 rounded-lg text-sm">
                                    <p className="font-medium text-slate-700 mb-2">CSV Format:</p>
                                    <p className="text-slate-600 mb-2">
                                        Your CSV should have the following columns (header row required):
                                    </p>
                                    <ul className="list-disc list-inside text-slate-600 space-y-1">
                                        <li><strong>name</strong> (required) - Product name</li>
                                        <li><strong>price</strong> or <strong>unit_price</strong> (optional, default: 0) - Unit price</li>
                                        <li><strong>unit_size</strong> or <strong>size</strong> or <strong>unit</strong> (optional) - Size/unit description</li>
                                        <li><strong>category</strong> (optional) - Category name or ID</li>
                                        <li><strong>requires_approval</strong> (optional, default: false) - true/false or 1/0</li>
                                    </ul>
                                    <p className="text-slate-500 mt-3 text-xs">
                                        Example: name,price,unit_size,category,requires_approval
                                    </p>
                                </div>

                                {csvResults && (
                                    <div className={`p-4 rounded-lg ${csvResults.new > 0 || csvResults.updated > 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                                        {(csvResults.new > 0 || csvResults.updated > 0) && (
                                            <div className="mb-3">
                                                <p className="font-medium text-emerald-800 mb-2">
                                                    Import Summary:
                                                </p>
                                                <div className="space-y-1 text-sm text-emerald-700">
                                                    {csvResults.new > 0 && (
                                                        <p>✓ {csvResults.new} new product(s) created</p>
                                                    )}
                                                    {csvResults.updated > 0 && (
                                                        <p>✓ {csvResults.updated} product(s) updated</p>
                                                    )}
                                                </div>
                                                {csvResults.updatedProducts.length > 0 && (
                                                    <div className="mt-3">
                                                        <p className="text-sm font-medium text-emerald-700 mb-1">Updated Products:</p>
                                                        <ul className="list-disc list-inside text-sm text-emerald-600 space-y-1 max-h-32 overflow-y-auto bg-white/50 rounded p-2">
                                                            {csvResults.updatedProducts.map((name, idx) => (
                                                                <li key={idx}>{name}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {csvResults.errors.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-red-200">
                                                <p className="text-sm font-medium text-red-700 mb-1">Errors:</p>
                                                <ul className="list-disc list-inside text-sm text-red-600 space-y-1 max-h-32 overflow-y-auto">
                                                    {csvResults.errors.map((error, idx) => (
                                                        <li key={idx}>{error}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {csvResults.new === 0 && csvResults.updated === 0 && csvResults.errors.length === 0 && (
                                            <p className="text-red-800">No products were processed.</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={resetCsvUpload}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                                    disabled={csvUploading}
                                >
                                    {csvResults ? 'Close' : 'Cancel'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCsvUpload}
                                    disabled={!csvFile || csvUploading}
                                    className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {csvUploading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Uploading...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="h-4 w-4" />
                                            Upload
                                        </>
                                    )}
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
                                <div className="relative" ref={templateProductDropdownRef}>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Product</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <input
                                            type="text"
                                            value={templateProductSearch}
                                            onChange={(e) => {
                                                setTemplateProductSearch(e.target.value);
                                                setShowTemplateProductDropdown(true);
                                                if (!e.target.value) {
                                                    setTemplateItemForm(prev => ({ ...prev, product_id: undefined }));
                                                }
                                            }}
                                            onFocus={() => setShowTemplateProductDropdown(true)}
                                            placeholder="Type to search products..."
                                            className="w-full border rounded-lg pl-10 pr-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                                        />
                                        {templateItemForm.product_id && (
                                            <button
                                                onClick={() => {
                                                    setTemplateProductSearch('');
                                                    setTemplateItemForm(prev => ({ ...prev, product_id: undefined }));
                                                }}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                    {showTemplateProductDropdown && templateProductSearch.trim() && filteredTemplateProducts.length > 0 && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                            {filteredTemplateProducts.map(product => (
                                                <button
                                                    key={product.id}
                                                    onClick={() => handleTemplateProductSelect(product)}
                                                    className="w-full text-left px-4 py-2 hover:bg-emerald-50 transition-colors border-b border-slate-100 last:border-b-0"
                                                >
                                                    <div className="font-medium text-slate-900">{product.name}</div>
                                                    <div className="text-xs text-slate-500">
                                                        {product.unit_size || 'N/A'} {product.category ? `• ${product.category}` : ''}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {showTemplateProductDropdown && templateProductSearch.trim() && filteredTemplateProducts.length === 0 && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-4 text-center text-slate-500 text-sm">
                                            No products found matching "{templateProductSearch}"
                                        </div>
                                    )}
                                    {templateItemForm.product_id && (
                                        <div className="mt-2 text-sm text-emerald-600">
                                            Selected: {productsForTemplate.find(p => p.id === templateItemForm.product_id)?.name}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Default Par Level</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={templateItemForm.default_par_level}
                                        onChange={e => {
                                            const val = parseInt(e.target.value) || 1;
                                            setTemplateItemForm({ ...templateItemForm, default_par_level: val < 1 ? 1 : val });
                                        }}
                                        className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="p-6 bg-slate-50 flex justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setShowTemplateItemModal(false);
                                        setTemplateProductSearch('');
                                        setShowTemplateProductDropdown(false);
                                    }}
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
