import { readFileSync } from "node:fs";
import { toActionError } from "@/utils/http/apiError";
jest.mock("@/services/token/permissions", () => ({}));
import actionFetchWrapper from "@/services/fetchWrapper/actionFetchWrapper";
import { listToolsAdminAction } from "@/server/actions/admin/tools/list";
import { exportAdminToolsAction } from "@/server/actions/admin/tools/export";
import { getAdminPdfIdentity } from "@/server/utils/adminExportPdf";
import { haveActionPermission } from "@/utils/permission/actionPermissions";
import { getToolDetailAdminAction } from "@/server/actions/admin/tools/detail";
import { createToolAdminAction } from "@/server/actions/admin/tools/create";
import { updateToolAdminAction } from "@/server/actions/admin/tools/update";
import { updateToolPhotoAdminAction } from "@/server/actions/admin/tools/photo";
import { activateToolAdminAction } from "@/server/actions/admin/tools/activate";
import { deactivateToolAdminAction } from "@/server/actions/admin/tools/deactivate";
import { deleteToolAdminAction } from "@/server/actions/admin/tools/delete";
import { createAdminToolFormSchema } from "@/schemas/admin/tools";
import { adminModules, canAccessAdminModule } from "@/config/adminModules";
import { routePermissions } from "@/utils/permission/routePermissions";
import { HttpAPIRoutes } from "@/utils/http/api";

