import { paymentDetailSchema, paymentPageSchema, rejectPaymentSchema } from "@/schemas/payments";
import { adminPaymentSchema, paymentSchema } from "@/schemas/billing/management";
import { linkedChargeLabel } from "@/components/pages/admin/gestao-financeira/billingDisplay";

const summary = {
    id: 12, memberChargeId: 7, amount: 250, paymentMethod: "PIX", status: "PENDING_VALIDATION",
    paidAt: "2026-10-15T12:00:00Z", receiptUrl: "/billing/member-payments/12/receipt", createdAt: "2026-10-15T12:05:00Z",
};

it("aceita a paginação estável do backend sem exigir o campo sort do Spring", () => {
    expect(paymentPageSchema.safeParse({ content: [summary], number: 0, size: 20, totalElements: 1, totalPages: 1, numberOfElements: 1, first: true, last: true, empty: false }).success).toBe(true);
});

it("aceita campos de auditoria nulos para pagamentos ainda pendentes", () => {
    expect(paymentDetailSchema.safeParse({ ...summary, confirmedAt: null, confirmedByUserId: null, rejectedAt: null, rejectedByUserId: null, rejectionReason: null, canceledAt: null, notes: null, updatedAt: null }).success).toBe(true);
});

it("aceita o limite de 500 caracteres para o motivo", () => {
    expect(rejectPaymentSchema.safeParse({ rejectionReason: "a".repeat(500) }).success).toBe(true);
});

it("preserva o contexto administrativo e aceita campos protegidos nulos", () => {
    const context = {
        userId: 8, userName: "Titular de teste", membershipNumber: "00042",
        chargeDefinitionId: 2, chargeCycleId: 5, chargeDefinitionNameSnapshot: "Anuidade",
        chargeCycleCode: "2026", dueDate: "2026-11-22",
    };
    const decision = {
        confirmedAt: "2026-10-15T13:00:00Z", confirmedByUserId: 99, confirmedByUserName: "Operador",
        rejectedAt: null, rejectedByUserId: null, rejectedByUserName: null,
        rejectionReason: null, canceledAt: null, notes: null, updatedAt: null,
    };
    const detailed = { ...summary, ...context, ...decision, status: "CONFIRMED" };
    for (const schema of [adminPaymentSchema, paymentDetailSchema]) {
        expect(schema.parse(detailed)).toMatchObject({ ...context, confirmedByUserName: "Operador", rejectedByUserName: null });
        expect(schema.parse({ ...detailed, userName: null, membershipNumber: null, confirmedByUserName: null }))
            .toMatchObject({ userName: null, membershipNumber: null, confirmedByUserName: null });
    }
    expect(paymentSchema.parse(detailed)).not.toHaveProperty("confirmedByUserName");
    expect(linkedChargeLabel(adminPaymentSchema.parse(detailed))).toBe("Anuidade");
    expect(linkedChargeLabel(adminPaymentSchema.parse(summary))).toBe("Cobrança #7");
});
