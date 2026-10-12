import { describe, it, expect } from "vitest";
import { extractModelRefs } from "./discovery.service";
import type { DiscoveredAgent } from "./discovery.types";

function agentFixture(overrides: Partial<DiscoveredAgent> = {}): DiscoveredAgent {
  return {
    model: null,
    agent_config: null,
    metadata: {},
    ...overrides,
  } as DiscoveredAgent;
}

describe("extractModelRefs", () => {
  it("still extracts the primary agent.model field (existing behavior)", () => {
    const agent = agentFixture({ model: "gpt-4o" });
    expect(extractModelRefs(agent)).toEqual([{ name: "gpt-4o", context: "primary" }]);
  });

  it("still extracts agent_config.models[] (existing behavior)", () => {
    const agent = agentFixture({
      agent_config: { models: ["gpt-4o", "text-embedding-3-large"] } as any,
    });
    expect(extractModelRefs(agent)).toEqual([
      { name: "gpt-4o", context: "primary" },
      { name: "text-embedding-3-large", context: "primary" },
    ]);
  });

  it("extracts a declared hosted-runtime model with its explicit provider", () => {
    const agent = agentFixture({
      metadata: {
        hostedRuntime: {
          models: [
            {
              provider: "azure_openai",
              modelName: "gpt-4o",
              deploymentName: "my-gpt4o-deployment",
              discoveryStatus: "declared",
            },
          ],
        },
      } as any,
    });
    expect(extractModelRefs(agent)).toEqual([
      { name: "gpt-4o", context: "primary", provider: "azure_openai" },
    ]);
  });

  it("ignores unresolved hosted-runtime model entries (no modelName)", () => {
    const agent = agentFixture({
      metadata: {
        hostedRuntime: {
          models: [
            {
              provider: "azure_openai",
              modelName: null,
              deploymentName: "prod-deployment-3",
              discoveryStatus: "unresolved",
            },
          ],
        },
      } as any,
    });
    expect(extractModelRefs(agent)).toEqual([]);
  });

  it("dedupes when the same model name appears via multiple sources", () => {
    const agent = agentFixture({
      model: "gpt-4o",
      metadata: {
        hostedRuntime: {
          models: [
            { provider: "azure_openai", modelName: "gpt-4o", discoveryStatus: "declared" },
          ],
        },
      } as any,
    });
    expect(extractModelRefs(agent)).toEqual([{ name: "gpt-4o", context: "primary" }]);
  });

  it("combines multiple distinct hosted-runtime models from different providers", () => {
    const agent = agentFixture({
      metadata: {
        hostedRuntime: {
          models: [
            { provider: "azure_openai", modelName: "gpt-4o", discoveryStatus: "declared" },
            {
              provider: "anthropic",
              modelName: "claude-3-opus-20240229",
              discoveryStatus: "declared",
            },
          ],
        },
      } as any,
    });
    expect(extractModelRefs(agent)).toEqual([
      { name: "gpt-4o", context: "primary", provider: "azure_openai" },
      {
        name: "claude-3-opus-20240229",
        context: "primary",
        provider: "anthropic",
      },
    ]);
  });
});

describe("calculateAgentRiskScore", () => {
  it("calculates risk score and level correctly for an agent with assessment", async () => {
    const { calculateAgentRiskScore } = await import("../security/riskScore");
    const agent = agentFixture({
      status: "shadow",
      internet_access: true,
    });
    const assessment = {
      domains: {
        data_access: { has_pii: true },
      },
      evidence_completeness: { overall: 0.8 },
      frameworks: {
        owasp_ai_agents_2026: {
          controls: {
            ASI01: { status: "detected", name: "Prompt Injection" },
          },
        },
      },
    };

    const breakdown = calculateAgentRiskScore(agent, assessment);
    expect(breakdown).toBeDefined();
    expect(breakdown.finalScore).toBeGreaterThan(0);
    expect(["Low", "Medium", "High", "Critical"]).toContain(breakdown.riskLevel);
    expect(breakdown.components.intrinsicAttackSurface.score).toBeGreaterThan(0);
    expect(breakdown.components.governanceDeficits.score).toBeGreaterThan(0);
    expect(breakdown.components.owaspVulnerabilities.score).toBeGreaterThan(0);
  });
});
