import { fn } from "storybook/test";

export const changeVehicleStatusAction = fn<typeof import("../change-status").changeVehicleStatusAction>(async () => {
    throw new Error("A alteração de situação está indisponível nesta demonstração.");
});
