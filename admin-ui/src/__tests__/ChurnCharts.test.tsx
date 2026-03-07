import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock recharts to avoid canvas issues in jsdom
vi.mock('recharts', () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div />,
  Cell: () => <div />,
  Legend: () => <div />,
}));

// Mock api
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({
      distribution: [{ tranche: '0-20', count: 5 }],
      risk_levels: [{ name: 'Faible', value: 10, color: '#22c55e' }],
      top_factors: [{ factor: 'Inactivité', count: 8 }],
    }),
  },
}));

import ChurnCharts from '../components/churn/ChurnCharts';

describe('ChurnCharts', () => {
  it('should render without crashing', () => {
    render(<ChurnCharts />);
    // The component should render loading state or charts
    expect(document.body).toBeTruthy();
  });

  it('should show loading indicator initially', () => {
    render(<ChurnCharts />);
    // Loading spinner or text should be present initially
    const container = document.querySelector('.animate-spin');
    expect(container).toBeTruthy();
  });
});
