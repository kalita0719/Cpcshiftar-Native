import { createContext, useContext, useState } from "react";
import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatePresence, motion } from "framer-motion";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Schedule from "@/pages/Schedule";
import OvertimePay from "@/pages/OvertimePay";
import { LayoutDashboard, Calendar, Clock, Receipt } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
});

type ShiftPanelContextType = {
  shiftPanelOpen: boolean;
  openShiftPanel: () => void;
  closeShiftPanel: () => void;
  toggleShiftPanel: () => void;
};

export const ShiftPanelContext = createContext<ShiftPanelContextType>({
  shiftPanelOpen: false,
  openShiftPanel: () => {},
  closeShiftPanel: () => {},
  toggleShiftPanel: () => {},
});

export function useShiftPanel() {
  return useContext(ShiftPanelContext);
}

const NAV_ITEMS = [
  { to: "/", label: "首頁", icon: LayoutDashboard },
  { to: "/schedule", label: "行事曆", icon: Calendar },
  { to: "/overtime-pay", label: "加班費", icon: Receipt },
];

function Nav() {
  const [location, navigate] = useLocation();
  const { shiftPanelOpen, openShiftPanel, closeShiftPanel } = useShiftPanel();

  const handleShiftButton = () => {
    if (location !== "/schedule") navigate("/schedule");
    if (shiftPanelOpen) {
      closeShiftPanel();
    } else {
      openShiftPanel();
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-card-border shadow-lg md:static md:border-t-0 md:border-r md:shadow-none md:flex md:flex-col md:w-56 md:min-h-screen md:py-8 md:px-3">
      <div className="hidden md:flex items-center gap-2 px-4 mb-8">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <Clock className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="font-semibold text-lg text-foreground">輪班助手</span>
      </div>
      <ul className="flex md:flex-col justify-around md:justify-start md:gap-1 p-2 md:p-0">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const active = location === to || (to !== "/" && location.startsWith(to));
          return (
            <li key={to} className="flex-1 md:flex-none">
              <Link
                to={to}
                className={`flex flex-col md:flex-row items-center gap-1 md:gap-3 px-3 py-2 md:py-2.5 rounded-xl transition-all duration-200 text-xs md:text-sm font-medium ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="w-5 h-5 md:w-4 md:h-4" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex-1 md:flex-none">
          <button
            onClick={handleShiftButton}
            className={`w-full flex flex-col md:flex-row items-center gap-1 md:gap-3 px-3 py-2 md:py-2.5 rounded-xl transition-all duration-200 text-xs md:text-sm font-medium ${
              shiftPanelOpen
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Clock className="w-5 h-5 md:w-4 md:h-4" />
            <span>班次</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

function AppInner() {
  const [location] = useLocation();
  return (
    <>
      <div id="ad-container" className="fixed top-0 left-0 right-0 z-50 h-[50px] bg-card border-b border-card-border" />
      <div className="flex flex-col md:flex-row min-h-screen bg-background pt-[50px]">
        <Nav />
        <main className="flex-1 pb-20 md:pb-0 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="min-h-full"
            >
              <Switch>
                <Route path="/" component={Dashboard} />
                <Route path="/schedule" component={Schedule} />
                <Route path="/overtime-pay" component={OvertimePay} />
                <Route component={NotFound} />
              </Switch>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </>
  );
}

function App() {
  const [shiftPanelOpen, setShiftPanelOpen] = useState(false);
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ShiftPanelContext.Provider
          value={{
            shiftPanelOpen,
            openShiftPanel: () => setShiftPanelOpen(true),
            closeShiftPanel: () => setShiftPanelOpen(false),
            toggleShiftPanel: () => setShiftPanelOpen((v) => !v),
          }}
        >
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppInner />
          </WouterRouter>
          <Toaster />
        </ShiftPanelContext.Provider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
