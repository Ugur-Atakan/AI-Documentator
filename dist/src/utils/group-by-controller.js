import * as path from "path";
/**
 * Extract the module/feature name from a controller file path.
 *
 * Examples:
 *   /project/src/modules/mailbox/mailbox.controller.ts  → "mailbox"
 *   /project/src/modules/admin/admin.controller.ts      → "admin"
 *   /project/src/auth/auth.controller.ts                → "auth"
 *   /project/src/app.controller.ts                      → "app"
 */
function extractModuleName(controllerFilePath) {
    const dir = path.dirname(controllerFilePath);
    return path.basename(dir);
}
/**
 * Groups parsed endpoints by their controller class.
 * Each group contains all endpoints from one controller, ready for
 * per-controller processing in the multi-agent pipeline.
 */
export function groupByController(endpoints) {
    const map = new Map();
    for (const ep of endpoints) {
        const existing = map.get(ep.controllerClass);
        if (existing) {
            existing.endpoints.push(ep);
        }
        else {
            map.set(ep.controllerClass, {
                controllerClass: ep.controllerClass,
                controllerFilePath: ep.controllerFilePath,
                moduleName: extractModuleName(ep.controllerFilePath),
                endpoints: [ep],
            });
        }
    }
    return Array.from(map.values());
}
/**
 * Derives the per-controller file name prefix from the controller class name.
 *
 * Examples:
 *   UserController      → "user"
 *   MailboxController   → "mailbox"
 *   AdminUsersController → "admin-users"
 */
export function controllerToKebab(controllerClass) {
    return controllerClass
        .replace(/Controller$/, "")
        .replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`)
        .replace(/^-/, "");
}
