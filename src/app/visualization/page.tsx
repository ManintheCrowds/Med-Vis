import { DataVisualization } from '@/components/DataVisualization';
import Layout from '@/components/Layout';

export default function VisualizationPage() {
  return (
    <Layout>
      <div className="fixed inset-0 w-screen h-screen bg-gray-50 z-0">
        <DataVisualization />
        
        {/* Light mode indicator - moved to far left */}
        <div className="absolute top-4 left-4 z-50">
          <div className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-lg">
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-gray-800">Light Mode</span>
            <a 
              href="/visualization/dark" 
              className="text-xs text-blue-600 hover:text-blue-500 underline"
            >
              Dark Mode
            </a>
          </div>
        </div>
      </div>
    </Layout>
  );
} 