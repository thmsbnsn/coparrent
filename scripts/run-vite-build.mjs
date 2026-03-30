import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const childProcess = require("node:child_process");
const originalExec = childProcess.exec;

if (process.platform === "win32") {
  childProcess.exec = function patchedExec(command, ...args) {
    if (command === "net use") {
      const callback = args.find((arg) => typeof arg === "function");
      const child = {
        pid: undefined,
        stdin: null,
        stdout: null,
        stderr: null,
        kill() {
          return true;
        },
        on() {
          return this;
        },
        once() {
          return this;
        },
        addListener() {
          return this;
        },
        removeListener() {
          return this;
        },
      };

      queueMicrotask(() => {
        callback?.(new Error("spawn EPERM"), "", "");
      });

      return child;
    }

    return originalExec.call(this, command, ...args);
  };
}

const [{ build }, { default: configExport }] = await Promise.all([
  import("vite"),
  import("../vite.config.ts"),
]);

const mode = process.env.MODE ?? process.env.NODE_ENV ?? "production";

const config =
  typeof configExport === "function"
    ? await configExport({
        command: "build",
        mode,
        isSsrBuild: false,
        isPreview: false,
      })
    : configExport;

await build({
  configFile: false,
  ...config,
});
