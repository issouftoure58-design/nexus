import { Link } from 'react-router-dom';
import { CRMSegments } from '@/components/CRMSegments';
import { LayoutDashboard, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SegmentsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="h-6 w-6 text-primary-600" />
              <span className="text-xl font-bold">NEXUS Admin</span>
            </div>
            <nav className="flex items-center gap-4">
              <Link to="/" className="text-gray-600 hover:text-gray-900">Dashboard</Link>
              <Link to="/segments" className="text-primary-600 font-medium">Segments</Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Button variant="ghost" asChild className="mb-4">
            <Link to="/" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Retour au dashboard
            </Link>
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Segmentation CRM</h1>
          <p className="text-gray-600 mt-1">
            Creez et gerez des segments de clients pour des campagnes ciblees
          </p>
        </div>

        <CRMSegments />
      </main>
    </div>
  );
}
