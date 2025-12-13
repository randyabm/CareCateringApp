export default function WardPage() {
    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-background to-secondary dark:from-background dark:to-cyan-950/20 text-foreground p-8">
            <div className="max-w-7xl mx-auto">
                <header className="mb-12">
                    <h1 className="text-4xl font-bold text-primary mb-2">Ward Ordering</h1>
                    <p className="text-muted-foreground">Manage patient catering and ward consumables.</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Placeholder content */}
                    <div className="glass-panel p-6 rounded-xl h-64 flex items-center justify-center text-muted-foreground border-dashed border-2 border-border">
                        Patient List / Bed Management Module Loading...
                    </div>
                    <div className="glass-panel p-6 rounded-xl h-64 flex items-center justify-center text-muted-foreground border-dashed border-2 border-border">
                        Dietary Requirement Checks Loading...
                    </div>
                    <div className="glass-panel p-6 rounded-xl h-64 flex items-center justify-center text-muted-foreground border-dashed border-2 border-border">
                        Shopping Cart / Order Summary Loading...
                    </div>
                </div>
            </div>
        </div>
    );
}
