"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Action entry point.
 *
 * The bootstrap lives here rather than in index.ts so that importing `run` — which the
 * e2e suites do — never executes the action as a side effect. The previous arrangement
 * called run() at the bottom of index.ts behind a SKIP_RUN env guard, but a test can only
 * set that guard in beforeAll, which runs *after* the import. So run() fired at import
 * time with unconfigured mocks, failed, and left a stray core.setFailed() call that made
 * a later assertion fail for reasons unrelated to the test.
 */
const index_1 = require("./index");
(0, index_1.run)();
//# sourceMappingURL=main.js.map