jest.mock("@/services/fetchWrapper/actionFetchWrapper", () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock("@/utils/permission/actionPermissions", () => ({ haveActionPermission: jest.fn() }));
jest.mock("@/server/utils/adminExportPdf", () => ({ getAdminPdfIdentity: jest.fn() }));

const request = jest.mocked(actionFetchWrapper);

beforeEach(() => {
    jest.resetAllMocks();
});

describe("Admin Tools Management", () => {
    it("requires export permission before fetching the tools", async () => {
        jest.mocked(haveActionPermission).mockImplementation(async (_, action) => action === "TOOL_READ");
        await expect(exportAdminToolsAction("CSV")).rejects.toThrow("Acesso não permitido");
        expect(request).not.toHaveBeenCalled();
    });

    it("exports every filtered page and protects spreadsheet cells", async () => {
        jest.mocked(haveActionPermission).mockResolvedValue(true);
        request
            .mockResolvedValueOnce({ status: 200, data: { totalPages: 2, content: [{ id: 10, name: "=1+1", userId: 7, status: "ACTIVE" }] } })
            .mockResolvedValueOnce({ status: 200, data: { totalPages: 2, content: [{ id: 11, name: "Macaco", userId: 8, status: "ACTIVE" }] } });

        const file = await exportAdminToolsAction("CSV", { name: " macaco ", status: "ACTIVE" });
        expect(request).toHaveBeenCalledTimes(2);
        expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ url: "admin/tools?size=50&name=macaco&status=ACTIVE&page=1" }));
        expect(file.filename).toBe("ferramentas.csv");
        const csv = Buffer.from(file.base64, "base64").toString("utf8");
        expect(csv).toContain(`"10";"'=1+1";"7";"Ativa"`);
        expect(csv).toContain(`"11";"Macaco";"8";"Ativa"`);
    });

    it("generates a PDF for the selected filters", async () => {
        jest.mocked(haveActionPermission).mockResolvedValue(true);
        jest.mocked(getAdminPdfIdentity).mockResolvedValue({
            exportedBy: "Admin Teste",
            seal: `data:image/png;base64,${readFileSync("public/images/jeepclube-emblema.png").toString("base64")}`,
        });
        request.mockResolvedValueOnce({ status: 200, data: { totalPages: 1, content: [{ id: 10, name: "Macaco", userId: 7, status: "ACTIVE" }] } });

        const file = await exportAdminToolsAction("PDF", { status: "ACTIVE" });
        expect(file.filename).toBe("ferramentas.pdf");
        expect(Buffer.from(file.base64, "base64").toString("latin1")).toMatch(/^%PDF-/);
    });

    it("registers the tools admin module and route permissions for TOOLS_TOOL_READ", () => {
        const toolsModule = adminModules.find((m) => m.key === "tools");
        expect(toolsModule).toBeDefined();
        expect(toolsModule?.href).toBe("/admin/ferramentas");
        expect(
            canAccessAdminModule([{ module: "TOOLS", actions: ["TOOL_READ"] }], toolsModule!),
        ).toBe(true);
        expect(
            canAccessAdminModule([{ module: "TOOLS", actions: ["TOOL_CREATE"] }], toolsModule!),
        ).toBe(false);
        expect(routePermissions["/admin/ferramentas"]).toEqual([
            { module: "TOOLS", actions: ["TOOL_READ"] },
        ]);
        expect(routePermissions["/admin/tools"]).toEqual([
            { module: "TOOLS", actions: ["TOOL_READ"] },
        ]);
    });

    it("lists tools with pagination, name and status filters, and enriches missing photos", async () => {
        request
            .mockResolvedValueOnce({
                status: 200,
                data: {
                    content: [
                        { id: 10, name: "Macaco Hidráulico", status: "ACTIVE", userId: 7 },
                        {
                            id: 11,
                            name: "Cinta de Reboque",
                            status: "INACTIVE",
                            userId: 8,
                            photoStorageKey: "cinta-key",
                        },
                    ],
                    totalElements: 2,
                    totalPages: 1,
                    number: 0,
                    size: 10,
                    first: true,
                    last: true,
                    numberOfElements: 2,
                    empty: false,
                },
            })
            .mockResolvedValueOnce({
                status: 200,
                data: {
                    id: 10,
                    name: "Macaco Hidráulico",
                    description: "2 toneladas",
                    status: "ACTIVE",
                    userId: 7,
                    photoStorageKey: "macaco-key",
                },
            });

        const page = await listToolsAdminAction({
            page: 0,
            size: 10,
            name: "  macaco ",
            status: "ACTIVE",
        });

        expect(request).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                url: `${HttpAPIRoutes.ADMIN_TOOLS}?page=0&size=10&name=macaco&status=ACTIVE`,
                method: "GET",
            }),
        );
        expect(page.content[0].photoStorageKey).toBe("macaco-key");
        expect(page.content[1].photoStorageKey).toBe("cinta-key");
    });

    it("executes create, update, photo, activate, deactivate, detail, and delete admin tool actions", async () => {
        const toolDetail: ToolDetail = {
            id: 42,
            name: "Chave de Roda",
            description: "Cruz 17/19/21mm",
            status: "ACTIVE",
            userId: 7,
            photoStorageKey: null,
        };

        request.mockResolvedValueOnce({ status: 201, data: toolDetail });
        await expect(
            createToolAdminAction(7, { name: "Chave de Roda", description: "Cruz 17/19/21mm" }),
        ).resolves.toEqual(toolDetail);
        expect(request).toHaveBeenLastCalledWith(
            expect.objectContaining({
                url: `${HttpAPIRoutes.ADMIN_TOOLS}/users/7`,
                method: "POST",
                body: JSON.stringify({ name: "Chave de Roda", description: "Cruz 17/19/21mm" }),
            }),
        );

        request.mockResolvedValueOnce({ status: 200, data: toolDetail });
        await expect(
            updateToolAdminAction(42, { name: "Chave de Roda Reforçada", description: "Preta" }),
        ).resolves.toEqual(toolDetail);
        expect(request).toHaveBeenLastCalledWith(
            expect.objectContaining({
                url: `${HttpAPIRoutes.ADMIN_TOOLS}/42`,
                method: "PUT",
            }),
        );

        request.mockResolvedValueOnce({
            status: 200,
            data: { ...toolDetail, photoStorageKey: "new-photo" },
        });
        await expect(updateToolPhotoAdminAction(42, "new-photo")).resolves.toEqual({
            ...toolDetail,
            photoStorageKey: "new-photo",
        });
        expect(request).toHaveBeenLastCalledWith(
            expect.objectContaining({
                url: `${HttpAPIRoutes.ADMIN_TOOLS}/42/photo`,
                method: "PATCH",
                body: JSON.stringify({ storageKey: "new-photo" }),
            }),
        );

        request.mockResolvedValueOnce({
            status: 200,
            data: { ...toolDetail, status: "INACTIVE" },
        });
        await expect(deactivateToolAdminAction(42)).resolves.toEqual({
            ...toolDetail,
            status: "INACTIVE",
        });
        expect(request).toHaveBeenLastCalledWith(
            expect.objectContaining({
                url: `${HttpAPIRoutes.ADMIN_TOOLS}/42/deactivate`,
                method: "PATCH",
            }),
        );

        request.mockResolvedValueOnce({
            status: 200,
            data: { ...toolDetail, status: "ACTIVE" },
        });
        await expect(activateToolAdminAction(42)).resolves.toEqual({
            ...toolDetail,
            status: "ACTIVE",
        });
        expect(request).toHaveBeenLastCalledWith(
            expect.objectContaining({
                url: `${HttpAPIRoutes.ADMIN_TOOLS}/42/activate`,
                method: "PATCH",
            }),
        );

        request.mockResolvedValueOnce({ status: 200, data: toolDetail });
        await expect(getToolDetailAdminAction(42)).resolves.toEqual(toolDetail);
        expect(request).toHaveBeenLastCalledWith(
            expect.objectContaining({
                url: `${HttpAPIRoutes.ADMIN_TOOLS}/42`,
                method: "GET",
            }),
        );

        request.mockResolvedValueOnce({ status: 204, data: undefined });
        await expect(deleteToolAdminAction(42)).resolves.toBeUndefined();
        expect(request).toHaveBeenLastCalledWith(
            expect.objectContaining({
                url: `${HttpAPIRoutes.ADMIN_TOOLS}/42`,
                method: "DELETE",
            }),
        );
    });

    it("surfaces validation, permission, and domain errors from the API", async () => {
        request.mockRejectedValueOnce(toActionError({
            status: 400,
            rawData: {
                code: "VALIDATION_ERROR",
                status: 400,
                detail: "Payload inválido.",
                errors: [{ field: "name", code: "NotBlank", message: "O nome da ferramenta é obrigatório" }],
            },
        }));
        await expect(createToolAdminAction(7, { name: "" })).rejects.toThrow(
            "O nome da ferramenta é obrigatório",
        );

        request.mockRejectedValueOnce(toActionError({
            status: 403,
            rawData: {
                code: "ACCESS_DENIED",
                status: 403,
                detail: "",
            },
        }));
        await expect(deleteToolAdminAction(42)).rejects.toThrow(
            "Você não tem permissão para realizar esta ação.",
        );

        request.mockRejectedValueOnce(toActionError({
            status: 409,
            rawData: {
                code: "TOOL_OWNER_DISABLED",
                status: 409,
                detail: "Proprietário da ferramenta está desabilitado.",
            },
        }));
        await expect(createToolAdminAction(9, { name: "Guincho" })).rejects.toThrow(
            "Proprietário da ferramenta está desabilitado.",
        );

        request.mockRejectedValueOnce(toActionError({
            status: 404,
            rawData: {
                code: "TOOL_NOT_FOUND",
                status: 404,
                detail: "Tool not found.",
            },
        }));
        await expect(activateToolAdminAction(999)).rejects.toThrow("Ferramenta não encontrada.");
    });

    it("validates createAdminToolFormSchema fields properly", () => {
        expect(
            createAdminToolFormSchema.safeParse({
                userId: "7",
                name: "  Macaco Jacaré  ",
                description: "  2 toneladas ",
            }),
        ).toEqual({
            success: true,
            data: {
                userId: 7,
                name: "Macaco Jacaré",
                description: "2 toneladas",
                photo: undefined,
                removePhoto: undefined,
            },
        });

        const invalidOwner = createAdminToolFormSchema.safeParse({
            userId: "0",
            name: "Macaco",
        });
        expect(invalidOwner.success).toBe(false);

        const emptyName = createAdminToolFormSchema.safeParse({
            userId: "7",
            name: "   ",
        });
        expect(emptyName.success).toBe(false);
    });
});
