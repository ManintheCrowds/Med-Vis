"use client";

import { useEffect, useState } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { CATEGORY_COLORS } from './colorConfig';

interface SurveyResponse {
  id: string;
  first_name: string;
  last_name?: string;
  email?: string;
  unique_quality?: string;
  status: string;
  tag?: string;
  created_at: string;
}

// Define all categories that should be manageable
const ALL_CATEGORIES = {
  'Peak Performance': [
    'Extrovert, Morning',
    'Extrovert, Evening', 
    'Introvert, Morning',
    'Introvert, Night',
    'Ambivert, Morning',
    'Ambivert, Night'
  ],
  'Shaped By': [
    'mentor',
    'challenge', 
    'failure',
    'success',
    'team',
    'other'
  ],
  'Learning Style': [
    'visual',
    'auditory',
    'kinesthetic',
    'reading_writing'
  ],
  'Motivation': [
    'impact',
    'growth',
    'recognition', 
    'autonomy',
    'purpose'
  ],
  'Years at Medtronic': [
    '0-5',
    '6-10',
    '11-15',
    '16-20',
    '20+'
  ]
};

export function AdminPanel() {
  const supabase = useSupabaseClient();
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tagValues, setTagValues] = useState<Record<string, string>>({});
  const [newCategory, setNewCategory] = useState("");
  const [newColor, setNewColor] = useState("#888888");
  const [localColors, setLocalColors] = useState({ ...CATEGORY_COLORS });
  const [activeTab, setActiveTab] = useState<'responses' | 'colors'>('responses');

  // Fetch pending responses
  useEffect(() => {
    const fetchResponses = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("survey_responses")
        .select("id, unique_quality, status, tag, created_at, attendees(first_name, last_name, email)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) setError(error.message);
      else setResponses(
        data.map((r: any) => ({
          id: r.id,
          unique_quality: r.unique_quality,
          status: r.status,
          tag: r.tag,
          created_at: r.created_at,
          first_name: r.attendees?.first_name ?? "",
          last_name: r.attendees?.last_name ?? "",
          email: r.attendees?.email ?? "",
        }))
      );
      setLoading(false);
    };
    fetchResponses();
  }, [supabase]);

  // Moderation action
  const moderate = async (id: string, status: "approved" | "rejected", tag?: string) => {
    const { error } = await supabase
      .from("survey_responses")
      .update({ status, tag, moderated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) alert(error.message);
    else setResponses(responses.filter((r) => r.id !== id));
  };

  const handleAddCategory = () => {
    if (!newCategory.trim() || !/^#[0-9A-Fa-f]{6}$/.test(newColor)) return;
    setLocalColors({ ...localColors, [newCategory.trim()]: newColor });
    setNewCategory("");
    setNewColor("#888888");
    // In a real app, also persist to backend or update colorConfig.ts
  };

  const handleColorChange = (category: string, color: string) => {
    setLocalColors({ ...localColors, [category]: color });
    // In a real app, also persist to backend or update colorConfig.ts
  };

  const handleSaveColors = () => {
    // In a real app, save to backend or update colorConfig.ts
    console.log('Saving colors:', localColors);
    alert('Colors saved! (In a real app, this would persist to the backend)');
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex space-x-4 border-b">
        <button
          onClick={() => setActiveTab('responses')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'responses' 
              ? 'border-b-2 border-blue-500 text-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Survey Responses ({responses.length})
        </button>
        <button
          onClick={() => setActiveTab('colors')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'colors' 
              ? 'border-b-2 border-blue-500 text-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Color Configuration
        </button>
      </div>

      {/* Survey Responses Tab */}
      {activeTab === 'responses' && (
        <div>
          {responses.length === 0 ? (
            <div>No pending responses.</div>
          ) : (
            responses.map((r) => (
              <div key={r.id} className="border rounded p-4 shadow-sm bg-white mb-4">
                <div className="mb-2 font-bold">
                  {r.first_name} {r.last_name} {r.email && <span className="text-xs text-gray-400">({r.email})</span>}
                </div>
                <div className="mb-2">
                  <span className="font-semibold">Unique Quality:</span> {r.unique_quality}
                </div>
                <div className="mb-2">
                  <span className="font-semibold">Submitted:</span> {new Date(r.created_at).toLocaleString()}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    className="bg-green-600 text-white px-3 py-1 rounded"
                    onClick={() => moderate(r.id, "approved")}
                  >
                    Approve
                  </button>
                  <button
                    className="bg-red-600 text-white px-3 py-1 rounded"
                    onClick={() => moderate(r.id, "rejected")}
                  >
                    Reject
                  </button>
                  <input
                    type="text"
                    placeholder="Tag (optional)"
                    className="border p-1 rounded"
                    value={tagValues[r.id] || ""}
                    onChange={(e) => setTagValues({ ...tagValues, [r.id]: e.target.value })}
                  />
                  <button
                    className="bg-blue-600 text-white px-3 py-1 rounded"
                    onClick={() => moderate(r.id, "approved", tagValues[r.id])}
                  >
                    Save Tag
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Color Configuration Tab */}
      {activeTab === 'colors' && (
        <div className="space-y-6">
          {/* Existing Categories */}
          {Object.entries(ALL_CATEGORIES).map(([categoryGroup, categories]) => (
            <div key={categoryGroup} className="border rounded p-4 bg-white">
              <h3 className="font-bold text-lg mb-4 text-gray-800">{categoryGroup}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((category) => (
                  <div key={category} className="flex items-center space-x-3 p-3 border rounded bg-gray-50">
                    <div 
                      className="w-6 h-6 rounded border-2 border-gray-300"
                      style={{ backgroundColor: localColors[category] || '#888888' }}
                    />
                    <span className="flex-1 text-sm font-medium text-gray-700">{category}</span>
                    <input
                      type="color"
                      value={localColors[category] || '#888888'}
                      onChange={(e) => handleColorChange(category, e.target.value)}
                      className="w-8 h-8 border rounded cursor-pointer"
                      title={`Change color for ${category}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Add New Category */}
          <div className="border rounded p-4 bg-gray-50">
            <h3 className="font-bold mb-2">Add New Category Color</h3>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Category name"
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                className="border p-2 rounded flex-1"
              />
              <input
                type="color"
                value={newColor}
                onChange={e => setNewColor(e.target.value)}
                className="w-10 h-10 border rounded cursor-pointer"
              />
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                onClick={handleAddCategory}
              >
                Add
              </button>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Example: "team", "success", "Extrovert, Evening"
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSaveColors}
              className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
            >
              Save All Colors
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPanel; 