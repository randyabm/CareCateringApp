export default function KitchenPage() {
    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-background to-secondary dark:from-background dark:to-cyan-950/20 text-foreground p-8">
            <div className="max-w-7xl mx-auto">
                <header className="mb-12">
                    <h1 className="text-4xl font-bold text-primary mb-2">Kitchen Dispatch</h1>
                    <p className="text-muted-foreground">Monitor incoming orders and manage food preparation workflow.</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="glass-panel p-6 rounded-xl h-96 flex items-center justify-center text-muted-foreground border-dashed border-2 border-border">
                        Live Order Feed (Real-time) Loading...
                    </div>
                    <div className="glass-panel p-6 rounded-xl h-96 flex items-center justify-center text-muted-foreground border-dashed border-2 border-border">
                        Delivery Routing / Logistics View Loading...
                    </div>
                </div>
            </div>
        </div>
    );
}
