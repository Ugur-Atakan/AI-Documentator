import * as fs from "fs";
import * as path from "path";
const RETRY_FILE = ".documentator_failed.json";
function getRetryPath() {
    return path.join(process.cwd(), RETRY_FILE);
}
/** Save failed endpoint IDs after a run */
export function saveFailedEndpoints(failed) {
    if (failed.length === 0) {
        // Clean up if no failures
        try {
            fs.unlinkSync(getRetryPath());
        }
        catch { }
        return;
    }
    const ids = failed.map((t) => t.endpoint.id);
    fs.writeFileSync(getRetryPath(), JSON.stringify(ids, null, 2), "utf-8");
}
/** Load failed endpoint IDs from previous run */
export function loadFailedEndpointIds() {
    const retryPath = getRetryPath();
    if (!fs.existsSync(retryPath))
        return null;
    try {
        const raw = fs.readFileSync(retryPath, "utf-8");
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
/** Filter task queue to only include previously failed endpoints */
export function filterToFailed(taskQueue, failedIds) {
    const idSet = new Set(failedIds);
    return taskQueue.filter((t) => idSet.has(t.endpoint.id));
}
export function hasRetryFile() {
    return fs.existsSync(getRetryPath());
}
export function getFailedCount() {
    const ids = loadFailedEndpointIds();
    return ids?.length ?? 0;
}
