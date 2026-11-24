import type { AdminEventDashboard } from '@/schemas/publications/admin';
import { billingLabels } from '@/components/pages/admin/gestao-financeira/billingDisplay';
import { AlertCircle, CarFront, CircleDollarSign, Users } from 'lucide-react';

const registrationLabels = { PENDING_PAYMENT: 'Aguardando pagamento', CONFIRMED: 'Confirmada', CANCELLED: 'Cancelada' } as const;

/** Participation confirmation is not proof of a homologated payment. Capacity derives from participating vehicles. */
export function EventDashboard({ data }: { data: AdminEventDashboard }) {
    const groups = [
        { title: 'Pessoas e veículos', icon: CarFront, values: [['Pessoas', data.totalPeople], ['Dependentes', data.dependents], ['Veículos', data.vehicles], ['Capacidade dos veículos', data.totalCapacity], ['Vagas disponíveis', data.availableSeats]] },
        { title: 'Convidados', icon: Users, values: [['Pendentes', data.guestsPending], ['Aprovados', data.guestsApproved], ['Em espera', data.guestsStandby], ['Alocados', data.guestsAllocated], ['Cancelados', data.guestsCancelled]] },
        { title: 'Pendências', icon: AlertCircle, values: [['Cobranças não pagas', data.unpaidCharges], ['Pagamentos em validação', data.pendingValidation], ['Pendências após o prazo', data.postCutoffPending]] },
    ];
    return <div className="min-w-0 space-y-5">
        <div className="flex gap-3 rounded-lg border border-input-border bg-background-secondary p-3 text-sm text-primary">
            <CircleDollarSign size={18} className="mt-0.5 shrink-0 text-j-yellow-700" aria-hidden="true" />
            <p>Participação confirmada indica inscrição confirmada; um pagamento em validação pode satisfazer a participação. Não comprova pagamento homologado. Esta consulta pode atualizar confirmações.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{groups.map(group => <section key={group.title} className="min-w-0 rounded-xl border border-input-border bg-background-secondary p-4 transition-shadow duration-200 motion-safe:hover:shadow-sm">
            <h4 className="flex items-center gap-2 font-bold text-primary"><group.icon size={18} aria-hidden="true" className="text-j-blue-800" />{group.title}</h4>
            <dl className="mt-4 grid grid-cols-2 gap-3">{group.values.map(([label, value]) => <div key={label} className="min-w-0 rounded-lg border border-input-border bg-background p-3"><dt className="text-xs text-secondary">{label}</dt><dd className="mt-1 text-xl font-bold tabular-nums text-primary">{value}</dd></div>)}</dl>
        </section>)}</div>
        <section aria-labelledby="event-registrations-heading" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 id="event-registrations-heading" className="font-bold text-primary">Inscrições</h4><p className="text-sm text-secondary">{data.registrations.length} registro(s) de participação</p></div></div>
            {data.registrations.length ? <ul className="grid gap-3 lg:grid-cols-2">{data.registrations.map(registration => <li key={registration.id} className="min-w-0 rounded-xl border border-input-border bg-background p-4 transition-shadow duration-200 motion-safe:hover:shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold text-primary">Inscrição #{registration.id}</p><p className="text-sm text-secondary">Usuário #{registration.userId}</p></div><span className="rounded-full bg-background-secondary px-3 py-1 text-xs font-semibold text-primary">{registrationLabels[registration.status]}</span></div>
                <ul className="mt-3 space-y-2">{registration.allocations.map(allocation => <li key={allocation.vehicleId} className="rounded-lg bg-background-secondary p-3 text-sm"><p className="font-medium text-primary">Veículo #{allocation.vehicleId}</p><p className="mt-1 text-secondary">Titular: {allocation.member ? 'Sim' : 'Não'} <span aria-hidden="true">·</span> Dependentes: {allocation.dependentIds.join(', ') || 'Nenhum'}</p></li>)}</ul>
                {registration.allocations.length === 0 && <p className="mt-3 rounded-lg bg-background-secondary p-3 text-sm text-secondary">Nenhum veículo informado nesta inscrição.</p>}
                {registration.unallocatedDependentIds.length > 0 && <p className="mt-3 text-sm font-medium text-secondary">Dependentes sem transporte: {registration.unallocatedDependentIds.join(', ')}</p>}
            </li>)}</ul> : <p className="rounded-xl border border-dashed border-input-border p-5 text-sm text-secondary">Nenhuma inscrição registrada para este evento.</p>}
        </section>
        <section aria-labelledby="event-financial-heading" className="space-y-3">
            <div><h4 id="event-financial-heading" className="font-bold text-primary">Fatos financeiros</h4><p className="text-sm text-secondary">{data.financial.length} registro(s) relacionado(s)</p></div>
            {data.financial.length ? <ul className="grid gap-3 lg:grid-cols-2">{data.financial.map((fact, index) => <li key={`${fact.memberChargeId}-${index}`} className="space-y-1 break-words rounded-xl border border-input-border bg-background p-4 text-sm"><p className="font-semibold text-primary">{fact.definitionName ?? `Definição #${fact.chargeDefinitionId ?? 'não informada'}`}</p><p className="text-secondary">Usuário #{fact.userId ?? 'não informado'} <span aria-hidden="true">·</span> {fact.amount?.toLocaleString('pt-BR') ?? 'Valor não informado'}</p><p><span className="text-secondary">Estado efetivo:</span> {fact.effectiveStatus ? billingLabels[fact.effectiveStatus] ?? fact.effectiveStatus : 'Não informado'}</p><p><span className="text-secondary">Pagamento:</span> {fact.paymentStatus ? billingLabels[fact.paymentStatus] ?? fact.paymentStatus : 'Não informado'} <span aria-hidden="true">·</span> Enviado em UTC: {fact.paymentSubmittedAt ?? 'Não informado'}</p><p className="text-xs text-secondary">Cobrança #{fact.memberChargeId ?? 'não informada'} <span aria-hidden="true">·</span> Ciclo #{fact.chargeCycleId ?? 'não informado'} <span aria-hidden="true">·</span> Vencimento: {fact.dueDate ?? 'Não informado'}</p></li>)}</ul> : <p className="rounded-xl border border-dashed border-input-border p-5 text-sm text-secondary">Nenhum fato financeiro associado.</p>}
        </section>
    </div>;
}
