"use client";

import { useMutation,useQueryClient } from "@tanstack/react-query";
import { Check,LoaderCircle,X } from "lucide-react";
import { useController,useFormContext } from "react-hook-form";
import toast from "react-hot-toast";

import { Button,ButtonIcon } from "@/components/common/button";
import { Form } from "@/components/common/form";
import { InputRegister } from "@/components/common/input/input-register";
import { SelectRegister } from "@/components/common/select/select-register";
import { TextareaRegister } from "@/components/common/textarea/textarea-register";
import { useModal } from "@/providers/ModalProvider";
import { medicalProfileFormSchema } from "@/schemas/profile/medical-profile";
import { saveMedicalProfileAction } from "@/server/actions/profile/medical-profile";
import { maskPhoneNumber } from "@/utils/masks/maskPhoneNumber";

interface EditMedicalProfileModalProps {
    medicalProfile: MedicalProfile | null;
}

const BLOOD_TYPES: Array<{ value: MedicalProfileBloodType; label: string }> = [
    { value: "A_POSITIVE", label: "A+" },
    { value: "A_NEGATIVE", label: "A-" },
    { value: "B_POSITIVE", label: "B+" },
    { value: "B_NEGATIVE", label: "B-" },
    { value: "AB_POSITIVE", label: "AB+" },
    { value: "AB_NEGATIVE", label: "AB-" },
    { value: "O_POSITIVE", label: "O+" },
    { value: "O_NEGATIVE", label: "O-" },
];

const NOT_APPLICABLE = "Não se aplica";

function MedicalAnswer({ question, hasCondition, onChange }: { question: string; hasCondition: boolean; onChange: (answer: "yes" | "no") => void }) {
    return <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="w-full text-center text-sm font-bold text-primary sm:w-auto sm:text-left">{question}</span>
        <div role="group" aria-label={question} className="grid w-full shrink-0 grid-cols-2 gap-1 rounded-lg border border-input-border bg-background-secondary p-1 sm:w-auto">
            {([['yes', 'Sim'], ['no', 'Não']] as const).map(([value, text]) => {
                const selected = (value === "yes") === hasCondition;
                return <button key={value} type="button" aria-pressed={selected} onClick={() => { if (!selected) onChange(value); }} className={`min-h-9 w-full cursor-pointer rounded-md px-4 text-center text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-input-border-focus ${selected ? "bg-button-primary-bg text-button-primary-text" : "text-primary hover:bg-background-tertiary"}`}>{text}</button>;
            })}
        </div>
    </div>;
}

function NotApplicableLabel() {
    return <p className="flex w-fit items-center gap-1.5 self-end rounded-md border border-(--success-border) bg-(--success-surface) px-2 py-1 text-xs font-semibold text-(--success-text)">
        <Check size={14} aria-hidden="true" />{NOT_APPLICABLE}
    </p>;
}

