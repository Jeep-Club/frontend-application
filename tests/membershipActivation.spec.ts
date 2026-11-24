import actionFetchWrapper from '@/services/fetchWrapper/actionFetchWrapper';
import { validateMembershipActivationAction, completeMembershipActivationAction } from '@/server/actions/membership/activate';
import { approveMembershipApplicationWithLinkAction, resendMembershipActivationLinkAction } from '@/server/actions/admin/membership-applications';
import { accessLinkApprovalSchema } from '@/schemas/membership/application';
import { accountActivationSchema } from '@/schemas/auth/account-activation';
import { ActionError } from '@/utils/http/ActionError';

jest.mock('@/services/fetchWrapper/actionFetchWrapper', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@/services/fetchWrapper/frontendAccess', () => ({ getFrontendAccessHeaders: () => ({ 'X-Frontend-Key': 'test' }) }));
const request = jest.mocked(actionFetchWrapper);

beforeEach(() => { jest.resetAllMocks(); request.mockResolvedValue({ status: 204, data: undefined }); });

it('validates by GET without consuming the token, encoding the query and disabling cache', async () => {
    await expect(validateMembershipActivationAction('a+b/c=')).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
        url: 'membership-applications/activate?token=a%2Bb%2Fc%3D', method: 'GET', cache: 'no-store',
    }));
    expect(request.mock.calls[0][0].body).toBeUndefined();
});

it('posts token and newPassword and accepts 204 without JSON', async () => {
    await expect(completeMembershipActivationAction({ token: 'invite', newPassword: '12345678' })).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ url: 'membership-applications/activate', method: 'POST', body: JSON.stringify({ token: 'invite', newPassword: '12345678' }) }));
});

it.each([7, 73])('rejects a password of %i characters before HTTP', async (length) => {
    await expect(completeMembershipActivationAction({ token: 'invite', newPassword: 'a'.repeat(length) })).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
});

it.each([8, 72])('accepts the password boundary of %i characters', async (length) => {
    const password = 'a'.repeat(length);
    expect(accountActivationSchema.safeParse({ password, confirmPassword: password }).success).toBe(true);
    await expect(completeMembershipActivationAction({ token: 'invite', newPassword: password })).resolves.toBeUndefined();
});

it('requires matching password confirmation', () => {
    expect(accountActivationSchema.safeParse({ password: '12345678', confirmPassword: '87654321' }).success).toBe(false);
});

it('does not validate a missing token', async () => {
    await expect(validateMembershipActivationAction('')).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
});

it.each(['ACTIVATION_TOKEN_NOT_FOUND', 'ACTIVATION_TOKEN_EXPIRED', 'ACTIVATION_TOKEN_ALREADY_USED'])('preserves %s for both validation and completion', async (code) => {
    const error = new ActionError('Convite indisponível', { code });
    request.mockRejectedValue(error);
    await expect(validateMembershipActivationAction('invite')).rejects.toBe(error);
    await expect(completeMembershipActivationAction({ token: 'invite', newPassword: '12345678' })).rejects.toBe(error);
});

it('requires 204 before confirming validation or completion', async () => {
    request.mockResolvedValue({ status: 200, data: undefined });
    await expect(validateMembershipActivationAction('invite')).rejects.toThrow();
    await expect(completeMembershipActivationAction({ token: 'invite', newPassword: '12345678' })).rejects.toThrow();
});

it('validates the backend link contract and exposes only userId to the UI', async () => {
    const response = { userId: 123, activationLink: 'https://frontend.example/membership/activate?token=test' };
    expect(accessLinkApprovalSchema.parse(response)).toEqual(response);
    expect(accessLinkApprovalSchema.safeParse({ userId: 123 }).success).toBe(false);
    request.mockResolvedValue({ status: 200, data: response });
    await expect(approveMembershipApplicationWithLinkAction(9)).resolves.toEqual({ userId: 123 });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ url: 'admin/membership-applications/9/approve/access-link', method: 'POST' }));
});

it('resends through the administrative route and accepts 204 without JSON', async () => {
    await expect(resendMembershipActivationLinkAction(9)).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ url: 'admin/membership-applications/9/activation-link/resend', method: 'POST' }));
});
