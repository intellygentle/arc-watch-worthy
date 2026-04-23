// frontend/src/app/watch/[id]/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Share2, Heart, MessageCircle, Loader2, AlertCircle, Trash2, Clock, DollarSign, Layers, Info, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { videoAPI } from '@/lib/api';
import { useWallet } from '@/components/WalletAuth';
import WalletAuth from '@/components/WalletAuth';
import VideoPlayer from '@/components/VideoPlayer';
import { formatUSDC, calculateVideoChunks, formatDuration } from '@/config/app';

interface Video {
  id: string;
  title: string;
  description: string;
  durationSeconds: number;
  chunkDurationSeconds: number;
  pricePerChunk: number;
  creatorWallet: string;
  creatorDcw: string;
  videoUrl: string;
  createdAt: string;
}

interface PaymentLogEntry {
  chunk: number;
  amount: string;
  timestamp: string;
  txHash?: string;
}

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  
  const { eoa: viewerWallet, dcwAddress: viewerDcw } = useWallet();
  
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [paymentLog, setPaymentLog] = useState<PaymentLogEntry[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  const videoId = params.id as string;

  const isCreator = video && viewerWallet && 
    video.creatorWallet.toLowerCase() === viewerWallet.toLowerCase();

  const handleDelete = async () => {
    if (!video || !viewerWallet) return;
    
    setDeleting(true);
    try {
      const res = await videoAPI.delete(video.id, viewerWallet);
      toast.success(res.data.data.message || 'Video deleted successfully');
      router.push('/');
    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error(err.response?.data?.error || 'Failed to delete video');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  useEffect(() => {
    const fetchVideo = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await videoAPI.getVideo(videoId);
        setVideo(res.data.data || res.data);
      } catch (err: any) {
        console.error('Fetch error:', err);
        setError(err.response?.data?.error || 'Video not found');
        if (err.response?.status === 404) {
          toast.error('Video not found');
          setTimeout(() => router.push('/'), 2000);
        }
      } finally {
        setLoading(false);
      }
    };
    
    if (videoId) fetchVideo();
  }, [videoId, router]);
  
  const handlePaymentSuccess = (chunkIndex: number, amount: string, txHash?: string) => {
    setPaymentLog(prev => [...prev, {
      chunk: chunkIndex,
      amount,
      timestamp: new Date().toISOString(),
      txHash,
    }]);
    console.log(`💸 Nanopayment: Chunk ${chunkIndex} - ${amount} USDC to ${video?.creatorDcw}${txHash ? ` (TX: ${txHash})` : ''}`);
  };
  
  const handlePaymentError = (errorMsg: string) => {
    toast.error(errorMsg);
  };
  
  if (loading) {
    return (
      <main className="min-h-screen bg-[#1F1A31] p-4 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-4 text-[#8656EF]" size={48} />
          <p className="text-gray-300">Loading watch-worthy content...</p>
        </div>
      </main>
    );
  }
  
  if (error || !video) {
    return (
      <main className="min-h-screen bg-[#1F1A31] p-4 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="mx-auto mb-4 text-red-400" size={48} />
          <h2 className="text-xl font-bold text-white mb-2">Video Not Found</h2>
          <p className="text-gray-400 mb-6">{error || "The video you're looking for doesn't exist."}</p>
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 glow-button px-5 py-2.5 text-white rounded-xl"
          >
            <ArrowLeft size={16} />
            Back to Feed
          </Link>
        </div>
      </main>
    );
  }
  
  const { chunkSeconds, totalChunks } = calculateVideoChunks(
    video.durationSeconds, 
    video.chunkDurationSeconds
  );
  
  return (
    <main className="min-h-screen bg-[#1F1A31] retro-grid-bg">
      <header className="sticky top-0 z-50 glass-card border-b border-[#3D3458]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link 
            href="/" 
            className="flex items-center gap-2 text-gray-300 hover:text-white transition"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Back to Feed</span>
          </Link>
          
          <div className="flex items-center gap-1">
            {isCreator && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                title="Delete video"
              >
                <Trash2 size={20} />
              </button>
            )}
            <button className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition">
              <Heart size={20} />
            </button>
            <button className="p-2 text-gray-400 hover:text-[#8656EF] hover:bg-[#8656EF]/10 rounded-lg transition">
              <MessageCircle size={20} />
            </button>
            <button className="p-2 text-gray-400 hover:text-[#00C8B3] hover:bg-[#00C8B3]/10 rounded-lg transition">
              <Share2 size={20} />
            </button>
          </div>
        </div>
      </header>
      
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <WalletAuth />
        
        <div className="glass-card rounded-2xl p-6">
          <h1 className="text-2xl font-bold text-white mb-2">{video.title}</h1>
          <p className="text-gray-300 mb-4">{video.description}</p>
          
          <div className="flex flex-wrap items-center gap-5 text-sm">
            <span className="flex items-center gap-2 text-gray-400 bg-[#2D2440] px-3 py-1.5 rounded-full">
              <Clock size={14} className="text-[#8656EF]" />
              {formatDuration(video.durationSeconds)} total
            </span>
            <span className="flex items-center gap-2 text-gray-400 bg-[#2D2440] px-3 py-1.5 rounded-full">
              <DollarSign size={14} className="text-[#00C8B3]" />
              <span className="text-white font-medium">{formatUSDC(video.pricePerChunk)}</span> / {formatDuration(video.chunkDurationSeconds)}
            </span>
            <span className="flex items-center gap-2 text-gray-400 bg-[#2D2440] px-3 py-1.5 rounded-full">
              <Layers size={14} className="text-[#8656EF]" />
              {totalChunks} chunk{totalChunks !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1 text-[#22C55E] bg-[#22C55E]/10 px-3 py-1.5 rounded-full text-xs font-medium">
              ✓ First chunk FREE
            </span>
          </div>
        </div>
        
        {viewerWallet ? (
          <VideoPlayer
            videoId={video.id}
            videoUrl={video.videoUrl}
            durationSeconds={video.durationSeconds}
            chunkDurationSeconds={video.chunkDurationSeconds}
            pricePerChunk={video.pricePerChunk}
            creatorWallet={video.creatorWallet}
            creatorDcw={video.creatorDcw}
            viewerWallet={viewerWallet}
            viewerDcw={viewerDcw}
            onPaymentSuccess={handlePaymentSuccess}
            onPaymentError={handlePaymentError}
          />
        ) : (
          <div className="aspect-video bg-[#1F1A31] border border-[#3D3458] rounded-xl flex items-center justify-center">
            <div className="text-center px-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#2D2440] flex items-center justify-center">
                <LockIcon />
              </div>
              <p className="text-white text-lg font-medium mb-2">Connect Your Wallet</p>
              <p className="text-gray-400">Sign in above to start watching with nanopayments</p>
            </div>
          </div>
        )}
        
        {paymentLog.length > 0 && (
          <div className="glass-card rounded-xl p-5">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <DollarSign size={18} className="text-[#00C8B3]" />
              Payment History
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {paymentLog.map((payment, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm p-3 bg-[#2D2440] rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-300">
                      Chunk {payment.chunk + 1} <span className="text-gray-500">({formatDuration(chunkSeconds)})</span>
                    </span>
                    {payment.txHash && (
                      <a
                        href={`https://testnet.arcscan.app/tx/${payment.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] sm:text-xs text-[#8656EF] hover:text-[#00C8B3] flex items-center gap-1 transition-colors"
                        title="View on ArcScan"
                      >
                        <span className="font-mono">{payment.txHash.slice(0, 6)}...{payment.txHash.slice(-4)}</span>
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                  <span className="font-mono font-medium text-[#22C55E]">
                    -{payment.amount} USDC
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-4 flex items-center gap-1">
              <Info size={12} />
              You&apos;ve unlocked {paymentLog.length} chunk{paymentLog.length !== 1 ? 's' : ''} so far
            </p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-card rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-2">Delete Video?</h3>
            <p className="text-gray-300 mb-6">
              This will permanently delete &quot;{video.title}&quot; and all associated payment records. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2 transition"
              >
                {deleting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Yes, Delete
                  </>
                )}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 bg-[#2D2440] hover:bg-[#3D3458] text-white rounded-xl font-medium transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// Simple Lock Icon Component for empty state
function LockIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8656EF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}