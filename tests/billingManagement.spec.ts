import { chargeAssignmentResponseSchema } from "@/schemas/billing/chargeAssignment";
import actionFetchWrapper from "@/services/fetchWrapper/actionFetchWrapper";
import { listBillingAction, mutateBillingAction } from "@/server/actions/billing/management";
import { listChargeDefinitionsAction } from "@/server/actions/billing/chargeDefinitions/list";
import { chargeSchema, cycleSchema, managementSchemas, refundSchema } from "@/schemas/billing/management";
import { adminModules, canAccessAdminModule } from "@/config/adminModules";
import { displayBillingValue, linkedChargeLabel } from "@/components/pages/admin/gestao-financeira/billingDisplay";

jest.mock("@/services/fetchWrapper/actionFetchWrapper", () => ({ __esModule: true, default: jest.fn() }));
const request = jest.mocked(actionFetchWrapper);
beforeEach(() => { request.mockReset(); request.mockResolvedValue({ status: 200, data: {} }); });

it("filters definition status across backend pages before applying the requested page size", async () => {
    request.mockResolvedValueOnce({ status: 200, data: { content: [{ id: 1, status: "ACTIVE" }, { id: 2, status: "ARCHIVED" }], totalPages: 2 } });
    request.mockResolvedValueOnce({ status: 200, data: { content: [{ id: 3, status: "ACTIVE" }], totalPages: 2 } });

    const page = await listChargeDefinitionsAction({ page: "1", size: "1", sort: "name,asc", status: "ACTIVE" });
    expect(page).toMatchObject({ content: [{ id: 3, status: "ACTIVE" }], number: 1, size: 1, totalElements: 2, totalPages: 2, last: true });
    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ url: "billing/charge-definitions?page=1&size=50&sort=name%2Casc" }));
});

it("keeps backend pagination for unfiltered definitions", async () => {
    await listChargeDefinitionsAction({ page: "1", size: "10" });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ url: "billing/charge-definitions?page=1&size=10" }));
});

it("uses the definition-scoped cycle API and refuses an absent definition", async () => {
    await expect(listBillingAction("cycles", { page: 0, size: 10 })).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
    await listBillingAction("cycles", { page: 1, size: 20, definitionId: 4 });
    expect(request.mock.calls[0][0].url).toBe("billing/charge-definitions/4/cycles?page=1&size=20");
});

it("uses the cycle refund endpoint without unsupported status filters", async () => {
    await listBillingAction("refunds", { page: 0, size: 10, cycleId: 5, status: "ELIGIBLE" });
    expect(request.mock.calls[0][0].url).toBe("billing/charge-cycles/5/member-refunds?page=0&size=10");
});

it("filters charges by persisted status and member, preserving effective status in the response", async () => {
    await listBillingAction("member-charges", { page: 0, size: 10, userId: 7, status: "PENDING" });
    expect(request.mock.calls[0][0].url).toContain("status=PENDING&userId=7");
    const charge = { id: 1, userId: 7, chargeDefinitionId: 4, chargeCycleId: 5, finalAmount: 100, dueDate: "2026-01-01", paymentAcceptancePolicy: "AFTER_DUE_DATE", paymentAllowedUntil: null, status: "PENDING", effectiveStatus: "OVERDUE" };
    expect(chargeSchema.parse(charge).effectiveStatus).toBe("OVERDUE");
    const labels = { userName: "Titular", membershipNumber: "00042", chargeDefinitionNameSnapshot: "Anuidade", chargeCycleCode: "2026" };
    expect(chargeSchema.parse({ ...charge, ...labels, finalAmount: 50 })).toMatchObject({ ...labels, finalAmount: 50 });
    expect(chargeSchema.parse({ ...charge, ...labels, userName: null, status: "CANCELED", effectiveStatus: "CANCELED" }))
        .toMatchObject({ userName: null, membershipNumber: "00042", chargeCycleCode: "2026", status: "CANCELED" });
    expect(chargeSchema.safeParse({ ...charge, status: "OVERDUE" }).success).toBe(false);
});

it("rejects blank reasons, invalid adjustments and cross-resource operations before sending requests", async () => {
    await expect(mutateBillingAction("payments", 1, "reject", "   ")).rejects.toThrow();
    await expect(mutateBillingAction("member-charges", 1, "final-amount", "0")).rejects.toThrow();
    await expect(mutateBillingAction("payments", 1, "approve")).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
    await mutateBillingAction("payments", 1, "reject", " Valor divergente ");
    expect(request.mock.calls[0][0]).toMatchObject({ url: "billing/member-payments/1/reject", method: "PATCH", body: JSON.stringify({ rejectionReason: "Valor divergente" }) });
});

