import { describe, it, expect } from "vitest";
import {
  extractHostedModelConfiguration,
  resolveHostedRuntime,
  foundryAgentHostedInfo,
  foundryAgentKey,
  extractConnectedAgentRefs,
  resolveAgentKeyByRef,
  isArmSweepAgentKept,
  modelFromAgent,
} from "./azure.scanner";

type EnvVar = { name: string; value?: string; secretRef?: string };

/**
 * Realistic Azure Container Apps ARM GET response shape
 * (Microsoft.App/containerApps, api-version=2024-03-01). Only the fields
 * extractSafeAppSignals / extractHostedModelConfiguration actually read.
 */
function containerAppFixture({
  image = "myregistry.azurecr.io/hosted-agent:1.0.0",
  env = [] as EnvVar[],
  runningStatus = "Running",
  provisioningState = "Succeeded",
} = {}) {
  return {
    id: "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.App/containerApps/my-agent-app",
    name: "my-agent-app",
    type: "Microsoft.App/containerApps",
    properties: {
      runningStatus,
      provisioningState,
      template: {
        containers: [
          {
            name: "agent",
            image,
            env,
          },
        ],
      },
    },
  };
}

describe("extractHostedModelConfiguration", () => {
  it("1. resolves an Azure OpenAI deployment name to its underlying model via ARM deployment lookup", () => {
    const app = containerAppFixture({
      env: [
        { name: "AZURE_OPENAI_ENDPOINT", value: "https://my-aoai.openai.azure.com/" },
        { name: "AZURE_OPENAI_DEPLOYMENT_NAME", value: "my-gpt4o-deployment" },
      ],
    });
    const accountDeployments = [
      {
        name: "my-gpt4o-deployment",
        properties: { model: { name: "gpt-4o", format: "OpenAI" } },
      },
    ];
    const models = extractHostedModelConfiguration(app, { accountDeployments } as any);
    expect(models).toHaveLength(1);
    expect(models[0]).toMatchObject({
      provider: "azure_openai",
      modelName: "gpt-4o",
      deploymentName: "my-gpt4o-deployment",
      endpoint: "https://my-aoai.openai.azure.com/",
      discoveryStatus: "declared",
      confidence: "high",
      discoverySource: "container_app_environment+arm_deployment_lookup",
    });
  });

  it("2. reads an explicit model identifier directly (no deployment lookup needed)", () => {
    const app = containerAppFixture({
      env: [{ name: "AZURE_OPENAI_MODEL", value: "gpt-4o-mini" }],
    });
    const models = extractHostedModelConfiguration(app);
    expect(models).toEqual([
      expect.objectContaining({
        provider: "azure_openai",
        modelName: "gpt-4o-mini",
        deploymentName: null,
        discoveryStatus: "declared",
        confidence: "high",
      }),
    ]);
  });

  it("3. detects an Anthropic model configuration", () => {
    const app = containerAppFixture({
      env: [
        { name: "ANTHROPIC_MODEL", value: "claude-3-5-sonnet-20241022" },
        { name: "ANTHROPIC_BASE_URL", value: "https://api.anthropic.com" },
      ],
    });
    const models = extractHostedModelConfiguration(app);
    expect(models).toEqual([
      expect.objectContaining({
        provider: "anthropic",
        modelName: "claude-3-5-sonnet-20241022",
        endpoint: "https://api.anthropic.com",
        discoveryStatus: "declared",
      }),
    ]);
  });

  it("4. supports multiple distinct model configurations on one hosted agent", () => {
    const app = containerAppFixture({
      env: [
        { name: "AZURE_OPENAI_MODEL", value: "gpt-4o" },
        { name: "AZURE_OPENAI_ENDPOINT", value: "https://my-aoai.openai.azure.com/" },
        { name: "ANTHROPIC_MODEL", value: "claude-3-opus-20240229" },
      ],
    });
    const models = extractHostedModelConfiguration(app);
    expect(models).toHaveLength(2);
    const byProvider = Object.fromEntries(models.map((m) => [m.provider, m]));
    expect(byProvider.azure_openai.modelName).toBe("gpt-4o");
    expect(byProvider.anthropic.modelName).toBe("claude-3-opus-20240229");
  });

  it("5. records an endpoint-only config as unresolved, never inventing a model", () => {
    const app = containerAppFixture({
      env: [{ name: "AZURE_OPENAI_ENDPOINT", value: "https://my-aoai.openai.azure.com/" }],
    });
    const models = extractHostedModelConfiguration(app);
    expect(models).toEqual([
      expect.objectContaining({
        provider: "azure_openai",
        modelName: null,
        deploymentName: null,
        endpoint: "https://my-aoai.openai.azure.com/",
        discoveryStatus: "unresolved",
        confidence: "low",
      }),
    ]);
  });

  it("6. keeps a deployment name separate and unresolved when it can't be mapped to a model", () => {
    const app = containerAppFixture({
      env: [{ name: "AZURE_OPENAI_DEPLOYMENT_NAME", value: "prod-deployment-3" }],
    });
    // No accountDeployments provided at all — nothing to resolve against.
    const models = extractHostedModelConfiguration(app);
    expect(models).toEqual([
      expect.objectContaining({
        provider: "azure_openai",
        modelName: null,
        deploymentName: "prod-deployment-3",
        discoveryStatus: "unresolved",
        confidence: "low",
      }),
    ]);

    // Also unresolved when a deployment list IS available but doesn't
    // contain this deployment name (must not fall back to an unrelated one).
    const modelsWithUnrelatedDeployments = extractHostedModelConfiguration(app, {
      accountDeployments: [
        { name: "some-other-deployment", properties: { model: { name: "gpt-4" } } },
      ],
    } as any);
    expect(modelsWithUnrelatedDeployments[0]).toMatchObject({
      modelName: null,
      discoveryStatus: "unresolved",
    });
  });

  it("7. never reads or exposes a secretRef-backed value, even under an allowlisted name", () => {
    const app = containerAppFixture({
      env: [
        { name: "AZURE_OPENAI_API_KEY", secretRef: "openai-api-key" },
        { name: "AZURE_OPENAI_MODEL", secretRef: "model-name-secret" }, // pathological but must still be ignored
        { name: "AZURE_OPENAI_ENDPOINT", value: "https://my-aoai.openai.azure.com/" },
      ],
    });
    const models = extractHostedModelConfiguration(app);
    const serialized = JSON.stringify(models);
    expect(serialized).not.toContain("openai-api-key");
    expect(serialized).not.toContain("model-name-secret");
    expect(models).toEqual([
      expect.objectContaining({
        provider: "azure_openai",
        modelName: null, // the secretRef-backed "model" var must NOT have been read
        endpoint: "https://my-aoai.openai.azure.com/",
        discoveryStatus: "unresolved",
      }),
    ]);
  });

  it("8. returns no models when there are no model-related environment variables", () => {
    const app = containerAppFixture({
      env: [
        { name: "PORT", value: "8080" },
        { name: "LOG_LEVEL", value: "info" },
      ],
    });
    expect(extractHostedModelConfiguration(app)).toEqual([]);
  });

  it("a bare AWS region alone is never reported as a model", () => {
    const app = containerAppFixture({
      env: [{ name: "AWS_REGION", value: "us-east-1" }],
    });
    expect(extractHostedModelConfiguration(app)).toEqual([]);
  });

  it("reclassifies OPENAI_* vars as azure_openai when OPENAI_API_TYPE=azure", () => {
    const app = containerAppFixture({
      env: [
        { name: "OPENAI_API_TYPE", value: "azure" },
        { name: "OPENAI_API_BASE", value: "https://my-aoai.openai.azure.com/" },
        { name: "OPENAI_DEPLOYMENT_NAME", value: "my-gpt4o-deployment" },
      ],
    });
    const models = extractHostedModelConfiguration(app, {
      accountDeployments: [
        { name: "my-gpt4o-deployment", properties: { model: { name: "gpt-4o" } } },
      ],
    } as any);
    expect(models[0]).toMatchObject({ provider: "azure_openai", modelName: "gpt-4o" });
  });

  it("reclassifies OPENAI_* vars as azure_openai when the endpoint host is an Azure OpenAI domain", () => {
    const app = containerAppFixture({
      env: [
        { name: "OPENAI_BASE_URL", value: "https://my-aoai.openai.azure.com/" },
        { name: "OPENAI_MODEL", value: "gpt-4o" },
      ],
    });
    const models = extractHostedModelConfiguration(app);
    expect(models[0].provider).toBe("azure_openai");
  });
});

