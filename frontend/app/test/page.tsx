import ModelTest from '../../components/ModelTest';

export default function TestPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8">
          MornGPT API Connection Test
        </h1>
        <ModelTest />
      </div>
    </div>
  );
} 