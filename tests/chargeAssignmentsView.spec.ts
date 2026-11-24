import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChargeAssignmentsModal } from "@/components/pages/admin/gestao-financeira/ChargeAssignmentsModal";
import { chargeAssignmentResponseSchema } from "@/schemas/billing/chargeAssignment";

jest.mock("@/services/fetchWrapper/actionFetchWrapper", () => ({ __esModule: true, default: jest.fn() }));

jest.mock("@/components/pages/admin/gestao-financeira/AddChargeAssignmentModal", () => ({ AddChargeAssignmentModal: () => null }));

it("mostra os nomes autorizados e um rótulo legível quando o nome está ausente", () => {
    const base = {
        chargeDefinitionId: 42, userId: null, roleId: null, eventId: null,
        active: true, createdAt: "2026-11-23T00:00:00Z", updatedAt: null,
    };
    const content = [
        { ...base, id: 1, audienceType: "USER", userId: 2 },
        { ...base, id: 2, audienceType: "USER", userId: 3, chargeDefinitionName: "Anuidade atual", userName: "Marina da Silva" },
        { ...base, id: 3, audienceType: "ROLE", roleId: 4, roleName: "Diretoria" },
        { ...base, id: 4, audienceType: "EVENT_PARTICIPANTS", eventId: 5, eventTitle: "Passeio de novembro" },
    ].map(record => chargeAssignmentResponseSchema.parse(record));
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    client.setQueryData(["billing", "charge-definitions", 42, "assignments", 0], { content, totalPages: 1 });
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(ChargeAssignmentsModal, {
        chargeDefinitionId: 42, chargeDefinitionName: "Anuidade anterior", chargeDefinitionStatus: "ACTIVE",
    })));
    client.clear();

    for (const label of ["Atribuições de Anuidade atual", "Marina da Silva", "Diretoria", "Passeio de novembro", "Nome do usuário indisponível"]) {
        expect(html).toContain(label);
    }
});