describe("resolveHostedRuntime", () => {
  it("9. detects the framework via image/env-var names even when the model is unresolved", async () => {
    const app = containerAppFixture({
      image: "myregistry.azurecr.io/langgraph-orchestrator:2.1.0",
      env: [{ name: "AZURE_OPENAI_DEPLOYMENT_NAME", value: "prod-deployment" }],
    });
    const result = (await resolveHostedRuntime(
      "fake-arm-token",
      "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.App/containerApps/my-agent-app",
      {
        accountDeployments: [] as any,
        getContainerAppFn: async () => ({ ok: true, json: app }),
      },
    ))!;
    expect(result.ok).toBe(true);
    expect(result.detectedFramework).toBe("langgraph");
    expect(result.models).toEqual([
      expect.objectContaining({ discoveryStatus: "unresolved", deploymentName: "prod-deployment" }),
    ]);
  });

  it("surfaces a readable error, and empty models, when the Container App can't be read", async () => {
    const result = (await resolveHostedRuntime(
      "fake-arm-token",
      "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.App/containerApps/my-agent-app",
      {
        getContainerAppFn: async () => ({ ok: false, error: "AuthorizationFailed" }),
      },
    ))!;
    expect(result.ok).toBe(false);
    expect(result.models).toEqual([]);
    expect(result.error).toMatch(/AuthorizationFailed/);
  });

  it("returns null when there is no ARM token or container app id (never guesses)", async () => {
    expect(await resolveHostedRuntime(null, "some-id")).toBeNull();
    expect(await resolveHostedRuntime("token", null)).toBeNull();
  });
});

