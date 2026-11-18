"use client";

import { useId } from "react";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { Power } from "lucide-react";
import { Button } from "@/components/common/button";
import { ConfirmButton } from "@/components/common/button/ConfirmButton";
import { useModal } from "@/providers/ModalProvider";

type StatusActionProps = {
    name: string;
    active: boolean;
    onConfirm: () => Promise<unknown>;
    queryKeys: QueryKey[];
};

function ConfirmStatusChange({ name, active, onConfirm, queryKeys }: StatusActionProps) {
    const id = useId();
    const { setClose } = useModal();
    const client = useQueryClient();
    const label = active ? "Inativar" : "Ativar";
    const mutation = useMutation({
        mutationFn: onConfirm,
        onSuccess: async () => {
            await Promise.all(queryKeys.map(queryKey => client.invalidateQueries({ queryKey })));
            setClose();
        },
    });

    return <section role="dialog" aria-labelledby={id} className="w-full max-w-md rounded-2xl bg-background p-5 text-primary shadow-xl">
        <h2 id={id} className="text-lg font-extrabold">{label} cadastro?</h2>
        <p className="mt-2 break-words text-sm text-secondary">Confirme para {label.toLowerCase()} <strong>{name}</strong>.</p>
        {mutation.isError && <p role="alert" className="mt-3 text-sm text-input-error-text">{mutation.error.message || "Não foi possível alterar a situação."}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button type="button" onClick={setClose} disabled={mutation.isPending} className="border border-input-border bg-background text-primary hover:bg-background-tertiary">Cancelar</Button>
            <ConfirmButton type="button" onClick={() => mutation.mutate()} isLoading={mutation.isPending}>{label}</ConfirmButton>
        </div>
    </section>;
}

export function RecordStatusAction(props: StatusActionProps) {
    const { setContent, setOpen } = useModal();
    const label = props.active ? "Inativar" : "Ativar";
    return <button type="button" aria-haspopup="dialog" aria-label={`${label} ${props.name}`} title={label} className="record-action flex min-h-9 cursor-pointer flex-wrap items-center justify-center gap-1 rounded-lg bg-blue-50 px-1 py-2 text-xs font-bold text-j-blue-800 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2" onClick={() => {
        setContent(<ConfirmStatusChange {...props} />);
        setOpen();
    }}><Power size={15} aria-hidden="true" /><span className="hidden sm:inline">{label}</span></button>;
}
