'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import type { Database } from '@/types/database.types';

type Location = Database['public']['Tables']['locations']['Row'];
type LocationGroup = Database['public']['Tables']['location_groups']['Row'];

type OptionValue = 'all' | 'unassigned' | `group:${number}` | `location:${number}`;

type LocationTreeSelectProps = {
    groups: LocationGroup[];
    locations: Location[];
    value: OptionValue;
    onChange: (v: OptionValue) => void;
    label?: string;
};

type TreeNode = LocationGroup & { children: TreeNode[]; locations: Location[] };

export function LocationTreeSelect({ groups, locations, value, onChange, label = 'Location' }: LocationTreeSelectProps) {
    const [open, setOpen] = useState(false);
    const [expanded, setExpanded] = useState<Set<number>>(new Set()); // start collapsed

    const tree = useMemo(() => buildTree(groups, locations), [groups, locations]);
    const counts = useMemo(() => computeDescendantCounts(tree), [tree]);

    const toggleExpanded = (id: number) => {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const renderNode = (node: TreeNode, depth: number) => {
        const isOpen = expanded.has(node.id);
        return (
            <div key={`group-${node.id}`} className="py-1">
                <div
                    className="flex items-center gap-2 w-full text-left text-sm text-slate-800 hover:bg-slate-50 px-2 py-1 rounded cursor-pointer"
                    style={{ paddingLeft: depth * 12 + 8 }}
                >
                    <button
                        type="button"
                        onClick={() => toggleExpanded(node.id)}
                        className="p-0.5 rounded hover:bg-slate-100"
                    >
                        {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            onChange(`group:${node.id}`);
                            setOpen(false);
                        }}
                        className={`flex-1 text-left font-medium ${value === `group:${node.id}` ? 'text-emerald-700' : ''}`}
                    >
                        {node.name} {counts[node.id] !== undefined ? `(${counts[node.id]})` : ''}
                    </button>
                </div>
                <div className="pl-4 border-l border-slate-200 ml-4">
                    <div className="flex flex-col">
                        {isOpen && (
                            <>
                                {node.locations.map(loc => (
                                    <button
                                        key={`loc-${loc.id}`}
                                        type="button"
                                        onClick={() => {
                                            onChange(`location:${loc.id}`);
                                            setOpen(false);
                                        }}
                                        className={`flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-emerald-50 ${
                                            value === `location:${loc.id}` ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-slate-700'
                                        }`}
                                        style={{ paddingLeft: depth * 12 + 24 }}
                                    >
                                        <MapPin className="h-4 w-4 text-slate-400" />
                                        {loc.name}
                                    </button>
                                ))}
                                {node.children.map(child => renderNode(child, depth + 1))}
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const selectedLabel = useMemo(() => {
        if (value === 'all') return 'All groups';
        if (value === 'unassigned') return 'Unassigned';
        if (value.startsWith('group:')) {
            const id = Number(value.split(':')[1]);
            const g = groups.find(gr => gr.id === id);
            return g ? `${g.name} (group)` : 'Group';
        }
        if (value.startsWith('location:')) {
            const id = Number(value.split(':')[1]);
            const loc = locations.find(l => l.id === id);
            return loc ? loc.name : 'Location';
        }
        return 'Select';
    }, [value, groups, locations]);

    return (
        <div className="relative">
            <label className="text-xs text-slate-500 mb-1 block">{label}</label>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 flex items-center justify-between hover:border-emerald-500"
            >
                <span className="truncate">{selectedLabel}</span>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="absolute z-20 mt-1 w-72 max-h-80 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg p-2">
                    <div className="flex flex-col gap-1">
                        <button
                            type="button"
                            onClick={() => {
                                onChange('all');
                                setOpen(false);
                            }}
                            className={`text-sm px-2 py-1 rounded hover:bg-emerald-50 text-left ${
                                value === 'all' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-slate-700'
                            }`}
                        >
                            All groups
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                onChange('unassigned');
                                setOpen(false);
                            }}
                            className={`text-sm px-2 py-1 rounded hover:bg-emerald-50 text-left ${
                                value === 'unassigned' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-slate-700'
                            }`}
                        >
                            Unassigned
                        </button>
                        <div className="border-t border-slate-200 my-1" />
                        {tree.map(node => renderNode(node, 0))}
                    </div>
                </div>
            )}
        </div>
    );
}

function buildTree(groups: LocationGroup[], locations: Location[]): TreeNode[] {
    const groupMap = new Map<number, TreeNode>();
    groups.forEach(g => groupMap.set(g.id, { ...g, children: [], locations: [] }));

    groups.forEach(g => {
        if (g.parent_group_id && groupMap.has(g.parent_group_id)) {
            groupMap.get(g.parent_group_id)!.children.push(groupMap.get(g.id)!);
        }
    });

    locations.forEach(loc => {
        if (loc.group_id && groupMap.has(loc.group_id)) {
            groupMap.get(loc.group_id)!.locations.push(loc);
        }
    });

    const roots: TreeNode[] = [];
    groups.forEach(g => {
        if (!g.parent_group_id) {
            roots.push(groupMap.get(g.id)!);
        }
    });

    return roots;
}

function computeDescendantCounts(tree: TreeNode[]): Record<number, number> {
    const counts: Record<number, number> = {};
    const dfs = (node: TreeNode): number => {
        let total = node.locations.length;
        node.children.forEach(child => {
            total += dfs(child);
        });
        counts[node.id] = total;
        return total;
    };
    tree.forEach(root => dfs(root));
    return counts;
}

export type LocationTreeValue = OptionValue;

