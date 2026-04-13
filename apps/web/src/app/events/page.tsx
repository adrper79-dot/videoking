'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Event {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  startDate: string;
  endDate: string;
  videoCount: number;
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEvents() {
      try {
        const params = new URLSearchParams({
          limit: '50',
          ...(search && { search }),
        });
        const response = await api.get<{ events: Event[] }>(`/api/events?${params}`);
        setEvents(response.events || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load events');
      } finally {
        setLoading(false);
      }
    }

    const timer = setTimeout(() => {
      loadEvents();
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">Events</h1>
          <p className="text-gray-400">Explore BlerdArt events and community showcases</p>
        </div>

        {/* Search */}
        <div className="mb-8">
          <input
            type="text"
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-lg focus:outline-none focus:border-purple-500"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/20 border border-red-700 text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Events Grid */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-400">Loading events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">
              {search ? 'No events found matching your search' : 'No events yet'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <Link key={event.id} href={`/events/${event.slug}`}>
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-6 hover:from-purple-900/30 hover:to-indigo-900/30 transition h-full border border-slate-700 hover:border-purple-600">
                  <h3 className="text-xl font-bold text-white mb-2">{event.name}</h3>
                  
                  <p className="text-gray-400 text-sm mb-4">
                    {new Date(event.startDate).toLocaleDateString()} →{' '}
                    {new Date(event.endDate).toLocaleDateString()}
                  </p>

                  {event.description && (
                    <p className="text-gray-300 text-sm mb-4 line-clamp-2">
                      {event.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                    <span className="text-xs font-semibold text-purple-400">
                      {event.videoCount} videos
                    </span>
                    <span className="text-purple-400 hover:text-purple-300">→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
