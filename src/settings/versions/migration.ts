import {
    settingsSchema as settingsSchemaV1
} from "./v1/v1";

export const isSettingsV1 = (settings: object): boolean => {
    const result = settingsSchemaV1.safeParse(settings);
    return result.success;
}
