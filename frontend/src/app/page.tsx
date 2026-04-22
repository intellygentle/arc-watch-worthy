// src/app/page.tsx

'use client';

import { useEffect, useState } from 'react';
import WalletAuth from '@/components/WalletAuth';
import { videoAPI } from '@/lib/api';
import { Search, AlertCircle, RefreshCw, Trash2, Loader2, Play, Clock, DollarSign } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useWallet } from '@/components/WalletAuth';

interface Video {
  id: string;
  title: string;
  description: string;
  durationSeconds: number;
  chunkDuration: number;
  pricePerChunk: number;
  creatorWallet: string;
  videoUrl: string;
  createdAt: string;
}

export default function Home() {
  const { eoa: viewerWallet } = useWallet();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const fetchVideos = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await videoAPI.list(q);
      const videosData = res.data?.data || res.data || [];
      setVideos(Array.isArray(videosData) ? videosData : []);
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError('Could not connect to backend. Is it running?');
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchVideos(); 
  }, [q]);

  const handleDelete = async (videoId: string) => {
    if (!viewerWallet) {
      toast.error('Please connect your wallet first');
      return;
    }
    
    setDeletingId(videoId);
    try {
      const res = await videoAPI.delete(videoId, viewerWallet);
      toast.success(res.data.data.message || 'Video deleted successfully');
      setVideos(prev => prev.filter(v => v.id !== videoId));
      setShowDeleteConfirm(null);
    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error(err.response?.data?.error || 'Failed to delete video');
    } finally {
      setDeletingId(null);
    }
  };

  const isCreator = (video: Video) => {
    return viewerWallet && video.creatorWallet.toLowerCase() === viewerWallet.toLowerCase();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <main className="min-h-screen bg-[#1F1A31] retro-grid-bg">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header with brand gradient */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-[#8656EF] to-[#00C8B3] bg-clip-text text-transparent">
              🎬 Arc-Watch-Worthy
            </h1>
            <p className="text-gray-400 text-sm mt-1">Pay only for content that earns it</p>
          </div>
          <Link 
            href="/upload" 
            className="glow-button px-5 py-2.5 text-white rounded-xl font-medium transition flex items-center gap-2"
          >
            + List Video
          </Link>
        </header>
        
        <WalletAuth />

        {/* Search Bar with glass effect */}
        <div className="relative">
          <Search className="absolute left-4 top-3.5 text-[#8656EF]" size={20}/>
          <input 
            value={q} 
            onChange={e => setQ(e.target.value)} 
            placeholder="Search by title or creator..." 
            className="w-full pl-12 p-3.5 bg-[#2D2440]/50 backdrop-blur-sm border border-[#3D3458] rounded-xl focus:ring-2 ring-[#8656EF] text-white placeholder-gray-400 outline-none transition"
          />
        </div>

        {/* Error / Retry State */}
        {error && (
          <div className="p-4 bg-red-900/30 border border-red-500/30 rounded-xl flex items-center justify-between text-red-200">
            <div className="flex items-center gap-2">
              <AlertCircle size={20}/>
              <span>{error}</span>
            </div>
            <button 
              onClick={fetchVideos} 
              className="flex items-center gap-2 bg-[#2D2440] px-4 py-2 rounded-lg hover:bg-[#3D3458] transition"
            >
              <RefreshCw size={16}/> Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && !error && (
          <div className="text-center py-16">
            <div className="inline-block p-4 rounded-full bg-[#2D2440]">
              <Loader2 className="animate-spin text-[#8656EF]" size={32} />
            </div>
            <p className="text-gray-400 mt-4">Discovering watch-worthy content...</p>
          </div>
        )}

        {/* Video Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {videos.map(v => (
            <div key={v.id} className="relative group">
              <Link 
                href={`/watch/${v.id}`} 
                className="block glass-card rounded-2xl overflow-hidden hover:border-[#8656EF]/40 transition-all duration-300 hover:-translate-y-1"
              >
                {/* Thumbnail placeholder - can be enhanced with actual thumbnails */}
                <div className="aspect-video bg-gradient-to-br from-[#8656EF]/20 to-[#00C8B3]/20 flex items-center justify-center">
                  <Play size={48} className="text-[#8656EF]/60 group-hover:text-[#8656EF] transition" />
                </div>
                
                <div className="p-4">
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold text-lg text-white line-clamp-1">{v.title}</h3>
                    {isCreator(v) && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowDeleteConfirm(v.id);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition opacity-0 group-hover:opacity-100"
                        title="Delete video"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm mt-1 line-clamp-2">{v.description}</p>
                  
                  <div className="mt-4 flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[#00C8B3] font-medium">
                        <DollarSign size={14} />
                        {v.pricePerChunk.toFixed(6)} USDC
                      </span>
                      <span className="text-gray-500">/ {v.chunkDuration} min</span>
                    </div>
                    <span className="flex items-center gap-1 text-gray-400">
                      <Clock size={14} />
                      {formatDuration(v.durationSeconds)}
                    </span>
                  </div>
                  
                  {isCreator(v) && (
                    <div className="mt-3">
                      <span className="bg-[#8656EF]/20 text-[#8656EF] text-xs px-2 py-1 rounded-full">
                        Your Content
                      </span>
                    </div>
                  )}
                </div>
              </Link>
              
              {/* Delete Confirmation Modal */}
              {showDeleteConfirm === v.id && (
                <div className="absolute inset-0 glass-card rounded-2xl p-5 z-10 flex flex-col">
                  <h4 className="font-semibold text-white mb-2">Delete Video?</h4>
                  <p className="text-sm text-gray-300 mb-4 flex-1">
                    This will permanently delete "{v.title}" and all associated payment records.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(v.id)}
                      disabled={deletingId === v.id}
                      className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {deletingId === v.id ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        'Delete'
                      )}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(null)}
                      className="flex-1 py-2 bg-[#2D2440] hover:bg-[#3D3458] text-white rounded-lg text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        
        {!loading && !error && videos.length === 0 && (
          <div className="text-center py-16 glass-card rounded-2xl">
            <Play size={48} className="mx-auto mb-4 text-[#8656EF]/40" />
            <p className="text-gray-300 text-lg mb-2">No videos yet</p>
            <p className="text-gray-400 mb-4">Be the first to share watch-worthy content!</p>
            <Link 
              href="/upload" 
              className="glow-button px-5 py-2.5 text-white rounded-xl font-medium inline-flex items-center gap-2"
            >
              + List Video
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}