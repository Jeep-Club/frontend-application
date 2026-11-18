"use server";

import { z } from "zod";
import { TOOL_STATUS_LABEL } from "@/components/pages/admin/ferramentas/toolDisplay";
import { listAdminToolsResponseSchema } from "@/schemas/admin/tools";
import { toolStatusSchema } from "@/schemas/tools/list";
import { getAdminPdfIdentity } from "@/server/utils/adminExportPdf";
import actionFetchWrapper from "@/services/fetchWrapper/actionFetchWrapper";
import { buildAdminTablePdfFile } from "@/utils/admin-export/usersPdf";
import { ActionError } from "@/utils/http/ActionError";
import { HttpAPIRoutes } from "@/utils/http/api";
import { haveActionPermission } from "@/utils/permission/actionPermissions";

const exportFilters = z.object({ name: z.string().trim().optional(), status: toolStatusSchema.optional() });

export async function exportAdminToolsAction(format: "CSV" | "PDF", input: z.input<typeof exportFilters> = {}) {
    if (!await haveActionPermission("TOOLS", "TOOL_READ") || !await haveActionPermission("TOOLS", "TOOL_EXPORT")) {
        throw new ActionError("Acesso não permitido para exportar ferramentas.");
    }

    z.enum(["CSV", "PDF"]).parse(format);
    const { name, status } = exportFilters.parse(input);
    const params = new URLSearchParams({ size: "50" });
    if (name) params.set("name", name);
    if (status) params.set("status", status);

    const table = { columns: ["ID", "Ferramenta", "ID do proprietário", "Status"], rows: [] as string[][] };
    let totalPages = 1;
    for (let page = 0; page < totalPages; page++) {
        params.set("page", String(page));
        const { data } = await actionFetchWrapper({
            url: `${HttpAPIRoutes.ADMIN_TOOLS}?${params}`,
            method: "GET",
            schema: listAdminToolsResponseSchema,
            cache: "no-store",
        });
        if (page === 0) totalPages = data.totalPages;
        for (const tool of data.content) {
            table.rows.push([String(tool.id), tool.name, String(tool.userId), TOOL_STATUS_LABEL[tool.status]]);
        }
    }

    if (format === "CSV") {
        const escapeCell = (value: string) => {
            const safeValue = /^\s*[=+@-]|^[\t\r\n]/.test(value) ? `'${value}` : value;
            return `"${safeValue.replace(/"/g, '""')}"`;
        };
        const csv = [table.columns, ...table.rows].map(row => row.map(escapeCell).join(";")).join("\r\n");
        return { base64: Buffer.from(`\uFEFF${csv}\r\n`, "utf8").toString("base64"), contentType: "text/csv;charset=UTF-8", filename: "ferramentas.csv" };
    }

    const { exportedBy, seal } = await getAdminPdfIdentity();
    return buildAdminTablePdfFile(table, {
        title: "Relatório administrativo de ferramentas",
        recordLabel: "ferramenta(s)",
        filename: "ferramentas",
        exportedBy,
        seal,
        filters: [name && `Nome: ${name}`, status && `Status: ${TOOL_STATUS_LABEL[status]}`].filter((label): label is string => Boolean(label)),
    });
}
