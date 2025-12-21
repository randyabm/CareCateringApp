'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, MapPin, Pin, StickyNote, Trash2, X } from 'lucide-react';
import { createNote, deleteNote, listNotes, NoteRow, togglePinned, toggleResolved } from '@/lib/notes';

type NotesContextValue = {
    openDrawer: (options?: { locationId?: number | null; locationName?: string | null }) => void;
    closeDrawer: () => void;
    setLocationContext: (locationId: number | null) => void;
    locationId: number | null;
    locationName: string | null;
};

const NotesContext = createContext<NotesContextValue | null>(null);

export function useNotes() {
    const ctx = useContext(NotesContext);
    if (!ctx) throw new Error('useNotes must be used within NotesProvider');
    return ctx;
}

export function NotesProvider({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [locationId, setLocationId] = useState<number | null>(null);
    const [notes, setNotes] = useState<NoteRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [locationName, setLocationName] = useState<string | null>(null);

    const fetchNotes = useCallback(
        async (locId: number | null = locationId) => {
            setLoading(true);
            const { data, error } = await listNotes({ locationId: locId ?? undefined, includeGeneral: true });
            if (!error && data) {
                setNotes(data);
            }
            setLoading(false);
        },
        [locationId]
    );

    const openDrawer = useCallback(
        (options?: { locationId?: number | null; locationName?: string | null }) => {
            const loc = options?.locationId ?? null;
            const locName = options?.locationName ?? null;
            if (options && 'locationId' in options) {
                setLocationId(loc);
            }
            if (options && 'locationName' in options) {
                setLocationName(locName);
            }
            setIsOpen(true);
            fetchNotes(options?.locationId ?? locationId);
        },
        [fetchNotes, locationId]
    );

    const closeDrawer = useCallback(() => setIsOpen(false), []);

    const handleCreate = useCallback(
        async (input: { message: string; color?: string | null; pinned?: boolean; resolved?: boolean; expiresAt?: string | null; scope: 'general' | 'location' }) => {
            const scopeLocationId = input.scope === 'location' ? locationId : null;
            const { error } = await createNote({
                message: input.message,
                locationId: scopeLocationId,
                color: input.color ?? null,
                pinned: input.pinned ?? false,
                expiresAt: input.expiresAt ?? null,
            });
            if (!error) {
                fetchNotes(locationId);
            }
            return { error };
        },
        [fetchNotes, locationId]
    );

    const handleTogglePinned = useCallback(
        async (id: number, pinned: boolean) => {
            await togglePinned(id, pinned);
            fetchNotes(locationId);
        },
        [fetchNotes, locationId]
    );

    const handleToggleResolved = useCallback(
        async (id: number, resolved: boolean) => {
            await toggleResolved(id, resolved);
            fetchNotes(locationId);
        },
        [fetchNotes, locationId]
    );

    const handleDelete = useCallback(
        async (id: number) => {
            await deleteNote(id);
            fetchNotes(locationId);
        },
        [fetchNotes, locationId]
    );

    const value = useMemo<NotesContextValue>(
        () => ({
            openDrawer,
            closeDrawer,
            setLocationContext: setLocationId,
            locationId,
            locationName,
        }),
        [openDrawer, closeDrawer, locationId, locationName]
    );

    return (
        <NotesContext.Provider value={value}>
            {children}
            <NotesDrawer
                isOpen={isOpen}
                onClose={closeDrawer}
                notes={notes}
                loading={loading}
                onCreate={handleCreate}
                onTogglePinned={handleTogglePinned}
                onToggleResolved={handleToggleResolved}
                onDelete={handleDelete}
                onRefresh={() => fetchNotes(locationId)}
                locationId={locationId}
                locationName={locationName}
            />
        </NotesContext.Provider>
    );
}

type NotesDrawerProps = {
    isOpen: boolean;
    onClose: () => void;
    notes: NoteRow[];
    loading: boolean;
    locationId: number | null;
    locationName: string | null;
    onCreate: (input: { message: string; color?: string | null; pinned?: boolean; resolved?: boolean; expiresAt?: string | null; scope: 'general' | 'location' }) => Promise<{ error: any }>;
    onTogglePinned: (id: number, pinned: boolean) => Promise<void>;
    onToggleResolved: (id: number, resolved: boolean) => Promise<void>;
    onDelete: (id: number) => Promise<void>;
    onRefresh: () => Promise<void>;
};

function NotesDrawer({
    isOpen,
    onClose,
    notes,
    loading,
    onCreate,
    onTogglePinned,
    onToggleResolved,
    onDelete,
    onRefresh,
    locationId,
    locationName,
}: NotesDrawerProps) {
    const [message, setMessage] = useState('');
    const [color, setColor] = useState<string>('yellow');
    const [pinned, setPinned] = useState(false);
    const [resolved, setResolved] = useState(false);
    const [expiresAt, setExpiresAt] = useState<string>('');
    const [scope, setScope] = useState<'general' | 'location'>(locationId ? 'location' : 'general');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        setScope(locationId ? 'location' : 'general');
    }, [locationId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) return;
        setSubmitting(true);
        await onCreate({
            message: message.trim(),
            color,
            pinned,
            resolved,
            expiresAt: expiresAt || null,
            scope,
        });
        setMessage('');
        setPinned(false);
        setResolved(false);
        setExpiresAt('');
        setSubmitting(false);
    };

    const pinnedNotes = notes.filter((n) => n.pinned && !n.resolved);
    const activeNotes = notes.filter((n) => !n.pinned && !n.resolved);
    const resolvedNotes = notes.filter((n) => n.resolved);

    const Section = ({
        title,
        items,
        emptyLabel,
    }: {
        title: string;
        items: NoteRow[];
        emptyLabel: string;
    }) => (
        <div>
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">{title}</div>
            <div className="space-y-2">
                {items.length === 0 ? (
                    <p className="text-sm text-slate-400">{emptyLabel}</p>
                ) : (
                    items.map(note => (
                        <NoteCard
                            key={note.id}
                            note={note}
                            onTogglePinned={onTogglePinned}
                            onToggleResolved={onToggleResolved}
                            onDelete={onDelete}
                            locationName={locationName}
                        />
                    ))
                )}
            </div>
        </div>
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-40 flex">
            <div className="flex-1 bg-slate-900/50" onClick={onClose} aria-hidden />
            <div className="w-full max-w-md bg-white shadow-2xl border-l border-slate-200 h-full flex flex-col">
                <header className="flex items-center justify-between px-4 py-3 border-b">
                    <div className="flex items-center gap-2">
                        <StickyNote className="h-5 w-5 text-amber-500" />
                        <div>
                            <div className="text-sm font-semibold text-slate-800">Notes</div>
                            <div className="text-xs text-slate-500">{locationId ? 'This location + general' : 'General notes'}</div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded hover:bg-slate-100">
                        <X className="h-4 w-4 text-slate-500" />
                    </button>
                </header>

                <div className="p-4 border-b">
                    <form className="space-y-3" onSubmit={handleSubmit}>
                        <div className="flex items-center gap-3 text-sm text-slate-700">
                            <label className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    className="accent-emerald-600"
                                    checked={scope === 'general'}
                                    onChange={() => setScope('general')}
                                />
                                General
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    className="accent-emerald-600"
                                    checked={scope === 'location'}
                                    onChange={() => setScope('location')}
                                    disabled={!locationId}
                                />
                                Location {locationName ?? (locationId ? `#${locationId}` : '(select a location)')}
                            </label>
                        </div>

                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            placeholder="Add a note..."
                            rows={3}
                        />

                        <div className="grid grid-cols-2 gap-3 text-sm text-slate-700">
                            <label className="flex flex-col gap-1">
                                <span className="text-xs text-slate-500">Color</span>
                                <select
                                    value={color}
                                    onChange={(e) => setColor(e.target.value)}
                                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                >
                                    <option value="yellow">Yellow</option>
                                    <option value="blue">Blue</option>
                                    <option value="green">Green</option>
                                    <option value="purple">Purple</option>
                                    <option value="red">Red</option>
                                </select>
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="text-xs text-slate-500">Expires</span>
                                <input
                                    type="date"
                                    value={expiresAt}
                                    onChange={(e) => setExpiresAt(e.target.value)}
                                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                />
                            </label>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-slate-700">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={pinned}
                                    onChange={(e) => setPinned(e.target.checked)}
                                    className="accent-emerald-600"
                                />
                                Pin
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={resolved}
                                    onChange={(e) => setResolved(e.target.checked)}
                                    className="accent-emerald-600"
                                />
                                Mark as resolved
                            </label>
                        </div>

                        <div className="flex justify-between items-center">
                            <button
                                type="button"
                                onClick={() => onRefresh()}
                                className="text-sm text-emerald-600 hover:text-emerald-700"
                            >
                                Refresh
                            </button>
                            <button
                                type="submit"
                                disabled={submitting || !message.trim()}
                                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <StickyNote className="h-4 w-4" />}
                                Add note
                            </button>
                        </div>
                    </form>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-5">
                    {loading ? (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading notes...
                        </div>
                    ) : (
                        <>
                            <Section title="Pinned" items={pinnedNotes} emptyLabel="No pinned notes." />
                            <Section title="Active" items={activeNotes} emptyLabel="No active notes." />
                            <Section title="Resolved" items={resolvedNotes} emptyLabel="No resolved notes." />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function NoteCard({
    note,
    onTogglePinned,
    onToggleResolved,
    onDelete,
    locationName,
}: {
    note: NoteRow;
    onTogglePinned: (id: number, pinned: boolean) => Promise<void>;
    onToggleResolved: (id: number, resolved: boolean) => Promise<void>;
    onDelete: (id: number) => Promise<void>;
    locationName: string | null;
}) {
    const colorMap: Record<string, string> = {
        yellow: 'bg-amber-100 text-amber-800 border-amber-200',
        blue: 'bg-blue-100 text-blue-800 border-blue-200',
        green: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        purple: 'bg-purple-100 text-purple-800 border-purple-200',
        red: 'bg-red-100 text-red-800 border-red-200',
    };

    const badgeClass = colorMap[note.color ?? 'yellow'] ?? 'bg-amber-100 text-amber-800 border-amber-200';

    const formattedDate = (dateString?: string | null) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString();
    };

    return (
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClass}`}>
                            <StickyNote className="h-3 w-3" />
                            {note.color ?? 'note'}
                        </span>
                        {note.location_id && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                                <MapPin className="h-3 w-3" />
                                {locationName ?? `Location #${note.location_id}`}
                            </span>
                        )}
                        {note.resolved && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 text-xs font-medium">
                                <CheckCircle2 className="h-3 w-3" />
                                Resolved
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-slate-800">{note.message}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span>Created {formattedDate(note.created_at)}</span>
                        {note.expires_at && <span>Expires {formattedDate(note.expires_at)}</span>}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onTogglePinned(note.id, !note.pinned)}
                        className={`p-2 rounded-lg border ${note.pinned ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                        title={note.pinned ? 'Unpin' : 'Pin'}
                    >
                        <Pin className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => onToggleResolved(note.id, !note.resolved)}
                        className={`p-2 rounded-lg border ${note.resolved ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                        title={note.resolved ? 'Mark active' : 'Mark resolved'}
                    >
                        <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => onDelete(note.id)}
                        className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600"
                        title="Delete"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

