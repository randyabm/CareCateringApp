'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, MapPin, Package, Users, LogOut, Settings, FileText, Megaphone, UtensilsCrossed } from 'lucide-react';

const navigation = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Locations', href: '/admin/locations', icon: MapPin },
    { name: 'Products', href: '/admin/products', icon: Package },
    { name: 'Catering', href: '/admin/catering', icon: UtensilsCrossed },
    { name: 'Announcements', href: '/admin/announcements', icon: Megaphone },
    { name: 'Reports', href: '/admin/reportes', icon: FileText },
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
];

export default function AdminSidebar() {
    const pathname = usePathname();

    return (
        <div className="flex h-full w-full flex-col bg-slate-900 text-white">
            <div className="flex h-16 items-center px-6">
                <h1 className="text-xl font-bold tracking-tight text-emerald-400">CareCatering</h1>
            </div>
            <div className="flex-1 overflow-y-auto py-4">
                <nav className="space-y-1 px-3">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                <item.icon className={`mr-3 h-5 w-5 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
            </div>
            <div className="border-t border-slate-800 p-4">
                <button className="flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-white">
                    <LogOut className="mr-3 h-5 w-5" />
                    Sign Out
                </button>
            </div>
        </div>
    );
}
