import type { DiscoveredAgent } from '../types/discovery';

export function generatePDFReportHTML(
  agent: DiscoveredAgent,
  passes: any[],
  violations: any[],
  gaps: any[],
  highestSeverity: string,
  confidencePct: number,
  highCount: number,
  medCount: number,
  lowCount: number,
  perimeterExposureCount: number
): string {
  const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  
  const platformStr = agent.cloud_provider 
    ? `${agent.cloud_provider.toUpperCase()} ${agent.region ? `(${agent.region})` : ''}`
    : 'Unknown Platform';

  let highestSeverityColorHtml = 'text-slate-400';
  let severityIconHtml = '<i class="fa-solid fa-circle-info mr-1"></i>';
  let highestSeverityClass = 'None';
  
  if (highestSeverity === 'High') {
    highestSeverityColorHtml = 'text-rose-500';
    severityIconHtml = '<i class="fa-solid fa-triangle-exclamation mr-1"></i>';
    highestSeverityClass = 'High Risk';
  } else if (highestSeverity === 'Medium') {
    highestSeverityColorHtml = 'text-amber-400';
    severityIconHtml = '<i class="fa-solid fa-circle-exclamation mr-1"></i>';
    highestSeverityClass = 'Moderate Risk';
  } else if (highestSeverity === 'Low') {
    highestSeverityColorHtml = 'text-blue-400';
    severityIconHtml = '<i class="fa-solid fa-circle-info mr-1"></i>';
    highestSeverityClass = 'Low Risk';
  } else {
    highestSeverityClass = 'No Risk Found';
  }

  const modelStr = agent.model || 'Unknown Model';
  
  // Violations
  let violationsHtml = '';
  if (violations.length === 0) {
    violationsHtml = '<div class="text-sm text-slate-500">No security violations found.</div>';
  } else {
    violations.forEach((v) => {
      let sevColorBg = 'bg-blue-100';
      let sevColorText = 'text-blue-800';
      let sevColorBorder = 'border-blue-300';
      let wrapperBorder = 'border-blue-200';
      let wrapperBg = 'bg-blue-50/30';
      
      if (v.severity === 'high') {
        sevColorBg = 'bg-rose-100';
        sevColorText = 'text-rose-800';
        sevColorBorder = 'border-rose-300';
        wrapperBorder = 'border-rose-200';
        wrapperBg = 'bg-rose-50/30';
      } else if (v.severity === 'medium') {
        sevColorBg = 'bg-amber-100';
        sevColorText = 'text-amber-800';
        sevColorBorder = 'border-amber-300';
        wrapperBorder = 'border-amber-200';
        wrapperBg = 'bg-amber-50/30';
      }
      
      violationsHtml += `
        <div class="border ${wrapperBorder} ${wrapperBg} rounded-lg p-4 space-y-2 mb-3">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${sevColorBg} ${sevColorText} border ${sevColorBorder}">${v.severity} SEVERITY</span>
              <span class="text-xs font-bold text-slate-900">${v.label}</span>
            </div>
            <span class="text-xs font-mono text-slate-500">Field: ${v.field}</span>
          </div>
          <p class="text-xs text-slate-600 leading-relaxed">
            ${v.desc}
          </p>
        </div>
      `;
    });
  }

  // Passes
  let passesHtml = '';
  if (passes.length === 0) {
    passesHtml = '<tr><td colspan="3" class="p-3 text-slate-500 text-center">No passed controls recorded.</td></tr>';
  } else {
    passes.forEach(p => {
      passesHtml += `
        <tr>
          <td class="p-3 font-semibold text-slate-900">${p.label}</td>
          <td class="p-3 font-mono text-emerald-700">Verified</td>
          <td class="p-3 text-slate-600">${p.desc}</td>
        </tr>
      `;
    });
  }

  // Gaps
  let gapsHtml = '';
  if (gaps.length === 0) {
    gapsHtml = '<div class="col-span-full text-slate-500 text-center text-sm py-4">No governance gaps detected.</div>';
  } else {
    gaps.forEach(g => {
      gapsHtml += `
        <div class="p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <span class="text-slate-400 block text-[11px] uppercase tracking-wider">${g.label}</span>
          <span class="font-mono text-rose-600 font-semibold block mt-1">${g.field}</span>
          <span class="text-slate-500 text-[11px] mt-0.5 block">${g.desc}</span>
        </div>
      `;
    });
  }

  const promptPreview = agent.agent_config?.instructions || agent.agent_config?.prompt || "No system prompt instructions available or captured.";
  const createdDate = agent.created_at ? new Date(agent.created_at).toISOString().replace('T', ' ').substring(0, 19) + ' UTC' : 'N/A';
  const updatedDate = agent.updated_at ? new Date(agent.updated_at).toISOString().replace('T', ' ').substring(0, 19) + ' UTC' : 'N/A';

  const radarDataArray = [
    agent.internet_access ? 1 : 0,
    agent.filesystem_access ? 1 : 0,
    agent.database_access ? 1 : 0,
    agent.github_access ? 1 : 0,
    agent.browser_access ? 1 : 0,
    agent.secrets_detected ? 1 : 0,
    agent.api_keys_detected ? 1 : 0
  ];

  const totalControls = passes.length + violations.length + gaps.length;
  const compliantPct = totalControls > 0 ? Math.round((passes.length / totalControls) * 100) : 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Assessment Report - ${agent.name}</title>
  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- FontAwesome Icons -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <!-- Chart.js -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: {
              50: '#f8fafc',
              100: '#f1f5f9',
              600: '#0f172a',
              700: '#020617'
            }
          },
          fontFamily: {
            sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
            mono: ['JetBrains Mono', 'Menlo', 'monospace']
          }
        }
      }
    }
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
    @media print {
      body { background-color: #ffffff; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
      .shadow-xs, .shadow-sm, .shadow-md { box-shadow: none !important; }
      .chart-container { width: 100% !important; max-width: 400px; margin: 0 auto; }
    }
  </style>
</head>
<body class="bg-slate-100 text-slate-800 font-sans antialiased min-h-screen py-8 px-4 sm:px-6 lg:px-8">

  <div class="max-w-5xl mx-auto bg-white border border-slate-200/90 rounded-xl shadow-sm overflow-hidden">
    <div class="bg-slate-900 text-white p-8 border-b border-slate-800">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div class="flex items-center gap-2 mb-2">
            <span class="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
              Confidential
            </span>
            <span class="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
              AI Security Audit
            </span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">AI Agent Security & Governance Report</h1>
          <p class="text-xs sm:text-sm text-slate-400 mt-1">Deep asset discovery, vulnerability analysis, and attack surface posture review</p>
        </div>

        <div class="no-print flex items-center gap-2">
          <button onclick="window.print()" class="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-lg text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5">
            <i class="fa-solid fa-print"></i> Print / PDF
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800 text-xs">
        <div>
          <span class="text-slate-400 block text-[11px] uppercase tracking-wider">Target Entity</span>
          <span class="font-bold text-white text-sm">${agent.name}</span>
        </div>
        <div>
          <span class="text-slate-400 block text-[11px] uppercase tracking-wider">Platform</span>
          <span class="font-medium text-slate-200">${platformStr}</span>
        </div>
        <div>
          <span class="text-slate-400 block text-[11px] uppercase tracking-wider">Report Generated</span>
          <span class="font-medium text-slate-200">${dateStr}</span>
        </div>
        <div>
          <span class="text-slate-400 block text-[11px] uppercase tracking-wider">Overall Posture Rating</span>
          <span class="font-bold ${highestSeverityColorHtml}">${severityIconHtml} ${highestSeverityClass}</span>
        </div>
      </div>
    </div>

    <div class="p-6 sm:p-8 space-y-8">
      <!-- Executive Summary -->
      <section>
        <h2 class="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
          <i class="fa-solid fa-gauge-high text-slate-700"></i> Executive Summary
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          <div class="bg-slate-50 border border-slate-200/80 rounded-lg p-4 flex flex-col justify-between">
            <span class="text-xs text-slate-500 font-semibold uppercase">Scan Reliability</span>
            <div class="my-2">
              <span class="text-3xl font-extrabold text-slate-900">${confidencePct}%</span>
              <span class="text-xs text-emerald-600 font-medium ml-1">Confidence</span>
            </div>
            <span class="text-[11px] text-slate-500 font-mono">Scan ID: ${agent.scan_id || agent.id.substring(0,8)}</span>
          </div>

          <div class="bg-slate-50 border border-slate-200/80 rounded-lg p-4 flex flex-col justify-between">
            <span class="text-xs text-slate-500 font-semibold uppercase">Violations & Findings</span>
            <div class="my-2">
              <span class="text-3xl font-extrabold ${violations.length > 0 ? 'text-amber-600' : 'text-emerald-600'}">${medCount + lowCount} Minor/Med</span>
              <span class="text-xs ${highCount > 0 ? 'text-rose-600' : 'text-slate-500'} font-medium ml-1">${highCount} Critical</span>
            </div>
            <span class="text-[11px] text-slate-500">${violations.length} total finding(s)</span>
          </div>

          <div class="bg-slate-50 border border-slate-200/80 rounded-lg p-4 flex flex-col justify-between">
            <span class="text-xs text-slate-500 font-semibold uppercase">Governance Blindspots</span>
            <div class="my-2">
              <span class="text-3xl font-extrabold ${gaps.length > 0 ? 'text-rose-600' : 'text-emerald-600'}">${gaps.length} Gaps</span>
              <span class="text-xs text-slate-500 font-medium ml-1">Detected</span>
            </div>
            <span class="text-[11px] text-slate-500">Unmapped ownership or tags</span>
          </div>

        </div>

        <p class="text-xs sm:text-sm text-slate-600 mt-4 leading-relaxed bg-slate-50/60 p-4 rounded-lg border border-slate-200/60">
          The <strong>${agent.name}</strong> agent operates on ${platformStr} via <code>${modelStr}</code>. ${perimeterExposureCount === 0 ? 'From a perimeter and network egress perspective, the agent has a hardened execution envelope with zero exposed access vectors (no Internet, DB, filesystem, or tool APIs).' : `The agent has ${perimeterExposureCount} perimeter exposure(s) detected.`}
        </p>
      </section>

      <!-- Visual Charts -->
      <section class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        <div class="bg-white border border-slate-200 rounded-lg p-5">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <h3 class="text-xs font-bold uppercase tracking-wider text-slate-700">Security & Governance Compliance</h3>
            <span class="text-xs font-semibold text-slate-500">${totalControls} Total Controls</span>
          </div>
          <div class="h-48 flex items-center justify-center relative chart-container">
            <canvas id="complianceChart"></canvas>
            <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span class="text-2xl font-black text-slate-800">${compliantPct}%</span>
              <span class="text-[10px] text-slate-400 font-medium uppercase">Compliant</span>
            </div>
          </div>
          <div class="flex justify-around text-center text-xs text-slate-600 pt-3 border-t border-slate-100 mt-2">
            <div><span class="font-bold text-emerald-600">${passes.length}</span> Passed</div>
            <div><span class="font-bold text-amber-600">${violations.length}</span> Violations</div>
            <div><span class="font-bold text-slate-500">${gaps.length}</span> Missing</div>
          </div>
        </div>

        <div class="bg-white border border-slate-200 rounded-lg p-5">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <h3 class="text-xs font-bold uppercase tracking-wider text-slate-700">Attack Surface Perimeter</h3>
            ${perimeterExposureCount === 0 
              ? '<span class="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Zero Ingress/Egress Exposure</span>'
              : `<span class="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">${perimeterExposureCount} Exposure(s)</span>`
            }
          </div>
          <div class="h-48 flex items-center justify-center chart-container">
            <canvas id="surfaceRadar"></canvas>
          </div>
          <p class="text-[11px] text-slate-500 text-center pt-2">Analysis of external tool bridges, database hooks, and credential endpoints.</p>
        </div>
      </section>

      <!-- Section 1 -->
      <section class="space-y-3 page-break">
        <div class="flex items-center justify-between pb-2 border-b border-slate-200">
          <h2 class="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <i class="fa-solid fa-shield-check text-emerald-600"></i> Section 1: Verified Passed Controls (${passes.length})
          </h2>
          <span class="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">Passed</span>
        </div>
        <div class="overflow-x-auto border border-slate-200 rounded-lg">
          <table class="w-full text-left text-xs border-collapse">
            <thead class="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th class="p-3 w-1/4">Control Area</th>
                <th class="p-3 w-1/4">Evaluated State</th>
                <th class="p-3 w-1/2">Audit Notes</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 text-slate-700">
              ${passesHtml}
            </tbody>
          </table>
        </div>
      </section>

      <!-- Section 2 -->
      <section class="space-y-3">
        <div class="flex items-center justify-between pb-2 border-b border-slate-200">
          <h2 class="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <i class="fa-solid fa-triangle-exclamation text-amber-500"></i> Section 2: Security Violations & Compliance Findings (${violations.length})
          </h2>
          <span class="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">Requires Action</span>
        </div>
        <div class="space-y-3">
          ${violationsHtml}
        </div>
      </section>

      <!-- Section 3 -->
      <section class="space-y-3 page-break">
        <div class="flex items-center justify-between pb-2 border-b border-slate-200">
          <h2 class="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <i class="fa-solid fa-circle-question text-slate-500"></i> Section 3: Governance & Observability Gaps (${gaps.length})
          </h2>
          <span class="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">Orphaned Metadata</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          ${gapsHtml}
        </div>
      </section>

      <!-- Section 4 -->
      <section class="space-y-3">
        <h2 class="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
          <i class="fa-solid fa-code text-indigo-600"></i> Section 4: Prompt Guardrail & Instructions Audit
        </h2>
        <div class="bg-slate-900 text-slate-200 p-4 rounded-lg font-mono text-xs space-y-2 border border-slate-800">
          <div class="text-slate-400 text-[11px] pb-1 border-b border-slate-800 flex justify-between">
            <span>INSTRUCTION BUFFER PREVIEW</span>
            <span>MODEL: ${modelStr}</span>
          </div>
          <p class="leading-relaxed text-slate-300">
            ${promptPreview.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
          </p>
        </div>
      </section>

      <!-- Section 5 -->
      <section class="space-y-3">
        <h2 class="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
          <i class="fa-solid fa-history text-slate-600"></i> Section 5: Discovery & Ingestion Audit Trail
        </h2>
        <div class="border border-slate-200 rounded-lg p-4 bg-slate-50 text-xs">
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <span class="text-slate-500 block text-[11px]">AWS Account & Region</span>
              <span class="font-mono text-slate-800 font-semibold">${agent.metadata?.accountId || 'Unknown'} (${agent.region || 'global'})</span>
            </div>
            <div>
              <span class="text-slate-500 block text-[11px]">Agent Created At</span>
              <span class="font-mono text-slate-800">${createdDate}</span>
            </div>
            <div>
              <span class="text-slate-500 block text-[11px]">Last Updated</span>
              <span class="font-mono text-slate-800">${updatedDate}</span>
            </div>
            <div>
              <span class="text-slate-500 block text-[11px]">Inventory Status</span>
              <span class="font-mono text-emerald-700 font-semibold">Active</span>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- Footer -->
    <div class="bg-slate-50 border-t border-slate-200 p-6 sm:p-8 text-xs text-slate-500 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <p class="font-semibold text-slate-800">Automated AI Posture Governance Engine</p>
        <p class="text-[11px]">Compliance Framework: NIST AI RMF / Cloud AI Security Baseline</p>
      </div>
      <div class="text-right text-[11px]">
        <p>Document Hash: <span class="font-mono text-slate-600">${agent.id}</span></p>
        <p>Status: <span class="font-semibold ${violations.length > 0 ? 'text-amber-700' : 'text-emerald-700'}">${violations.length > 0 ? 'REQUIRES REMEDIATION' : 'CLEAN'}</span></p>
      </div>
    </div>
  </div>

  <script>
    const ctxComp = document.getElementById('complianceChart').getContext('2d');
    new Chart(ctxComp, {
      type: 'doughnut',
      data: {
        labels: ['Passed (${passes.length})', 'Violations (${violations.length})', 'Missing Data (${gaps.length})'],
        datasets: [{
          data: [${passes.length}, ${violations.length}, ${gaps.length}],
          backgroundColor: ['#10b981', '#f59e0b', '#cbd5e1'],
          borderWidth: 0,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        plugins: { legend: { display: false } },
        animation: { duration: 0 } // Disable animation for printing
      }
    });

    const ctxRadar = document.getElementById('surfaceRadar').getContext('2d');
    new Chart(ctxRadar, {
      type: 'radar',
      data: {
        labels: ['Internet', 'Filesystem', 'DB Access', 'GitHub', 'Browser', 'Secrets', 'API Keys'],
        datasets: [{
          label: 'Exposure Index',
          data: ${JSON.stringify(radarDataArray)},
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          borderColor: '#10b981',
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#fff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 },
        scales: {
          r: {
            angleLines: { color: '#f1f5f9' },
            grid: { color: '#e2e8f0' },
            pointLabels: { font: { size: 9, family: 'Inter' }, color: '#64748b' },
            suggestedMin: 0,
            suggestedMax: 1,
            ticks: { display: false, stepSize: 1 }
          }
        },
        plugins: { legend: { display: false } }
      }
    });
  </script>
</body>
</html>`;
}
