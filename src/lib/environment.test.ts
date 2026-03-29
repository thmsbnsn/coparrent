import { describe, expect, it } from "vitest";
import { getEnvironmentFromHostname } from "@/lib/environment";

describe("environment host detection", () => {
  it("treats canonical production hosts as production", () => {
    expect(getEnvironmentFromHostname("coparrent.com")).toBe("production");
    expect(getEnvironmentFromHostname("www.coparrent.com")).toBe("production");
    expect(getEnvironmentFromHostname("coparrent.vercel.app")).toBe("production");
  });

  it("treats preview vercel hosts as staging", () => {
    expect(getEnvironmentFromHostname("coparrent-lp7hjcv30-thomas-projects-6401cf21.vercel.app")).toBe("staging");
    expect(getEnvironmentFromHostname("preview-coparrent.vercel.app")).toBe("staging");
  });

  it("treats unknown hosts as development", () => {
    expect(getEnvironmentFromHostname("localhost")).toBe("development");
    expect(getEnvironmentFromHostname("example.test")).toBe("development");
  });
});
