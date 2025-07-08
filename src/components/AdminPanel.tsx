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

export function AdminPanel() {
  const supabase = useSupabaseClient();
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tagValues, setTagValues] = useState<Record<string, string>>({});
  const [newCategory, setNewCategory] = useState("");
  const [newColor, setNewColor] = useState("#888888");
  const [localColors, setLocalColors] = useState({ ...CATEGORY_COLORS });

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

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (responses.length === 0) return <div>No pending responses.</div>;

  return (
    <div className="space-y-6">
      {responses.map((r) => (
        <div key={r.id} className="border rounded p-4 shadow-sm bg-white">
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
      ))}
      <div className="mb-4 p-4 border rounded bg-gray-50 dark:bg-gray-800">
        <h3 className="font-bold mb-2">Add New Category Color</h3>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Category name"
            value={newCategory}
            onChange={e => setNewCategory(e.target.value)}
            className="border p-1 rounded"
          />
          <input
            type="color"
            value={newColor}
            onChange={e => setNewColor(e.target.value)}
            className="w-8 h-8 border rounded"
          />
          <button
            className="bg-blue-600 text-white px-3 py-1 rounded"
            onClick={handleAddCategory}
          >
            Add
          </button>
        </div>
        <div className="mt-2 text-xs text-gray-500">Example: "team", "success", "extrovert, evening"</div>
      </div>
    </div>
  );
}

export default AdminPanel; 