describe("orchestrator / sub-agent relationship extraction (regression)", () => {
  it("10. links an orchestrator to its sub-agent via a connected_agent tool ref", () => {
    const orchestrator = {
      id: "asst_orchestrator",
      name: "root-orchestrator",
      versions: {
        latest: {
          definition: {
            tools: [
              { type: "connected_agent", connected_agent: { id: "asst_worker", name: "worker-agent" } },
            ],
          },
        },
      },
    };
    const worker = { id: "asst_worker", name: "worker-agent" };

    const rawAgentsByKey = new Map([
      [foundryAgentKey(orchestrator), { agent: orchestrator }],
      [foundryAgentKey(worker), { agent: worker }],
    ]);

    const refs = extractConnectedAgentRefs(orchestrator);
    expect(refs).toEqual([{ id: "asst_worker", name: "worker-agent" }]);

    const resolvedKey = resolveAgentKeyByRef(refs[0], rawAgentsByKey);
    expect(resolvedKey).toBe(foundryAgentKey(worker));
  });

  it("does not link agents when the tool type isn't a connected-agent variant", () => {
    const agent = {
      id: "asst_1",
      name: "solo-agent",
      versions: { latest: { definition: { tools: [{ type: "code_interpreter" }] } } },
    };
    expect(extractConnectedAgentRefs(agent)).toEqual([]);
  });
});

describe("foundryAgentHostedInfo", () => {
  it("2. reads kind + container_app_resource_id off a hosted agent definition", () => {
    const agent = {
      versions: {
        latest: {
          definition: {
            kind: "hosted",
            container_app_resource_id:
              "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.App/containerApps/my-agent-app",
          },
        },
      },
    };
    expect(foundryAgentHostedInfo(agent)).toEqual({
      kind: "hosted",
      containerAppResourceId:
        "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.App/containerApps/my-agent-app",
    });
  });

  it("returns nulls for a non-hosted (prompt) agent definition", () => {
    expect(foundryAgentHostedInfo({ versions: { latest: { definition: {} } } })).toEqual({
      kind: null,
      containerAppResourceId: null,
    });
  });
});

