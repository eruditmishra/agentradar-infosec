import { useNavigate } from 'react-router-dom';
import StatCard from '../../shared/StatCard';
import type { DashboardData } from '../../../types/dashboard';

interface StatCardsProps {
  stats: DashboardData['stats'];
  alerts: DashboardData['alerts'];
}

export default function StatCards({ stats }: StatCardsProps) {
  const navigate = useNavigate();

  const navigateToAgents = (status?: string) => {
    if (status === 'shadow') {
      navigate('/agents/shadow');
    } else if (status === 'approved') {
      navigate('/agents/verified');
    } else {
      navigate('/agents');
    }
  };

  return (
    <div className="grid grid-cols-4 gap-4">
      <StatCard 
        color="brand" 
        label="TOTAL AGENTS" 
        value={stats.totalAgents} 
        sub="discovered across all sources" 
        onClick={() => navigateToAgents()}
      />
      <StatCard 
        color="green" 
        label="APPROVED AGENTS" 
        value={stats.approvedAgents} 
        sub="governed and compliant" 
        onClick={() => navigateToAgents('approved')}
      />
      <StatCard 
        color="amber" 
        label="SHADOW AGENTS" 
        value={stats.shadowAgents} 
        sub="unauthorized deployments" 
        onClick={() => navigateToAgents('shadow')}
      />
      <StatCard 
        color="purple" 
        label="AVG. CONFIDENCE" 
        value={`${stats.avgConfidence}%`} 
        sub="discovery accuracy" 
        onClick={() => navigate('/agents')}
      />
    </div>
  );
}
