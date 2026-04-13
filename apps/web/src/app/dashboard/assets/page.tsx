'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useEntitlements } from '@/components/EntitlementsContext';

interface Asset {
  id: string;
  filename: string;
  category: string;
  tags: string[];
  downloadCount: number;
  createdAt: string;
}

const ASSET_CATEGORIES = ['brushes', 'templates', 'backgrounds', 'textures', 'other'];

export default function AssetsPage() {
  const router = useRouter();
  const { entitlements } = useEntitlements();
  
  const [assets, setAssets] = useState<Asset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!entitlements?.user) {
      router.push('/sign-in');
    }
  }, [entitlements?.user, router]);

  // Load creator's assets
  useEffect(() => {
    async function loadAssets() {
      try {
        const params = new URLSearchParams({
          creatorId: entitlements?.user?.id || '',
          limit: '100',
        });
        const response = await api.get<{ assets: Asset[] }>(`/api/assets?${params}`);
        setAssets(response.assets || []);
      } catch (err) {
        console.error('Failed to load assets:', err);
      } finally {
        setLoading(false);
      }
    }

    if (entitlements?.user?.id) {
      loadAssets();
    }
  }, [entitlements?.user?.id]);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData(e.currentTarget);
      const response = await fetch('/api/assets', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      setAssets([result.asset, ...assets]);
      e.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (assetId: string) => {
    if (!confirm('Delete this asset?')) return;

    try {
      await api.delete(`/api/assets/${assetId}`);
      setAssets(assets.filter(a => a.id !== assetId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  if (!entitlements?.user) {
    return null; // Redirecting
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Creator Assets Library</h1>

        {/* Upload Form */}
        <div className="bg-slate-800 rounded-lg p-6 mb-8 border border-slate-700">
          <h2 className="text-xl font-semibold text-white mb-4">Upload New Asset</h2>
          
          {error && (
            <div className="bg-red-900/20 border border-red-700 text-red-300 px-4 py-2 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                File
              </label>
              <input
                type="file"
                name="file"
                required
                disabled={uploading}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded disabled:opacity-50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Category
                </label>
                <select
                  name="category"
                  required
                  disabled={uploading}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded disabled:opacity-50"
                >
                  <option value="">Select category</option>
                  {ASSET_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Filename
                </label>
                <input
                  type="text"
                  name="filename"
                  placeholder="e.g. my-brush.abr"
                  required
                  disabled={uploading}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Tags (JSON array, optional)
              </label>
              <input
                type="text"
                name="tags"
                placeholder='["digital", "procreate"]'
                disabled={uploading}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="w-full px-4 py-2 bg-purple-600 text-white font-semibold rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' : 'Upload Asset'}
            </button>
          </form>
        </div>

        {/* Assets List */}
        <div className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-xl font-semibold text-white">Your Assets ({assets.length})</h2>
          </div>

          {loading ? (
            <div className="p-6 text-center text-gray-400">Loading assets...</div>
          ) : assets.length === 0 ? (
            <div className="p-6 text-center text-gray-400">No assets yet. Upload your first asset!</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Name</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Category</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Tags</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Downloads</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map(asset => (
                    <tr key={asset.id} className="border-t border-slate-700 hover:bg-slate-700/50">
                      <td className="px-6 py-4 text-white">{asset.filename}</td>
                      <td className="px-6 py-4 text-gray-300">
                        <span className="px-2 py-1 bg-slate-700 rounded text-xs">
                          {asset.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-sm">
                        {asset.tags.join(', ') || 'none'}
                      </td>
                      <td className="px-6 py-4 text-gray-300">{asset.downloadCount}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleDelete(asset.id)}
                          className="text-red-400 hover:text-red-300 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
