import { Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import SegmentsPage from './pages/Segments';
import WorkflowsPage from './pages/Workflows';
import PipelinePage from './pages/Pipeline';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/segments" element={<SegmentsPage />} />
        <Route path="/workflows" element={<WorkflowsPage />} />
        <Route path="/pipeline" element={<PipelinePage />} />
      </Routes>
    </div>
  );
}

export default App;
