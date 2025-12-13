import Link from "next/link";
import { BedDouble, UtensilsCrossed, PackageOpen } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-background to-secondary dark:from-background dark:to-cyan-950/20 text-foreground relative overflow-hidden">
      {/* Abstract Background Shapes */}
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

      <main className="container mx-auto px-6 py-12 md:py-24 relative z-10 flex flex-col items-center">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mb-16 space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="inline-flex items-center px-3 py-1 rounded-full border border-primary/20 bg-primary/10 text-primary text-sm font-medium mb-4">
            <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
            Box Hill Hospital System v2.0
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
            CareCatering<span className="text-primary">App</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
            Centralized logistics bridging the gap between <span className="text-foreground font-semibold">Wards</span>, <span className="text-foreground font-semibold">Kitchen</span>, and <span className="text-foreground font-semibold">Supply Chain</span>.
          </p>
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl">
          {/* Module 1: Ward Staff */}
          <Link href="/ward" className="group">
            <div className="glass-panel h-full p-8 rounded-2xl transition-all duration-300 group-hover:scale-[1.02] group-hover:border-primary/50 group-hover:shadow-2xl group-hover:shadow-primary/10 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10 flex flex-col h-full">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-6 group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                  <BedDouble className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold mb-2 group-hover:text-primary transition-colors">Ward Staff</h2>
                <p className="text-muted-foreground mb-6 flex-grow">
                  Order groceries and manage patient catering requirements with dietary safety checks.
                </p>
                <div className="flex items-center text-sm font-semibold text-primary">
                  Access Portal
                  <span className="ml-2 transform group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            </div>
          </Link>

          {/* Module 2: Kitchen / Dispatcher */}
          <Link href="/kitchen" className="group">
            <div className="glass-panel h-full p-8 rounded-2xl transition-all duration-300 group-hover:scale-[1.02] group-hover:border-primary/50 group-hover:shadow-2xl group-hover:shadow-primary/10 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10 flex flex-col h-full">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-6 group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                  <UtensilsCrossed className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold mb-2 group-hover:text-primary transition-colors">Kitchen & Dispatch</h2>
                <p className="text-muted-foreground mb-6 flex-grow">
                  Traffic control for incoming orders, diet restrictions, and delivery routing.
                </p>
                <div className="flex items-center text-sm font-semibold text-primary">
                  Manage Operations
                  <span className="ml-2 transform group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            </div>
          </Link>

          {/* Module 3: Store Man */}
          <Link href="/store" className="group">
            <div className="glass-panel h-full p-8 rounded-2xl transition-all duration-300 group-hover:scale-[1.02] group-hover:border-primary/50 group-hover:shadow-2xl group-hover:shadow-primary/10 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10 flex flex-col h-full">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-6 group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                  <PackageOpen className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold mb-2 group-hover:text-primary transition-colors">Store Logistics</h2>
                <p className="text-muted-foreground mb-6 flex-grow">
                  Gap analysis tracking, proactive restock alerts, and inventory auditing.
                </p>
                <div className="flex items-center text-sm font-semibold text-primary">
                  View Inventory
                  <span className="ml-2 transform group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Footer info */}
        <div className="mt-20 text-sm text-muted-foreground opacity-60">
          CareCateringApp &copy; 2025 Box Hill Hospital. Secure Clinical Environment.
        </div>
      </main>
    </div>
  );
}
