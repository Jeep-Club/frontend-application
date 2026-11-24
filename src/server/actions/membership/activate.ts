'use server';

import { z } from 'zod';
import actionFetchWrapper from '@/services/fetchWrapper/actionFetchWrapper';
import { getFrontendAccessHeaders } from '@/services/fetchWrapper/frontendAccess';
import { HttpAPIRoutes } from '@/utils/http/api';
import { ActionError } from '@/utils/http/ActionError';

// Only 204 confirms validation/completion; no JSON representation is expected.
const noContentSchema = z.never();
const activationInputSchema = z.object({
    token: z.string().trim().min(1),
    newPassword: z.string().min(8).max(72),
});

export async function validateMembershipActivationAction(token: string) {
    const value = z.string().trim().min(1).safeParse(token);
    if (!value.success) throw new ActionError('Convite inválido.', { code: 'ACTIVATION_TOKEN_NOT_FOUND' });
    const result = await actionFetchWrapper({
        url: `${HttpAPIRoutes.MEMBERSHIP_APPLICATION_ACTIVATION}?${new URLSearchParams({ token: value.data })}`,
        method: 'GET',
        cache: 'no-store',
        headers: getFrontendAccessHeaders(),
        schema: noContentSchema,
    });
    if (result.status !== 204) throw new ActionError('Não foi possível validar o convite.', { code: 'INVALID_RESPONSE' });
}

export async function completeMembershipActivationAction(input: { token: string; newPassword: string }) {
    const parsed = activationInputSchema.safeParse(input);
    if (!parsed.success) throw new ActionError('Informe o convite e uma senha de 8 a 72 caracteres.');
    const result = await actionFetchWrapper({
        url: HttpAPIRoutes.MEMBERSHIP_APPLICATION_ACTIVATION,
        method: 'POST',
        headers: getFrontendAccessHeaders(),
        body: JSON.stringify(parsed.data),
        schema: noContentSchema,
    });
    if (result.status !== 204) throw new ActionError('Não foi possível confirmar a ativação.', { code: 'INVALID_RESPONSE' });
}