function MedicalConditionalField({ name, question, label, placeholder }: {
    name: "allergies" | "chronicConditions" | "continuousMedications" | "observations";
    question: string;
    label: string;
    placeholder: string;
}) {
    const { control } = useFormContext<MedicalProfileFormData>();
    const { field, fieldState } = useController({ name, control });
    const hasCondition = field.value !== NOT_APPLICABLE;

    const selectAnswer = (answer: "yes" | "no") => {
        field.onChange(answer === "no" ? NOT_APPLICABLE : "");
    };

    return (
        <div className="flex flex-col gap-3 rounded-xl border border-input-border bg-background p-3 sm:p-4">
            <MedicalAnswer question={question} hasCondition={hasCondition} onChange={selectAnswer} />
            {hasCondition && (
                <TextareaRegister name={name} label={label} placeholder={placeholder} maxLength={2000} />
            )}
            {!hasCondition && <NotApplicableLabel />}
            {fieldState.error && !hasCondition && <p className="text-sm text-input-error-text">{fieldState.error.message}</p>}
        </div>
    );
}
function HealthInsuranceConditionalField() {
    const { control, setValue } = useFormContext<MedicalProfileFormData>();
    const provider = useController({ name: 'healthInsuranceProvider', control }).field.value;
    const plan = useController({ name: 'healthInsurancePlan', control }).field.value;
    const number = useController({ name: 'healthInsuranceNumber', control }).field.value;
    const hasHealthPlan = [provider, plan, number].some((value) => value !== NOT_APPLICABLE);

    const selectAnswer = (answer: 'yes' | 'no') => {
        const value = answer === 'no' ? NOT_APPLICABLE : '';
        setValue('healthInsuranceProvider', value, { shouldValidate: true });
        setValue('healthInsurancePlan', value, { shouldValidate: true });
        setValue('healthInsuranceNumber', value, { shouldValidate: true });
    };

    return (
        <FormSection title="Plano de saúde">
            <div className="flex flex-col gap-3 rounded-xl border border-input-border bg-background p-3 sm:p-4">
                <MedicalAnswer question="Possui plano de saúde?" hasCondition={hasHealthPlan} onChange={selectAnswer} />
                {!hasHealthPlan && <NotApplicableLabel />}
            </div>
            {hasHealthPlan ? <div className="grid gap-4 sm:grid-cols-2">
                <InputRegister name="healthInsuranceProvider" label="Operadora" placeholder="Ex.: Unimed" maxLength={120} required />
                <InputRegister name="healthInsurancePlan" label="Plano" placeholder="Ex.: Nacional" maxLength={120} required />
                <InputRegister name="healthInsuranceNumber" label="Número da carteirinha" placeholder="Número de identificação" maxLength={80} required />
            </div> : null}
        </FormSection>
    );
}
export function EditMedicalProfileModal({ medicalProfile }: EditMedicalProfileModalProps) {
    const { setClose } = useModal();
    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: saveMedicalProfileAction,
        onSuccess: (savedProfile) => {
            queryClient.setQueryData(["medical-profile", "me"], savedProfile);
            toast.success("Perfil médico atualizado com sucesso!");
            setClose();
        },

    });

    const defaultValues: MedicalProfileFormData = {
        bloodType: medicalProfile?.bloodType ?? "UNKNOWN",
        allergies: medicalProfile?.allergies?.trim() || NOT_APPLICABLE,
        chronicConditions: medicalProfile?.chronicConditions?.trim() || NOT_APPLICABLE,
        continuousMedications: medicalProfile?.continuousMedications?.trim() || NOT_APPLICABLE,
        healthInsuranceProvider: medicalProfile?.healthInsuranceProvider?.trim() || NOT_APPLICABLE,
        healthInsurancePlan: medicalProfile?.healthInsurancePlan?.trim() || NOT_APPLICABLE,
        healthInsuranceNumber: medicalProfile?.healthInsuranceNumber?.trim() || NOT_APPLICABLE,
        emergencyContactName: medicalProfile?.emergencyContactName ?? "",
        emergencyContactPhone: medicalProfile?.emergencyContactPhone ?? "",
        emergencyContactRelationship: medicalProfile?.emergencyContactRelationship ?? "",
        observations: medicalProfile?.observations?.trim() || NOT_APPLICABLE,
    };

    return (
        <div className="relative flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-y-auto rounded-3xl border border-input-border bg-background text-primary shadow-2xl">
            <ButtonIcon
                type="button"
                onClick={setClose}
                aria-label="Fechar"
                disabled={mutation.isPending}
                title="Fechar"
                className="absolute right-4 top-4 z-10 rounded-full bg-background-tertiary p-2 text-primary hover:bg-background focus-visible:outline-2 md:right-6 md:top-6"
            >
                <X size={22} />
            </ButtonIcon>

            <header className="border-b border-input-border bg-background-secondary px-5 pb-5 pr-16 pt-6 md:px-8 md:pb-6 md:pr-20 md:pt-8">
                <h2 className="text-xl font-extrabold text-primary md:text-2xl">
                    {medicalProfile ? "Editar dados médicos" : "Incluir dados médicos"}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-secondary md:text-sm">
                    Mantenha estes dados atualizados para situações de emergência.
                </p>
            </header>

            <Form<MedicalProfileFormData>
                schema={medicalProfileFormSchema}
                formOptions={{ defaultValues }}
                onSubmit={(data) => mutation.mutate(data)}
                onError={() => toast.error("Revise os campos informados.")}
                className="items-stretch gap-5 px-5 pt-5 md:px-8 md:pt-6"
            >
                <MedicalProfileFields />

                <div className="-mx-5 mt-1 flex flex-col-reverse gap-3 border-t border-input-border bg-background-secondary px-5 py-5 sm:flex-row sm:justify-end md:-mx-8 md:px-8">
                    <Button type="button" onClick={setClose} disabled={mutation.isPending} className="border border-input-border bg-background px-5 text-primary hover:bg-background-tertiary hover:text-primary focus-visible:outline-input-border-focus">
                        Cancelar
                    </Button>
                    <Button type="submit" isLoading={mutation.isPending} className="gap-2 px-6">
                        {mutation.isPending ? <><LoaderCircle size={16} className="animate-spin" aria-hidden="true" />Salvando...</> : <><span className="sm:hidden">Salvar</span><span className="hidden sm:inline">Salvar alterações</span></>}
                    </Button>
                </div>
            </Form>
        </div>
    );
}

function FormSection({ title, columns = false, children }: { title: string; columns?: boolean; children: React.ReactNode }) {
    return (
        <section className="flex flex-col gap-4 rounded-2xl border border-input-border bg-background-secondary p-3 md:p-5">
            <h3 className="border-b border-input-border pb-3 text-sm font-extrabold text-(--accent-text)">{title}</h3>
            <div className={columns ? "grid gap-4 sm:grid-cols-2" : "flex flex-col gap-4"}>{children}</div>
        </section>
    );
}

export default EditMedicalProfileModal;

export function MedicalProfileFields() {
    return <>
                <FormSection title="Informações médicas">
                    <SelectRegister
                        name="bloodType"
                        label="Tipo sanguíneo"
                        required
                    >
                        <option value="UNKNOWN" disabled>Selecione o tipo sanguíneo</option>
                        {BLOOD_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                    </SelectRegister>
                    <MedicalConditionalField name="allergies" question="Possui alguma alergia?" label="Quais alergias?" placeholder="Ex.: dipirona, amendoim" />
                    <MedicalConditionalField name="chronicConditions" question="Possui alguma condição crônica?" label="Quais condições?" placeholder="Ex.: asma, diabetes" />
                    <MedicalConditionalField name="continuousMedications" question="Usa medicamento contínuo?" label="Quais medicamentos?" placeholder="Informe medicamento, dose e frequência" />
                </FormSection>

                <HealthInsuranceConditionalField />

                <FormSection title="Contato de emergência" columns>
                    <InputRegister name="emergencyContactName" label="Nome" required placeholder="Nome do contato" maxLength={120} />
                    <InputRegister name="emergencyContactPhone" label="Telefone" required placeholder="(12) 99999-9999" maxLength={20} mask={maskPhoneNumber} />
                    <InputRegister name="emergencyContactRelationship" label="Parentesco" required placeholder="Ex.: mãe, cônjuge" maxLength={80} />
                </FormSection>
                <MedicalConditionalField name="observations" question="Possui alguma observação médica adicional?" label="Observações" placeholder="Outras informações importantes" />

    </>;
}
