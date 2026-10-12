import { useState, useEffect } from "react";
import { User, Box, ActivitySquare } from "lucide-react";
import { auditAPI } from "../../lib/api";
import Pagination from "../../components/super_admin/agents/Pagination";

export default function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 50;

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const offset = (page - 1) * limit;
        const res = await auditAPI.getAuditLogs({ limit, offset });
        setLogs(res.data.logs);
        setTotal(res.data.total);
      } catch (err) {
        console.error("Failed to fetch logs", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [page]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="h-full overflow-y-auto space-y-6 animate-in fade-in duration-300 p-6 custom-scrollbar">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight text-text-primary">
            Business Audit Logs
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Immutable ledger of all business actions, governance decisions, and
            scanning events.
          </p>
        </div>
        {/* <div className="flex gap-2 text-[12px] font-semibold text-text-muted bg-glass-white border border-glass-border px-3 py-1.5 rounded-lg shadow-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-brand"></span>
            SIEM Ready
          </span>
        </div> */}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] uppercase font-bold text-slate-500 bg-slate-50/50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">Timestamp</th>
                <th className="px-6 py-4">Actor</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Target Entity</th>
                <th className="px-6 py-4">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-brand">
                      <div className="w-6 h-6 border-2 border-brand/20 border-t-brand rounded-full animate-spin mb-3"></div>
                      <p className="text-sm font-medium">
                        Loading audit logs...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    <Box size={24} className="mx-auto mb-2 opacity-50" />
                    <p className="text-[13px] font-medium">
                      No audit logs found
                    </p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-6 py-3 whitespace-nowrap font-medium text-slate-500 text-[12px]">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                          {log.user_email
                            ? "User"
                            : log.user_id
                              ? "System (Cascade)"
                              : "System"}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <User
                            size={12}
                            className={
                              log.user_email ? "text-brand" : "text-slate-400"
                            }
                          />
                          <div className="flex flex-col">
                            <span
                              className="text-[13px] font-semibold truncate max-w-[150px]"
                              title={
                                log.user_email ||
                                log.user_id ||
                                "Automated Process"
                              }
                            >
                              {log.user_email
                                ? log.user_email
                                    .split("@")[0]
                                    .split(".")
                                    .map(
                                      (s: string) =>
                                        s.charAt(0).toUpperCase() + s.slice(1),
                                    )
                                    .join(" ")
                                : log.user_id || "Automated Process"}
                            </span>
                            {log.user_email && (
                              <span
                                className="text-[11px] text-slate-500 truncate max-w-[150px]"
                                title={log.user_email}
                              >
                                {log.user_email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <ActivitySquare size={14} className="text-brand" />
                        <span className="text-[12px] font-bold tracking-wide uppercase text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {log.event_type}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      {log.entity_type ? (
                        <div className="flex flex-col">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            {log.entity_type}
                          </span>
                          <span
                            className="text-[13px] font-medium truncate max-w-[150px]"
                            title={log.entity_name || log.entity_id}
                          >
                            {log.entity_name || log.entity_id}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[13px] text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className="text-[13px] text-slate-600 line-clamp-2"
                        title={log.summary}
                      >
                        {log.summary}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && totalPages > 1 && (
          <div className="border-t border-slate-200 bg-slate-50/50">
            <Pagination
              page={page}
              total={total}
              pageSize={limit}
              onChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
