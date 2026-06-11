import { LoadingSpinner } from '@lifesync/ui';

export default function DashboardLoading() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '40vh' }}>
      <LoadingSpinner size="lg" label="Loading your dashboard" />
    </div>
  );
}
