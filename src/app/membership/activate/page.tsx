import ActivateMembership from '@/components/pages/membership/ActivateMembership';

export const metadata = { title: 'Ativar associação | Jeep Clube Tamoios', robots: { index: false, follow: false }, referrer: 'no-referrer' as const };

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
    const { token } = await searchParams;
    return <ActivateMembership key={typeof token === 'string' ? token : ''} token={typeof token === 'string' ? token : ''} />;
}
