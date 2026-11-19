import { exportAdminVehiclesAction } from "@/server/actions/admin/vehicles/export";
import actionFetchWrapper from "@/services/fetchWrapper/actionFetchWrapper";
import { haveActionPermission } from "@/utils/permission/actionPermissions";

jest.mock("@/services/fetchWrapper/actionFetchWrapper", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("@/utils/permission/actionPermissions", () => ({ haveActionPermission: jest.fn() }));

beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(haveActionPermission).mockResolvedValue(true);
});

it("requires VEHICLES_VEHICLE_EXPORT permission before calling the API", async () => {
    jest.mocked(haveActionPermission).mockResolvedValue(false);

    await expect(exportAdminVehiclesAction("CSV")).rejects.toThrow("Acesso não permitido");
    expect(haveActionPermission).toHaveBeenCalledWith("VEHICLES", "VEHICLE_EXPORT");
    expect(actionFetchWrapper).not.toHaveBeenCalled();
});

it("exports CSV from GET /vehicles/admin/export without filters", async () => {
    jest.mocked(actionFetchWrapper).mockResolvedValue({
        status: 200,
        data: new Blob(["ID;Placa\r\n1;JEP1A11\r\n"], { type: "text/csv;charset=UTF-8" }),
        contentDisposition: 'attachment; filename="veiculos-2026-11-18.csv"',
    });

    const file = await exportAdminVehiclesAction("CSV");

    expect(actionFetchWrapper).toHaveBeenCalledWith({
        url: "vehicles/admin/export?format=CSV",
        method: "GET",
        schema: expect.anything(),
        responseType: "blob",
        allowedContentTypes: ["text/csv"],
        cache: "no-store",
    });
    expect(file.filename).toBe("veiculos-2026-11-18.csv");
    expect(file.contentType).toContain("text/csv");
    expect(Buffer.from(file.base64, "base64").toString("utf8")).toContain("JEP1A11");
});

it("sends deduplicated repeatable vehicleIds, ownerIds and towing=true for PDF export", async () => {
    jest.mocked(actionFetchWrapper).mockResolvedValue({
        status: 200,
        data: new Blob(["%PDF-1.4\n"], { type: "application/pdf" }),
        contentDisposition: 'attachment; filename="veiculos-2026-11-18.pdf"',
    });

    const file = await exportAdminVehiclesAction("PDF", {
        vehicleIds: [1, 3, 1],
        ownerIds: [3, 4, 3],
        towing: "YES",
    });

    expect(actionFetchWrapper).toHaveBeenCalledWith({
        url: "vehicles/admin/export?format=PDF&vehicleIds=1&vehicleIds=3&ownerIds=3&ownerIds=4&towing=true",
        method: "GET",
        schema: expect.anything(),
        responseType: "blob",
        allowedContentTypes: ["application/pdf"],
        cache: "no-store",
    });
    expect(file.filename).toBe("veiculos-2026-11-18.pdf");
    expect(file.contentType).toBe("application/pdf");
    expect(Buffer.from(file.base64, "base64").toString("latin1")).toMatch(/^%PDF-/);
});

it("sends towing=false when NO is selected and falls back to default filename", async () => {
    jest.mocked(actionFetchWrapper).mockResolvedValue({
        status: 200,
        data: new Blob(["ID;Placa\r\n"], { type: "" }),
    });

    const file = await exportAdminVehiclesAction("CSV", { towing: "NO" });

    expect(actionFetchWrapper).toHaveBeenCalledWith(
        expect.objectContaining({
            url: "vehicles/admin/export?format=CSV&towing=false",
        }),
    );
    expect(file.contentType).toBe("text/csv");
    expect(file.filename).toBe("veiculos.csv");
});

it("rejects more than 200 unique IDs or invalid IDs before requesting the backend", async () => {
    const tooMany = Array.from({ length: 201 }, (_, index) => index + 1);

    await expect(exportAdminVehiclesAction("CSV", { vehicleIds: tooMany })).rejects.toThrow("200");
    await expect(exportAdminVehiclesAction("CSV", { ownerIds: [0] })).rejects.toThrow();
    expect(actionFetchWrapper).not.toHaveBeenCalled();
});
