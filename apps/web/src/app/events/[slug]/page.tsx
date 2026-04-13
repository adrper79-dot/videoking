'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { VideoCard } from '@/components/VideoCard';
import type { Video } from '@nichestream/types';

export const runtime = 'edge';

interface Event {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  startDate: string;
  endDate: string;
  videoCount: number;
}

export default function EventPage() {
  const params = useParams();
  const slug = params.slug as string;
  
  const [event, setEvent] = useState<Event | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEvent() {
      try {
        const response = await api.get<{ event: Event; videos: (Video & { creatorUsername?: string; creatorDisplayName?: string; creatorAvatarUrl?: string | null })[] }>(`/api/events/${slug}`);
        setEvent(response.event);
        setVideos(response.videos || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load event');
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      loadEvent();
    }
  }, [slug]);

  if (loading) {
    return <div className="p-8 text-center">Loading event...</div>;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-600 mb-4">{error}</div>
        <Link href="/" className="text-blue-600 hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-8 text-center">
        <div className="text-gray-600 mb-4">Event not found</div>
        <Link href="/" className="text-blue-600 hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Event Header */}
        <div className="mb-12">
          <Link href="/" className="text-blue-400 hover:text-blue-300 mb-6 inline-block">
            ← Back
          </Link>
          
          <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-lg p-8 mb-6">
            <h1 className="text-4xl font-bold text-white mb-2">{event.name}</h1>
            <p className="text-gray-300 mb-4">
              {new Date(event.startDate).toLocaleDateString()} →{' '}
              {new Date(event.endDate).toLocaleDateString()}
            </p>
            {event.description && (
              <p className="text-gray-200 max-w-2xl">{event.description}</p>
            )}
          </div>

          <div className="text-gray-300">
            <span className="text-2xl font-bold text-white">{event.videoCount}</span>
            {' '}videos from this event
          </div>
        </div>

        {/* Videos Grid */}
        {videos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-400">No videos from this event yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
