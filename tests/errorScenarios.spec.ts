import { z } from 'zod';
import { fetchWrapper } from '@/services/fetchWrapper/fetchWrapper';
import { toActionError } from '@/utils/http/apiError';
import { ActionError, getActionFailure } from '@/utils/http/ActionError';
import { mutationErrorHandler } from '@/providers/QueryProvider/handlers/mutation/onError';
import { toast } from 'react-hot-toast';
import scenarios from './test-docs-cases.json';

jest.mock('react-hot-toast', () => ({ toast: { error: jest.fn() } }));
jest.mock('@/services/fetchWrapper/logFetchFailure', () => ({ logFetchFailure: jest.fn() }));
const originalFetch = global.fetch;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
});

it.each(scenarios.filter(scenario => scenario.status).map(scenario => [scenario.match, scenario.status] as const))('%s transporta status, mensagem pública e validação sem dados privados', async (_, status) => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ status, code: 'SIMULATED_FAILURE', detail: 'Tente novamente.', privateContext: 'private-secret' }), { status, headers: { 'Content-Type': 'application/problem+json' } }));
    const error = await fetchWrapper({ url: 'http://synthetic.invalid/resource', schema: z.object({ id: z.number() }) }).catch(toActionError);
    expect(error).toBeInstanceOf(ActionError);
    const failure = getActionFailure(error);
    expect(failure).toMatchObject({ status, message: 'Tente novamente.' });
    expect(JSON.stringify(failure)).not.toContain('private-secret');
});

it('ERR-LOGIN preserva erro de credenciais sem logout nem mensagem de sessão expirada', () => {
    const assign = jest.fn();
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { assign, origin: 'http://localhost', pathname: '/login' } } });
    mutationErrorHandler(toActionError({ status: 401, rawData: { status: 401, code: 'INVALID_CREDENTIALS', detail: 'CPF ou senha inválidos.' } }));
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith('CPF ou senha inválidos.');
    expect(assign).not.toHaveBeenCalled();
});

it('ERR-NETWORK retorna erro público sem vazar origem privada ou stack', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed private-host:8080'));
    const error = await fetchWrapper({ url: 'http://synthetic.invalid/resource', schema: z.unknown() }).catch(toActionError);
    expect(error).toBeInstanceOf(ActionError);
    expect(JSON.stringify(getActionFailure(error))).not.toMatch(/private-host|stack|8080/);
});
