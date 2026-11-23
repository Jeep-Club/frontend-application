'use client';

import { Button } from '@/components/common/button';
import { Form } from '@/components/common/form';
import InputPassword from '@/components/common/input/input-password';
import { accountActivationSchema, type AccountActivationForm } from '@/schemas/auth/account-activation';
import { completeMembershipActivationAction, validateMembershipActivationAction } from '@/server/actions/membership/activate';
import { extractApiErrorCode, extractApiErrorMessage } from '@/utils/http/apiError';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

const tokenMessages: Record<string, string> = {
    ACTIVATION_TOKEN_NOT_FOUND: 'Este convite é inválido. Solicite à administração o reenvio do convite de ativação.',
    ACTIVATION_TOKEN_EXPIRED: 'Este convite expirou. Solicite à administração o reenvio do convite de ativação.',
    ACTIVATION_TOKEN_ALREADY_USED: 'Este convite já foi utilizado. Entre com a senha criada. Se ainda não concluiu o primeiro acesso, solicite à administração o reenvio do convite.',
};

export default function ActivateMembership({ token }: { token: string }) {
    const router = useRouter();
    const [valid, setValid] = useState(false);
    const [errorMessage, setErrorMessage] = useState(token ? '' : tokenMessages.ACTIVATION_TOKEN_NOT_FOUND);
    const validation = useMutation({ mutationFn: validateMembershipActivationAction });
    const activation = useMutation({
        mutationFn: (form: AccountActivationForm) => completeMembershipActivationAction({ token, newPassword: form.password }),
        onSuccess: () => {
            toast.success('Primeiro acesso concluído. Entre com sua nova senha.');
            router.replace('/login');
        },
        onError: (error) => {
            const tokenMessage = tokenMessages[extractApiErrorCode(error) ?? ''];
            if (tokenMessage) setValid(false);
            setErrorMessage(tokenMessage ?? extractApiErrorMessage(error));
        },
    });
    const { mutateAsync: validate } = validation;

    useEffect(() => {
        let active = true;
        // Keep the bearer credential out of the address bar and subsequent history.
        window.history.replaceState(null, '', '/membership/activate');
        if (!token) return;
        void validate(token).then(() => {
            if (active) setValid(true);
        }).catch((error: unknown) => {
            if (active) setErrorMessage(tokenMessages[extractApiErrorCode(error) ?? ''] ?? 'Não foi possível validar o convite. Tente novamente. Se o problema persistir, solicite à administração o reenvio do convite.');
        });
        return () => { active = false; };
    }, [token, validate]);

    return (
        <main className="flex min-h-dvh items-center justify-center bg-background-secondary p-4">
            <section className="w-full max-w-lg rounded-2xl border border-input-border bg-background p-5 shadow-lg sm:p-8">
                <p className="text-sm font-bold text-primary">Ativação da associação</p>
                <h1 className="mt-2 text-2xl font-extrabold text-primary">{valid ? 'Crie sua senha' : errorMessage ? 'Convite indisponível' : 'Validando seu convite'}</h1>
                {!valid && !errorMessage && <p role="status" className="mt-4 text-sm text-j-gray-700">Aguarde enquanto validamos seu convite...</p>}
                {errorMessage && <p role="alert" className="mt-4 text-sm text-j-gray-700">{errorMessage}</p>}
                {!valid && errorMessage && <div className="mt-4 flex flex-col gap-3">
                    {token && !Object.values(tokenMessages).includes(errorMessage) && <Button type="button" disabled={validation.isPending} onClick={() => {
                        setErrorMessage('');
                        validation.mutate(token, {
                            onSuccess: () => setValid(true),
                            onError: (error) => setErrorMessage(tokenMessages[extractApiErrorCode(error) ?? ''] ?? 'Não foi possível validar o convite. Tente novamente ou solicite à administração o reenvio do convite.'),
                        });
                    }}>Tentar novamente</Button>}
                    <Button type="button" onClick={() => router.replace('/login')}>Ir para o login</Button>
                </div>}
                {valid && <>
                    <p className="mb-6 mt-2 text-sm text-j-gray-700">Escolha uma senha para concluir seu primeiro acesso. Depois, entre com seu CPF e a senha criada.</p>
                    <Form<AccountActivationForm> schema={accountActivationSchema} onSubmit={(form) => activation.mutate(form)} onError={() => toast.error('Confira os campos e confirme se as senhas são iguais.')} className="w-full">
                        <div className="flex flex-col gap-4">
                            <InputPassword name="password" label="Nova senha" autoComplete="new-password" minLength={8} maxLength={72} required disabled={activation.isPending} aria-describedby="membership-password-help" />
                            <InputPassword name="confirmPassword" label="Confirmar senha" autoComplete="new-password" minLength={8} maxLength={72} required disabled={activation.isPending} />
                            <p id="membership-password-help" className="text-xs text-j-gray-700">Use de 8 a 72 caracteres.</p>
                            <Button type="submit" isLoading={activation.isPending}>Ativar associação</Button>
                        </div>
                    </Form>
                </>}
            </section>
        </main>
    );
}

