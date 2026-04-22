// frontend/src/app/upload/page.tsx

'use client';

import { useState, ChangeEvent, FormEvent, useRef } from 'react';
import { useWallet } from '@/components/WalletAuth';
import { videoAPI } from '@/lib/api';
import { upload } from '@vercel/blob/client';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { Upload as UploadIcon, FileVideo, Loader2, DollarSign, Settings, X, Info } from 'lucide-react';
import { formatDuration } from '@/config/app';


interface UploadForm {
  title: string;
  description: string;
  durationSeconds: string;
  chunkUnit: 'seconds' | 'minutes';
  chunkValue: string;
  pricePerChunk: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB

export default function UploadPage() {
  const { eoa: eoaAddress, dcwAddress } = useWallet();
  const router = useRouter();
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const [form, setForm] = useState<UploadForm>({
    title: '',
    description: '',
    durationSeconds: '',
    chunkUnit: 'minutes',
    chunkValue: '5',
    pricePerChunk: '0.001',
  });
  const [submitting, setSubmitting] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const uploadDirectToBlob = async (file: File): Promise<string> => {
    console.log('📤 Starting client upload to Vercel Blob...');
    
    const handleUploadUrl = `${process.env.NEXT_PUBLIC_API_URL}/videos/upload-token`;
    console.log('   handleUploadUrl:', handleUploadUrl);
    
    abortControllerRef.current = new AbortController();
    
    // @ts-ignore - onUploadProgress exists but types might be outdated
    const blob = await upload(file.name, file, {
      access: 'public',
      handleUploadUrl: handleUploadUrl,
      clientPayload: JSON.stringify({
        eoaAddress: eoaAddress,
        filename: file.name,
      }),
      abortSignal: abortControllerRef.current.signal,
      onUploadProgress: (progressEvent: { loaded: number; total: number; percentage: number }) => {
        const percent = Math.round(progressEvent.percentage);
        setUploadProgress(percent);
        setUploadStatus(`Uploading... ${percent}%`);
        console.log(`📊 Upload progress: ${percent}% (${(progressEvent.loaded / 1024 / 1024).toFixed(2)} MB / ${(progressEvent.total / 1024 / 1024).toFixed(2)} MB)`);
      },
    });

    console.log('✅ Blob upload complete:', blob.url);
    return blob.url;
  };

  const processFile = (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File size must be less than 5GB`);
      return;
    }
    
    setVideoFile(file);
    setUploadProgress(0);
    setUploadStatus('');
    
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const duration = Math.floor(video.duration);
      setVideoDuration(duration);
      setForm(prev => ({ 
        ...prev, 
        durationSeconds: duration.toString(),
        title: prev.title || file.name.replace(/\.[^/.]+$/, "")
      }));
      URL.revokeObjectURL(video.src);
    };
    video.src = URL.createObjectURL(file);
    
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    toast.success(`✅ Selected: ${file.name} (${sizeMB} MB)`);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) {
      processFile(file);
    } else {
      toast.error('Please drop a valid video file');
    }
  };

  const handleCancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setSubmitting(false);
    setUploadProgress(0);
    setUploadStatus('');
    toast.error('Upload cancelled');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!eoaAddress || !dcwAddress) {
      toast.error('Connect wallet first');
      return;
    }
    
    if (!videoFile) {
      toast.error('Please select a video file to upload');
      return;
    }

    if (!form.durationSeconds || parseInt(form.durationSeconds) < 1) {
      toast.error('Please enter a valid video duration');
      return;
    }

    setSubmitting(true);
    setUploadProgress(0);
    setUploadStatus('Preparing upload...');
    
    const sizeMB = (videoFile.size / (1024 * 1024)).toFixed(2);
    toast.loading(`Starting upload (${sizeMB} MB)...`, { id: 'upload-toast' });

    try {
      const videoUrl = await uploadDirectToBlob(videoFile);
      
      toast.dismiss('upload-toast');
      toast.success('✅ Upload complete! Saving video...', { id: 'save-toast' });
      setUploadStatus('Saving video metadata...');
      
      const res = await videoAPI.confirmUpload({
        videoUrl,
        title: form.title,
        description: form.description,
        durationSeconds: form.durationSeconds,
        chunkUnit: form.chunkUnit,
        chunkValue: form.chunkValue,
        pricePerChunk: form.pricePerChunk,
      }, eoaAddress);
      
      toast.dismiss('save-toast');
      toast.success('✅ Video published successfully!');
      router.push(`/watch/${res.data.data.id}`);
      
    } catch (err: any) {
      toast.dismiss('upload-toast');
      toast.dismiss('save-toast');
      console.error('Upload error:', err);
      
      if (err.name === 'AbortError' || err.message?.includes('abort')) {
        toast.error('Upload cancelled');
      } else {
        toast.error(err.message || 'Failed to publish video');
      }
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
      setUploadStatus('');
      abortControllerRef.current = null;
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const getChunkSeconds = (): number => {
    const value = parseFloat(form.chunkValue) || 5;
    return form.chunkUnit === 'minutes' ? Math.round(value * 60) : Math.round(value);
  };
  
  const chunkSeconds = getChunkSeconds();
  const durationSec = parseInt(form.durationSeconds) || 0;
  const totalChunks = durationSec > 0 ? Math.ceil(durationSec / chunkSeconds) : 0;
  const totalCost = totalChunks * parseFloat(form.pricePerChunk || '0.001');
  const isValidChunk = chunkSeconds >= 5 && chunkSeconds <= 3600 && chunkSeconds <= (durationSec || Infinity);

  const fileSizeMB = videoFile ? (videoFile.size / (1024 * 1024)).toFixed(2) : '0';

  return (
    <main className="min-h-screen bg-[#1F1A31] retro-grid-bg p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-[#8656EF] to-[#00C8B3] bg-clip-text text-transparent mb-2 flex items-center gap-2">
          <UploadIcon size={28} className="text-[#8656EF]" />
          Publish Watch-Worthy Content
        </h1>
        <p className="text-gray-400 mb-6">Set your price per chunk. Quality content earns more.</p>
        
        <div className="glass-card rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* File Upload Area */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select Video File
              </label>
              <div 
                className={`border-2 border-dashed rounded-xl p-8 text-center transition cursor-pointer ${
                  isDragging 
                    ? 'border-[#8656EF] bg-[#8656EF]/10' 
                    : videoFile 
                      ? 'border-[#22C55E] bg-[#22C55E]/5' 
                      : 'border-[#3D3458] hover:border-[#8656EF]/50'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !submitting && document.getElementById('video-file')?.click()}
              >
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id="video-file"
                  disabled={submitting}
                />
                <FileVideo size={48} className={`mx-auto mb-3 ${videoFile ? 'text-[#22C55E]' : 'text-[#8656EF]/60'}`} />
                <p className="text-white font-medium">
                  {videoFile ? videoFile.name : 'Click or drag video here'}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  MP4, MOV, or WebM (Up to 5GB direct upload)
                </p>
              </div>
              {videoFile && !submitting && (
                <div className="flex justify-between text-xs text-gray-400 px-1 mt-2">
                  <span>Size: {fileSizeMB} MB</span>
                  {videoDuration && <span>Duration: {formatDuration(videoDuration)}</span>}
                </div>
              )}
            </div>

            {/* Upload Progress Bar */}
            {submitting && (
              <div className="p-4 bg-[#2D2440] rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-300">
                    {uploadStatus || 'Preparing upload...'}
                  </span>
                  <span className="text-sm font-bold text-[#00C8B3]">
                    {uploadProgress}%
                  </span>
                </div>
                <div className="w-full h-3 bg-[#1F1A31] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#8656EF] to-[#00C8B3] transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mt-2">
                  <p className="text-xs text-gray-400">
                    {uploadProgress < 100 ? 'Uploading... Please do not close this page.' : 'Processing...'}
                  </p>
                  <button
                    type="button"
                    onClick={handleCancelUpload}
                    className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                  >
                    <X size={12} /> Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Title</label>
              <input 
                name="title" 
                required 
                value={form.title} 
                onChange={handleChange} 
                placeholder="My Watch-Worthy Video"
                disabled={submitting}
                className="w-full p-3 bg-[#1F1A31] border border-[#3D3458] rounded-xl text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-[#8656EF] disabled:opacity-50 transition" 
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
              <textarea 
                name="description" 
                required 
                value={form.description} 
                onChange={handleChange} 
                rows={3} 
                placeholder="Tell viewers why this content is worth their money..."
                disabled={submitting}
                className="w-full p-3 bg-[#1F1A31] border border-[#3D3458] rounded-xl text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-[#8656EF] disabled:opacity-50 transition resize-none" 
              />
            </div>

            {/* Duration & Price */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Duration (seconds)</label>
                <input 
                  name="durationSeconds" 
                  type="number" 
                  required 
                  value={form.durationSeconds} 
                  onChange={handleChange} 
                  min="1"
                  disabled={submitting}
                  className="w-full p-3 bg-[#1F1A31] border border-[#3D3458] rounded-xl text-white outline-none focus:ring-2 focus:ring-[#8656EF] disabled:opacity-50 transition" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-1">
                  <DollarSign size={14} className="text-[#00C8B3]" />
                  Price / Chunk (USDC)
                </label>
                <input 
                  name="pricePerChunk" 
                  type="number" 
                  step="0.000001" 
                  required 
                  value={form.pricePerChunk} 
                  onChange={handleChange} 
                  min="0.000001"
                  max="0.01"
                  disabled={submitting}
                  className="w-full p-3 bg-[#1F1A31] border border-[#3D3458] rounded-xl text-white outline-none focus:ring-2 focus:ring-[#8656EF] disabled:opacity-50 transition" 
                />
              </div>
            </div>

            {/* Chunk Configuration */}
            <div className="p-4 bg-[#2D2440] rounded-xl border border-[#3D3458]">
              <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                <Settings size={16} className="text-[#8656EF]" /> Chunk Configuration
              </label>
              <div className="flex gap-2">
                <input 
                  name="chunkValue" 
                  type="number" 
                  value={form.chunkValue} 
                  onChange={handleChange} 
                  min="1"
                  disabled={submitting}
                  className="flex-1 p-3 bg-[#1F1A31] border border-[#3D3458] rounded-xl text-white outline-none focus:ring-2 focus:ring-[#8656EF] disabled:opacity-50 transition" 
                />
                <select 
                  name="chunkUnit" 
                  value={form.chunkUnit} 
                  onChange={handleChange} 
                  disabled={submitting}
                  className="w-32 p-3 bg-[#1F1A31] border border-[#3D3458] rounded-xl text-white outline-none focus:ring-2 focus:ring-[#8656EF] disabled:opacity-50 transition"
                >
                  <option value="seconds">Seconds</option>
                  <option value="minutes">Minutes</option>
                </select>
              </div>
              <div className="mt-3 flex justify-between items-end">
                <p className="text-xs text-gray-400">
                  Total Chunks: <span className="font-bold text-[#8656EF]">{totalChunks}</span><br /> 
                  Total Cost: <span className="font-bold text-[#00C8B3]">${totalCost.toFixed(4)} USDC</span>
                </p>
                {!isValidChunk && durationSec > 0 && (
                   <p className="text-[10px] text-red-400 font-medium italic">
                     {chunkSeconds < 5 ? 'Min 5 seconds' : 
                      chunkSeconds > 3600 ? 'Max 60 minutes' : 
                      'Exceeds video duration'}
                   </p>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || !eoaAddress || !videoFile || !isValidChunk}
              className="w-full py-4 glow-button text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  {uploadStatus || 'Uploading...'}
                </>
              ) : (
                '🚀 Publish to Arc-Watch-Worthy'
              )}
            </button>
          </form>
        </div>
        
        {/* Tips */}
        <div className="mt-6 p-5 bg-gradient-to-r from-[#8656EF]/10 to-[#00C8B3]/10 rounded-xl border border-[#3D3458]">
          <h3 className="font-medium text-white mb-2 flex items-center gap-2">
            <Info size={16} className="text-[#8656EF]" /> Upload Tips
          </h3>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• Maximum file size: <span className="text-[#00C8B3]">5GB</span> (Vercel Blob)</li>
            <li>• Minimum chunk: <span className="text-[#8656EF]">5 seconds</span></li>
            <li>• Maximum chunk: <span className="text-[#8656EF]">60 minutes</span> (3600 seconds)</li>
            <li>• First chunk is always <span className="text-[#22C55E]">free</span> for preview</li>
            <li>• Quality content earns more - viewers pay only for what's worthy</li>
          </ul>
        </div>
      </div>
    </main>
  );
}