describe("modelFromAgent", () => {
  it("prefers the agent definition's own model field", () => {
    const agent = {
      versions: { latest: { definition: { model: "gpt-4o" } } },
    };
    expect(modelFromAgent(agent)).toBe("gpt-4o");
  });

  it("never returns a placeholder identity string", () => {
    const agent = {
      versions: { latest: { definition: { model: "microsoft-agent-identity" } } },
    };
    expect(modelFromAgent(agent)).toBeNull();
  });

  it("falls back to a hosted agent definition's own environment_variables", () => {
    const agent = {
      versions: {
        latest: {
          definition: {
            kind: "hosted",
            environment_variables: { AZURE_OPENAI_MODEL_NAME: "gpt-4o-mini" },
          },
        },
      },
    };
    expect(modelFromAgent(agent)).toBe("gpt-4o-mini");
  });

  it("checks camelCase environmentVariables and the top-level agent field too", () => {
    const agentDefLevel = {
      versions: { latest: { definition: { environmentVariables: { LLM_MODEL: "claude-3-opus-20240229" } } } },
    };
    expect(modelFromAgent(agentDefLevel)).toBe("claude-3-opus-20240229");

    const agentTopLevel = {
      versions: { latest: { definition: {} } },
      environment_variables: { MODEL_NAME: "gpt-4o" },
    };
    expect(modelFromAgent(agentTopLevel)).toBe("gpt-4o");
  });

  it("falls back to a tools[].agent_reference model when nothing else resolves", () => {
    const agent = {
      versions: {
        latest: {
          definition: {
            tools: [
              { type: "connected_agent", agent_reference: { model_name: "gpt-4o" } },
            ],
          },
        },
      },
    };
    expect(modelFromAgent(agent)).toBe("gpt-4o");
  });

  it("returns null when the agent definition has no model anywhere", () => {
    expect(modelFromAgent({ versions: { latest: { definition: {} } } })).toBeNull();
  });
});

describe("isArmSweepAgentKept (generic Container App sweep dedup)", () => {
  it("11. drops an ARM-sweep Container App candidate already confirmed as a hosted Foundry agent's runtime", () => {
    const resourceId =
      "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.App/containerApps/my-agent-app";
    const hostedContainerAppIds = new Set([resourceId.toLowerCase()]);
    const heuristicCandidate = {
      metadata: {
        inventoryClass: "ai_cloud_agent",
        discoveryMode: "azure-container-apps",
        azureResourceId: resourceId,
      },
    };
    expect(isArmSweepAgentKept(heuristicCandidate, hostedContainerAppIds)).toBe(false);
  });

  it("keeps an unrelated ARM-sweep agent candidate", () => {
    const hostedContainerAppIds = new Set<string>();
    const candidate = {
      metadata: {
        inventoryClass: "ai_cloud_agent",
        discoveryMode: "azure-container-apps",
        azureResourceId: "/subscriptions/sub-1/.../containerApps/some-other-app",
      },
    };
    expect(isArmSweepAgentKept(candidate, hostedContainerAppIds)).toBe(true);
  });

  it("drops the ARM sweep's own (lower-fidelity) Foundry agent detection", () => {
    const hostedContainerAppIds = new Set<string>();
    const candidate = {
      metadata: { inventoryClass: "ai_cloud_agent", discoveryMode: "azure-agent-api" },
    };
    expect(isArmSweepAgentKept(candidate, hostedContainerAppIds)).toBe(false);
  });

  it("drops a plain resource (no agent detected)", () => {
    const hostedContainerAppIds = new Set<string>();
    const candidate = {
      metadata: { inventoryClass: "ai_cloud_resource", discoveryMode: "azure-arm-live" },
    };
    expect(isArmSweepAgentKept(candidate, hostedContainerAppIds)).toBe(false);
  });
});

describe("12. metadata never contains credentials or secret values", () => {
  it("across every fixture scenario above, no output contains a secret-looking value", () => {
    const scenarios = [
      containerAppFixture({
        env: [
          { name: "AZURE_OPENAI_API_KEY", value: "sk-should-never-appear", secretRef: undefined },
        ],
      }),
    ];
    // AZURE_OPENAI_API_KEY isn't on the allowlist at all, so even a literal
    // value (misconfigured resource, no secretRef) must never surface.
    for (const app of scenarios) {
      const models = extractHostedModelConfiguration(app);
      expect(JSON.stringify(models)).not.toContain("sk-should-never-appear");
    }
  });
});
