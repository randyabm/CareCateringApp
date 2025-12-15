'use client';

import AdminLayout from '@/components/admin/AdminLayout';
import Link from 'next/link';
import { BarChart3, Boxes, ClipboardList, MoveRight, Activity } from 'lucide-react';

export default function ReportesPage() {
    const cards = [
        {
            title: 'Stock by Location',
            description: 'On-hand, par levels, and reorder points per warehouse/ward.',
            href: '/admin/reportes/stock',
            icon: Boxes,
            color: 'bg-emerald-50 text-emerald-600',
        },
        {
            title: 'Stock Movements',
            description: 'Orders and adjustments by date, user, and product.',
            href: '/admin/reportes/movimientos',
            icon: Activity,
            color: 'bg-amber-50 text-amber-600',
        },
        {
            title: 'Orders / Sales',
            description: 'Orders by date, location, and category with totals.',
            href: '/admin/reportes/pedidos',
            icon: BarChart3,
            color: 'bg-blue-50 text-blue-600',
        },
    ];

    return (
        <AdminLayout>
            <div className="max-w-7xl mx-auto">
                <header className="mb-8">
                    <div className="flex items-center gap-3">
                        <ClipboardList className="h-8 w-8 text-emerald-600" />
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900">Reportes</h1>
                            <p className="text-slate-500">KPIs operativos con filtros y exportación.</p>
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {cards.map(({ title, description, href, icon: Icon, color }) => (
                        <Link key={href} href={href} className="group">
                            <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-emerald-500/50 transition-all cursor-pointer h-full flex flex-col justify-between">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className={`p-3 rounded-lg ${color} group-hover:opacity-80 transition-colors`}>
                                        <Icon className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
                                </div>
                                <p className="text-sm text-slate-500 flex-1">{description}</p>
                                <div className="mt-6 inline-flex items-center text-emerald-600 text-sm font-medium group-hover:translate-x-1 transition-transform">
                            View report <MoveRight className="ml-2 h-4 w-4" />
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </AdminLayout>
    );
}

