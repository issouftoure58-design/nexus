import { CRMSegments } from '@/components/CRMSegments';

export default function SegmentsPage() {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Segmentation CRM</h1>
        <p className="text-sm text-gray-500">
          Creez et gerez des segments de clients pour des campagnes ciblees
        </p>
      </div>

      <CRMSegments />
    </div>
  );
}
