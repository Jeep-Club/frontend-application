import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { DependentFamilyTreeView } from "./DependentFamilyTreeView";

const meta = {
    title: "Páginas/Admin/Dependentes/Árvore familiar",
    component: DependentFamilyTreeView,
    tags: ["autodocs"],
    parameters: {
        docs: {
            description: {
                component: "Apresenta o titular e seus dependentes administrativos em cartões responsivos. O contrato atual informa o parentesco de cada dependente com o titular, mas não liga dependentes entre si para representar gerações adicionais.",
            },
        },
    },
} satisfies Meta<typeof DependentFamilyTreeView>;

export default meta;
type Story = StoryObj<typeof meta>;

const relatives: AdminDependentItem[] = [
    { id: 11, userId: 7, ownerName: "Caique Silva", name: "Luana Silva", cpf: "00000000000", birthDate: "1990-04-12", relationshipType: "SPOUSE", phoneNumber: null, status: "ACTIVE", createdAt: "2026-01-10T12:00:00Z", updatedAt: null },
    { id: 12, userId: 7, ownerName: "Caique Silva", name: "Gabriel Silva", cpf: "00000000000", birthDate: "2010-08-02", relationshipType: "CHILD", phoneNumber: null, status: "ACTIVE", createdAt: "2026-01-10T12:00:00Z", updatedAt: null },
    { id: 13, userId: 7, ownerName: "Caique Silva", name: "Ana Silva", cpf: "00000000000", birthDate: "2013-05-19", relationshipType: "CHILD", phoneNumber: null, status: "ACTIVE", createdAt: "2026-01-10T12:00:00Z", updatedAt: null },
];

export const FamiliaDoTitular = {
    args: {
        ownerName: "Caique Silva",
        ownerId: 7,
        relatives,
        selectedDependentId: 12,
        onOpenDependent: fn(),
    },
} satisfies Story;

export const FamiliaPequena = {
    args: {
        ownerName: "Caique Silva",
        ownerId: 7,
        relatives: [relatives[1]],
        selectedDependentId: 12,
        onOpenDependent: fn(),
    },
} satisfies Story;
