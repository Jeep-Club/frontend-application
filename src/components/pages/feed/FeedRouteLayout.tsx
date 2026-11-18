'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { usePathname, useSelectedLayoutSegment } from 'next/navigation';
import { useRestrictedMembership } from '@/components/common/layout-admin/MembershipAccessGate';

const ModalContext = createContext<(active: boolean) => void>(() => {});

export function FeedRouteLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
    const [active, setActive] = useState(false);
    const childSegment = useSelectedLayoutSegment();
    const pathname = usePathname();
    const { checking } = useRestrictedMembership();
    const trigger = useRef<{ href: string; label: string | null } | null>(null);
    useEffect(() => {
        if (pathname !== '/feed' || active || checking || !trigger.current) return;
        // The stable layout remembers the trigger even when RSC replaces the list.
        const previous = trigger.current;
        const link = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).find(item => item.href === previous.href && item.getAttribute('aria-label') === previous.label);
        if (link) { link.focus({ preventScroll: true }); if (document.activeElement === link) trigger.current = null; }
    }, [pathname, active, checking, children]);
    return <ModalContext.Provider value={setActive}><div className="contents" onClickCapture={event => {
        if (pathname !== '/feed') return;
        const link = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
        if (link && link.pathname.startsWith('/feed/')) trigger.current = { href: link.href, label: link.getAttribute('aria-label') };
    }}>{active && childSegment ? null : children}{modal}</div></ModalContext.Provider>;
}

/** Only intercepted layouts register here; default/catch-all slots stay inactive. */
export function FeedInterceptedModal({ children }: { children: React.ReactNode }) {
    const setActive = useContext(ModalContext);
    useEffect(() => { setActive(true); return () => setActive(false); }, [setActive]);
    return children;
}
