import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { discoveryAPI, auditAPI } from '../../lib/api';
import type { DiscoveredAgent } from '../../types/discovery';
import {
  ArrowLeft, AlertTriangle, Network
} from 'lucide-react';

type NodeType = 'agent' | 'account' | 'model' | 'role' | 'data' | 'risk' | 'agents';

interface RelatedAgentRef {
  agentId: string;
  name?: string | null;
}

export default function AgentLineage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<DiscoveredAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<NodeType>('agent');

  useEffect(() => {
    if (!id) return;
    
    discoveryAPI.getAgent(id)
    .then(res => {
      setAgent(res.data.agent);
      setLoading(false);

      auditAPI.logBusinessEvent({
        eventType: 'agent.viewed.lineage',
        entityType: 'agent',
        entityId: id,
        summary: `User checked data lineage graph for ${res.data.agent.name || id}`
      }).catch(err => console.error('Failed to log business event', err));
    })
    .catch(err => {
      console.error("Failed to load agent details", err);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="p-6 text-center text-slate-500">
        Agent not found.
      </div>
    );
  }

  const metadata = agent.metadata || {};
  const providerLabel = agent.provider || agent.cloud_provider || "Agent";
  const shadowScore =
    agent.confidence_score !== null && agent.confidence_score < 1
      ? (1 - agent.confidence_score).toFixed(2)
      : agent.confidence_score !== null
        ? "0.00"
        : "Unknown";

  // Sub-agent / orchestrator relationships (Azure AI Foundry "connected
  // agent" pattern — see azure.scanner.ts Phase 2). Populated on
  // metadata.subAgents (agents this one calls) and metadata.calledByAgents
  // (agents that call this one as a sub-agent).
  const subAgents: RelatedAgentRef[] = Array.isArray(metadata.subAgents) ? metadata.subAgents : [];
  const calledByAgents: RelatedAgentRef[] = Array.isArray(metadata.calledByAgents) ? metadata.calledByAgents : [];
  const isOrchestrator = subAgents.length > 0;
  const isSubAgent = metadata.isSubAgent === true || calledByAgents.length > 0;
  const hasAgentRelationships = isOrchestrator || isSubAgent;

  // Coordinates for the graph nodes
  const nodes = {
    agent: { x: '50%', y: '45%' },
    account: { x: '20%', y: '20%' },
    model: { x: '80%', y: '20%' },
    role: { x: '20%', y: '70%' },
    data: { x: '80%', y: '70%' },
    risk: { x: '50%', y: '85%' },
    agents: { x: '50%', y: '8%' },
  };

  const NodeCard = ({ type, x, y, icon: Icon, title, subtitle, topLabel, bg, iconColor }: any) => {
    const isSelected = selectedNode === type;
    
    return (
      <div 
        onClick={() => setSelectedNode(type)}
        className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer w-64 rounded-xl p-4 transition-all duration-200 z-10
          ${isSelected 
            ? 'bg-blue-50 border-2 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)] scale-105' 
            : 'bg-white border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md'
          }
        `}
        style={{ left: x, top: y }}
      >
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 rounded-lg px-2 py-1 text-xs font-bold shrink-0 ${bg} ${iconColor}`}>
            {topLabel || <Icon size={16} />}
          </div>
          <div className="min-w-0">
            <h3 className={`font-bold text-sm truncate ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>{title}</h3>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">{subtitle}</p>
          </div>
        </div>
      </div>
    );
  };

  const renderDrawerContent = () => {
    switch(selectedNode) {
      case 'agent':
        return (
          <>
            <h2 className="text-sm font-bold text-slate-800 pb-3 border-b border-slate-200 mb-6">{providerLabel} Agent (Core Asset)</h2>
            <div className="space-y-6">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Name</div>
                <div className="text-sm font-semibold text-slate-800">{agent.name || 'Unknown Agent'}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Agent ID</div>
                <div className="text-sm font-semibold text-slate-800">{agent.fingerprint}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">ARN</div>
                <div className="text-xs font-mono text-slate-600 break-all">{metadata.deep?.agentArn || 'N/A'}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Status</div>
                <div className="text-sm font-semibold text-slate-800 uppercase">{agent.status}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Runtime Status</div>
                <div className="text-sm font-semibold text-slate-800">{metadata.deep?.agentRuntimeStatus || 'Unknown'}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Aliases</div>
                <div className="text-sm font-semibold text-slate-800">{metadata.aliases?.join(', ') || 'None'}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">First Discovered</div>
                <div className="text-sm font-semibold text-slate-800">{new Date(agent.created_at).toLocaleString()}</div>
              </div>
            </div>
          </>
        );
      case 'account':
        return (
          <>
            <h2 className="text-sm font-bold text-slate-800 pb-3 border-b border-slate-200 mb-6">{providerLabel} Cloud Infrastructure</h2>
            <div className="space-y-6">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Provider</div>
                <div className="text-sm font-semibold text-slate-800">{providerLabel}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Account ID</div>
                <div className="text-sm font-semibold text-slate-800">{metadata.adversarial_surface?.platform?.account_id || 'Unknown'}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Region</div>
                <div className="text-sm font-semibold text-slate-800">{agent.region || 'Unknown'}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Discovery Collector</div>
                <div className="text-sm font-semibold text-slate-800">{agent.source_collectors?.length ? agent.source_collectors.join(', ') : 'Unknown'}</div>
              </div>
            </div>
          </>
        );
      case 'model':
        return (
          <>
            <h2 className="text-sm font-bold text-slate-800 pb-3 border-b border-slate-200 mb-6">Foundation Model Upstream</h2>
            <div className="space-y-6">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Model ID</div>
                <div className="text-sm font-semibold text-slate-800">{agent.model || 'Unknown'}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Provider</div>
                <div className="text-sm font-semibold text-slate-800">{providerLabel}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Deployment Type</div>
                <div className="text-sm font-semibold text-slate-800">{agent.deployment_type || 'Cloud'}</div>
              </div>
            </div>
          </>
        );
      case 'role':
        return (
          <>
            <h2 className="text-sm font-bold text-slate-800 pb-3 border-b border-slate-200 mb-6">Execution Role</h2>
            <div className="space-y-6">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Role Name</div>
                <div className="text-sm font-semibold text-slate-800">{metadata.deep?.agentResourceRoleArn ? metadata.deep.agentResourceRoleArn.split('/').pop() : 'Unknown'}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">ARN</div>
                <div className="text-xs font-mono text-slate-600 break-all">{metadata.deep?.agentResourceRoleArn || 'N/A'}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Access Status</div>
                <div className={`text-sm font-bold ${metadata.deep?.agentResourceRoleArn ? 'text-green' : 'text-slate-400'}`}>
                  {metadata.deep?.agentResourceRoleArn ? 'Role Attached' : 'No Role Detected'}
                </div>
              </div>
            </div>
          </>
        );
      case 'data':
        return (
          <>
            <h2 className="text-sm font-bold text-slate-800 pb-3 border-b border-slate-200 mb-6">Connected Tools & Data Stores</h2>
            <div className="space-y-6">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">MCP Connections</div>
                <div className="text-sm font-semibold text-slate-800">{agent.mcp_connections?.length || 0}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Vector Databases</div>
                <div className="text-sm font-semibold text-slate-800">Unknown</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Tools Configured</div>
                <div className="text-sm font-semibold text-slate-800">{agent.tools?.length || 0}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Database Access</div>
                <div className="text-sm font-semibold text-slate-800">{agent.database_access ? 'True' : 'False'}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">PHI / PII Detected</div>
                <div className="text-sm font-semibold text-slate-800">
                  {agent.data_access_classification?.phi_access || agent.data_access_classification?.pii_access ? 'True' : 'False'}
                </div>
              </div>
            </div>
          </>
        );
      case 'risk':
        return (
          <>
            <h2 className="text-sm font-bold text-slate-800 pb-3 border-b border-slate-200 mb-6">Governance & Risk Indicators</h2>
            <div className="space-y-6">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Shadow AI Status</div>
                <div className="text-sm font-semibold text-slate-800">{agent.status === 'shadow' ? 'True' : 'False'}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Ownership Status</div>
                <div className="text-sm font-semibold text-slate-800">{agent.owner ? 'Owned' : 'Ownerless'}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Shadow Score</div>
                <div className="text-sm font-semibold text-slate-800">{shadowScore}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Confidence Score</div>
                <div className="text-sm font-semibold text-slate-800">{agent.confidence_score !== null ? Number(agent.confidence_score).toFixed(3) : 'Unknown'}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Risk Indicators</div>
                <div className="text-sm font-semibold text-slate-800">{agent.status === 'shadow' ? 'shadow_ai, ' : ''}{!agent.owner ? 'ownerless, cloud_ai_ownerless' : 'none'}</div>
              </div>
            </div>
          </>
        );
      case 'agents':
        return (
          <>
            <h2 className="text-sm font-bold text-slate-800 pb-3 border-b border-slate-200 mb-6">Agent-to-Agent Relationships</h2>
            <div className="space-y-6">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Role</div>
                <div className="text-sm font-semibold text-slate-800">
                  {isOrchestrator && isSubAgent
                    ? 'Orchestrator & Sub-Agent'
                    : isOrchestrator
                      ? 'Orchestrator'
                      : isSubAgent
                        ? 'Sub-Agent'
                        : 'Standalone'}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                  Calls Sub-Agents ({subAgents.length})
                </div>
                {subAgents.length ? (
                  <ul className="space-y-1">
                    {subAgents.map((a) => (
                      <li key={a.agentId} className="text-sm font-semibold text-slate-800">{a.name || a.agentId}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-slate-400">None</div>
                )}
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                  Called By ({calledByAgents.length})
                </div>
                {calledByAgents.length ? (
                  <ul className="space-y-1">
                    {calledByAgents.map((a) => (
                      <li key={a.agentId} className="text-sm font-semibold text-slate-800">{a.name || a.agentId}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-slate-400">None</div>
                )}
              </div>
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-800">
              Data Lineage Graph: {providerLabel}
            </h1>
            <div className="text-[12px] text-slate-500 font-mono mt-0.5">
              {agent.name} ({agent.fingerprint})
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {isOrchestrator && (
            <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">ORCHESTRATOR</span>
          )}
          {isSubAgent && (
            <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">SUB-AGENT</span>
          )}
          {agent.status === 'shadow' && (
            <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">SHADOW AI</span>
          )}
          {!agent.owner && (
            <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-red/10 text-red-600 border border-red/20">OWNERLESS</span>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Side: Graph */}
        <div className="flex-1 relative bg-slate-50 overflow-hidden">
          {/* SVG Lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
            <line x1={nodes.agent.x} y1={nodes.agent.y} x2={nodes.account.x} y2={nodes.account.y} stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 4" />
            <line x1={nodes.agent.x} y1={nodes.agent.y} x2={nodes.model.x} y2={nodes.model.y} stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 4" />
            <line x1={nodes.agent.x} y1={nodes.agent.y} x2={nodes.role.x} y2={nodes.role.y} stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 4" />
            <line x1={nodes.agent.x} y1={nodes.agent.y} x2={nodes.data.x} y2={nodes.data.y} stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 4" />
            <line x1={nodes.agent.x} y1={nodes.agent.y} x2={nodes.risk.x} y2={nodes.risk.y} stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 4" />
            {hasAgentRelationships && (
              <line x1={nodes.agent.x} y1={nodes.agent.y} x2={nodes.agents.x} y2={nodes.agents.y} stroke="#818cf8" strokeWidth="2" />
            )}
          </svg>

          {/* Nodes */}
          <NodeCard
            type="account"
            x={nodes.account.x} y={nodes.account.y}
            topLabel={providerLabel.slice(0, 3).toUpperCase()} bg="bg-blue-100" iconColor="text-blue-700"
            title={`${providerLabel} Account`}
            subtitle={`Region: ${agent.region || 'Unknown'}`}
          />

          <NodeCard
            type="model"
            x={nodes.model.x} y={nodes.model.y}
            topLabel="LLM" bg="bg-green-100" iconColor="text-green-700"
            title="Foundation Model"
            subtitle={agent.model || 'Unknown Model'}
          />

          <NodeCard
            type="role"
            x={nodes.role.x} y={nodes.role.y}
            topLabel="IAM" bg="bg-amber-100" iconColor="text-amber-700"
            title="Execution Role"
            subtitle={metadata.deep?.agentResourceRoleArn ? 'Role Attached' : 'No Role Detected'}
          />

          <NodeCard
            type="data"
            x={nodes.data.x} y={nodes.data.y}
            topLabel="DB" bg="bg-slate-200" iconColor="text-slate-600"
            title="Data / Tools"
            subtitle={agent.database_access || (agent.tools && agent.tools.length > 0) ? 'Connected' : 'Isolated / No Access'}
          />
          
          <NodeCard 
            type="risk" 
            x={nodes.risk.x} y={nodes.risk.y} 
            icon={AlertTriangle} bg="bg-red-100" iconColor="text-red-600" 
            title="Governance Risk" 
            subtitle={`Score: ${shadowScore}`} 
          />

          <NodeCard
            type="agent"
            x={nodes.agent.x} y={nodes.agent.y}
            topLabel="AI" bg="bg-indigo-100" iconColor="text-indigo-700"
            title={providerLabel}
            subtitle={`Framework: ${agent.deployment_type || 'Unknown'}`}
          />

          {hasAgentRelationships && (
            <NodeCard
              type="agents"
              x={nodes.agents.x} y={nodes.agents.y}
              icon={Network} bg="bg-purple-100" iconColor="text-purple-700"
              title={isOrchestrator ? 'Calls Sub-Agents' : 'Sub-Agent Of'}
              subtitle={
                isOrchestrator && isSubAgent
                  ? `${subAgents.length} sub-agent(s), ${calledByAgents.length} parent(s)`
                  : isOrchestrator
                    ? `${subAgents.length} sub-agent(s)`
                    : `${calledByAgents.length} parent agent(s)`
              }
            />
          )}
        </div>

        {/* Right Side: Drawer */}
        <div className="w-80 bg-white border-l border-slate-200 shadow-xl z-20 flex flex-col">
          <div className="p-6 overflow-y-auto flex-1">
            {renderDrawerContent()}
          </div>
        </div>
        
      </div>
    </div>
  );
}
