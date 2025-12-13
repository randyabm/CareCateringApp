'use client';

import { useState } from 'react';
import AdminSidebar from './Sidebar';
import { Menu } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setSidebarOpen] = useState(true);

    return (
        <div className="flex h-screen bg-slate-50">
            <div
                className={`transition-all duration-300 ease-in-out overflow-hidden ${isSidebarOpen ? 'w-64' : 'w-0'}`}
            >
                <div className="w-64 h-full"> {/* Inner container to maintain width during transition */}
                    <AdminSidebar />
                </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="flex h-16 items-center justify-between border-b bg-white px-6 shadow-sm">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSidebarOpen(!isSidebarOpen)}
                            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                            <Menu className="h-6 w-6" />
                        </button>
                        <h2 className="text-lg font-semibold text-slate-800">Hospital Logistics Console</h2>
                    </div>
                    <div className="flex items-center space-x-4">
                        <span className="text-sm text-slate-500">Admin User</span>
                        <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                            A
                        </div>
                    </div>
                </header>
                <main className="flex-1 overflow-y-auto p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
