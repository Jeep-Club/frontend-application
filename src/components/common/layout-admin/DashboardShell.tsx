'use client';

import { MembershipPageLoading, useRestrictedMembership, useRestrictedNavigation } from "./MembershipAccessGate";
import { useEffect, useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, CalendarRange, Newspaper, UserRound } from "lucide-react";
import Sidebar from "@/components/common/layout-admin/Sidebar";
import Topbar from "@/components/common/layout-admin/Topbar";
import GuidedTour from "@/components/common/tour/GuidedTour";
import { FirstAccessOnboarding } from "@/components/pages/first-access/Onboarding";
import { AdminUserIdContext } from "@/hooks/useAdminFavorites";
import { CurrentUserContext } from "@/contexts/CurrentUserContext";

const mobileTabs = [
    { href: "/feed", label: "Feed", icon: Newspaper },
    { href: "/agenda", label: "Agenda", icon: CalendarRange },
    { href: "/notificacoes", label: "Notificações", icon: BellRing },
    { href: "/profile", label: "Perfil", icon: UserRound },
] as const;

function MobileTabProgress() {
    const { pending } = useLinkStatus();

    return (
        <span
            aria-hidden="true"
            className={`absolute inset-x-3 bottom-0 h-0.5 origin-left rounded-full bg-j-yellow-300 transition-transform duration-200 motion-reduce:transition-none ${pending ? "scale-x-100" : "scale-x-0"}`}
        />
    );
}

interface DashboardShellProps {
    fullName: string;
    userId: string | number;
    initialProfilePhotoUrl?: string | null;
    onboardingRequired?: boolean;
    children: React.ReactNode;
}

export default function DashboardShell({ fullName, userId, initialProfilePhotoUrl, onboardingRequired = false, children }: DashboardShellProps) {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { restricted, blockNavigation } = useRestrictedNavigation();
    const { checkingPage } = useRestrictedMembership();
    const pathname = usePathname();
    const sidebarStorageKey = `dashboard-sidebar-collapsed:${userId}`;

    useEffect(() => {
        if (onboardingRequired && !restricted) return;

        const frame = requestAnimationFrame(() => {
            try {
                setIsSidebarCollapsed(localStorage.getItem(sidebarStorageKey) === "true");
            } catch {
                setIsSidebarCollapsed(false);
            }
        });
        return () => cancelAnimationFrame(frame);
    }, [onboardingRequired, restricted, sidebarStorageKey]);

    function toggleSidebar() {
        const collapsed = !isSidebarCollapsed;
        setIsSidebarCollapsed(collapsed);
        try {
            localStorage.setItem(sidebarStorageKey, String(collapsed));
        } catch {
            // The sidebar still toggles if browser storage is unavailable.
        }
    }

    if (onboardingRequired && !restricted) return checkingPage ? <MembershipPageLoading /> : <FirstAccessOnboarding />;

    return (
        <GuidedTour setMobileMenuOpen={setIsMobileMenuOpen}>
            <CurrentUserContext.Provider value={{ userId, name: fullName, photoUrl: initialProfilePhotoUrl }}>
            <AdminUserIdContext.Provider value={userId}>
            <div data-dashboard-shell className="fixed inset-0 flex h-dvh min-h-0 w-full overflow-hidden bg-j-white">
                <a href="#dashboard-main" className="sr-only z-50 rounded-lg bg-j-white p-3 font-bold text-j-blue-800 focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus-visible:outline-2 focus-visible:outline-j-blue-800">Ir para o conteúdo principal</a>
                <Sidebar
                    isCollapsed={isSidebarCollapsed}
                    isMobileOpen={isMobileMenuOpen}
                    onCloseMobile={() => setIsMobileMenuOpen(false)}
                    userId={userId}
                />
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                    <Topbar
                        isSidebarCollapsed={isSidebarCollapsed}
                        onToggleSidebar={toggleSidebar}
                        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
                        fullName={fullName}
                        initialProfilePhotoUrl={initialProfilePhotoUrl}
                    />
                    <div id="dashboard-main" data-dashboard-scroll tabIndex={-1} className="isolate min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain bg-j-gray-100 [-webkit-overflow-scrolling:touch] focus-visible:outline-none">
                        <div className="flex min-h-full flex-col">
                            {checkingPage && <MembershipPageLoading />}
                            <div hidden={checkingPage} inert={checkingPage} className={checkingPage ? "hidden" : "mx-auto w-full min-w-0 max-w-7xl flex-1"}>
                                {children}
                            </div>
                            <footer className="shrink-0 border-t border-j-gray-200 bg-j-white px-6 py-3 text-center text-[11px] font-normal leading-relaxed text-j-gray-600">
                                © {new Date().getFullYear()} Desenvolvido pelo Instituto Federal de São Paulo - Câmpus Caraguatatuba
                            </footer>
                        </div>
                    </div>
                    <nav aria-label="Navegação principal" className="flex shrink-0 border-t border-j-gray-200 bg-j-white pb-[env(safe-area-inset-bottom)] md:hidden">
                        {mobileTabs.map(({ href, label, icon: Icon }) => {
                            const isActive = pathname.startsWith(href);
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    prefetch={restricted ? false : undefined}
                                    onClick={blockNavigation}
                                    aria-label={label}
                                    aria-current={isActive ? "page" : undefined}
                                    className={`relative flex min-h-14 flex-1 cursor-pointer items-center justify-center transition-[color,transform] duration-200 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-j-blue-800 motion-reduce:transform-none ${restricted ? "opacity-50" : ""} ${isActive ? "text-j-blue-800" : "text-j-gray-500 hover:text-j-blue-800"}`}
                                >
                                    <Icon size={21} aria-hidden="true" />
                                    <MobileTabProgress />
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            </div>
            </AdminUserIdContext.Provider>
            </CurrentUserContext.Provider>
        </GuidedTour>
    );
}
