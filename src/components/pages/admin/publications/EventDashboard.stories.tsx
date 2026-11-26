import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { EventDashboard } from './EventDashboard';

const meta = {
    title: 'Páginas/Administração/Publicações/EventDashboard',
    component: EventDashboard,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component: 'Resumo administrativo da participação em um evento. Os dados do exemplo são sintéticos; a tela real recebe o dashboard validado pela API.',
            },
        },
    },
} satisfies Meta<typeof EventDashboard>;

export default meta;
type Story = StoryObj<typeof meta>;

const dashboard = {
    registrations: [
        { id: 13, eventId: 27, userId: 3, status: 'CONFIRMED' as const, allocations: [{ vehicleId: 7, member: true, dependentIds: [4] }], createdAt: '2026-11-18T20:00:00Z', confirmedAt: '2026-11-18T20:10:00Z', cancelledAt: null, unallocatedDependentIds: [] },
    ],
    dependents: 1,
    guestsPending: 0,
    guestsApproved: 1,
    totalPeople: 2,
    vehicles: 1,
    totalCapacity: 5,
    availableSeats: 3,
    unpaidCharges: 1,
    pendingValidation: 0,
    postCutoffPending: 0,
    guestsStandby: 0,
    guestsAllocated: 1,
    guestsCancelled: 0,
    financial: [{ chargeDefinitionId: 4, userId: 3, memberChargeId: 9, effectiveStatus: 'PENDING', paymentStatus: null, paymentSubmittedAt: null, definitionName: 'Inscrição', amount: 250, chargeCycleId: 2, dueDate: '2026-11-18' }],
};

export const ComParticipacao = {
    args: { data: dashboard },
} satisfies Story;

export const SemParticipacao = {
    args: {
        data: {
            ...dashboard,
            registrations: [],
            financial: [],
            dependents: 0,
            guestsApproved: 0,
            totalPeople: 0,
            vehicles: 0,
            totalCapacity: 0,
            availableSeats: 0,
            unpaidCharges: 0,
            guestsAllocated: 0,
        },
    },
} satisfies Story;
