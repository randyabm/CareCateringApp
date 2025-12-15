import AdminLayout from '@/components/admin/AdminLayout';
import Link from 'next/link';
import { Settings, Users, ClipboardList, Database, FileText } from 'lucide-react';

export default function AdminPage() {
    return (
        <AdminLayout>
            <div className="max-w-7xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Hospital Administration</h1>
                    <p className="text-slate-500">Manage Master Data: Wards, Products, and Diet Codes.</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                    <Link href="/admin/locations" className="group">
                        <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-emerald-500/50 transition-all cursor-pointer">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                                    <Settings className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800">Locations / Wards</h3>
                            </div>
                            <p className="text-sm text-slate-500">Configure wards, staff assignment, and approvers.</p>
                        </div>
                    </Link>

                    <Link href="/admin/products" className="group">
                        <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-emerald-500/50 transition-all cursor-pointer">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 rounded-lg bg-purple-50 text-purple-600 group-hover:bg-purple-100 transition-colors">
                                    <Database className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800">Products Catalog</h3>
                            </div>
                            <p className="text-sm text-slate-500">Manage item details, pricing, and approval flags.</p>
                        </div>
                    </Link>

                    <Link href="/admin/diets" className="group">
                        <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-emerald-500/50 transition-all cursor-pointer">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 rounded-lg bg-orange-50 text-orange-600 group-hover:bg-orange-100 transition-colors">
                                    <ClipboardList className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800">Diet Codes</h3>
                            </div>
                            <p className="text-sm text-slate-500">Define primary diets, allergies, and dislikes.</p>
                        </div>
                    </Link>

                    <Link href="/admin/users" className="group">
                        <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-emerald-500/50 transition-all cursor-pointer">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
                                    <Users className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800">User Management</h3>
                            </div>
                            <p className="text-sm text-slate-500">Manage hospital staff roles and access.</p>
                        </div>
                    </Link>

                    <Link href="/admin/reportes" className="group">
                        <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-emerald-500/50 transition-all cursor-pointer">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 rounded-lg bg-teal-50 text-teal-600 group-hover:bg-teal-100 transition-colors">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800">Reports</h3>
                            </div>
                            <p className="text-sm text-slate-500">KPIs and exports for stock, movements, and orders.</p>
                        </div>
                    </Link>

                </div>
            </div>
        </AdminLayout>
    );
}
