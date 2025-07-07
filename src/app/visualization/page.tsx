import { DataVisualization } from '@/components/DataVisualization';
import Layout from '@/components/Layout';

export default function VisualizationPage() {
  return (
    <Layout>
      <div className="fixed inset-0 w-screen h-screen bg-gray-50 z-0">
        <DataVisualization />
      </div>
    </Layout>
  );
} 