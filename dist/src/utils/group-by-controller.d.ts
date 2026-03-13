import type { ParsedEndpoint } from "../types/endpoint.js";
import type { ControllerGroup } from "../types/controller-group.js";
/**
 * Groups parsed endpoints by their controller class.
 * Each group contains all endpoints from one controller, ready for
 * per-controller processing in the multi-agent pipeline.
 */
export declare function groupByController(endpoints: ParsedEndpoint[]): ControllerGroup[];
/**
 * Derives the per-controller file name prefix from the controller class name.
 *
 * Examples:
 *   UserController      → "user"
 *   MailboxController   → "mailbox"
 *   AdminUsersController → "admin-users"
 */
export declare function controllerToKebab(controllerClass: string): string;