it("accepts null audit dates and canceled cycle histories from the backend", () => {
    expect(cycleSchema.safeParse({ id: 5, chargeDefinitionId: 4, chargeDefinitionNameSnapshot: "Anuidade", code: "2026", dueDate: "2026-01-01", status: "CANCELED", chargeDefinitionPaymentAcceptancePolicySnapshot: "AFTER_DUE_DATE", canceledAt: "2026-01-02T12:00:00Z", archivedAt: null }).success).toBe(true);
    expect(refundSchema.safeParse({ id: 2, memberChargeId: 3, memberPaymentId: 4, chargeCycleId: 5, userId: 7, amount: 100, reason: "CYCLE_CANCELED_BY_ADMIN", status: "ELIGIBLE", eligibleUntil: null, requestedAt: null }).success).toBe(true);
});

it("preserves authorized refund context on lists, details and mutation responses", () => {
    const legacy = { id: 2, memberChargeId: 3, memberPaymentId: 4, chargeCycleId: 5, userId: 7, amount: 100, reason: "MEMBER_REQUEST", status: "REQUESTED" };
    const context = { userName: "Beneficiário", membershipNumber: "00042", chargeDefinitionId: 9, chargeDefinitionNameSnapshot: "Anuidade", chargeCycleCode: "2026" };
    const actors = { createdByUserName: "Operador", requestedByUserName: "Beneficiário", approvedByUserName: "Financeiro", rejectedByUserName: null, refundedByUserName: "Tesoureiro", canceledByUserName: null };
    const schema = managementSchemas.refunds;
    expect(schema.parse({ ...legacy, ...context })).toMatchObject(context);
    const completed = schema.parse({ ...legacy, ...context, ...actors, status: "REFUNDED" });
    expect(completed).toMatchObject({ ...context, ...actors, status: "REFUNDED" });
    expect(linkedChargeLabel(completed)).toBe("Anuidade");
    expect(linkedChargeLabel(schema.parse(legacy))).toBe("Cobrança #3");
    expect(schema.parse({ ...legacy, userName: null, membershipNumber: null, chargeDefinitionId: null }))
        .toMatchObject({ userName: null, membershipNumber: null, chargeDefinitionId: null });
});

it("grants page visibility to payment readers without definition access", () => {
    const finance = adminModules.find((module) => module.key === "financial-movements")!;
    expect(canAccessAdminModule([{ module: "BILLING", actions: ["PAYMENT_READ"] }], finance)).toBe(true);
    expect(canAccessAdminModule([{ module: "BILLING", actions: ["PAYMENT_CONFIRM"] }], finance)).toBe(false);
});

it("formats date-only deadlines without shifting the calendar day", () => {
    expect(displayBillingValue("dueDate", "2026-10-13")).toBe("13/10/2026");
    expect(displayBillingValue("paymentAllowedUntil", null)).toBe("—");
});

it("normalizes legacy financial enum names for display without altering unknown text", () => {
    expect(displayBillingValue("paymentMethod", "BANK_TRANSFER")).toBe("Transferência bancária");
    expect(displayBillingValue("recurrenceType", "ONE_TIME")).toBe("Cobrança única");
    expect(displayBillingValue("paymentAcceptancePolicy", "UNTIL_DUE_DATE")).toBe("Até o vencimento");
    expect(displayBillingValue("notes", "Observação original")).toBe("Observação original");
    expect(displayBillingValue("notes", "PIX")).toBe("PIX");
});


it("preserves assignment presentation and accepts older responses without names", () => {
    const assignment = {
        id: 1, chargeDefinitionId: 2, audienceType: "USER", userId: 3,
        roleId: null, eventId: null, active: true, createdAt: "2026-11-23T00:00:00Z", updatedAt: null,
    };
    expect(chargeAssignmentResponseSchema.parse(assignment)).toMatchObject({
        chargeDefinitionName: null, userName: null, eventTitle: null,
    });
    expect(chargeAssignmentResponseSchema.parse({
        ...assignment, chargeDefinitionName: "Anuidade", userName: "Marina da Silva", eventTitle: null,
    })).toMatchObject({ chargeDefinitionName: "Anuidade", userName: "Marina da Silva", eventTitle: null });
});
