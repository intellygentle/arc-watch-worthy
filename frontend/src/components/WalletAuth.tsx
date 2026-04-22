// frontend/src/components/WalletAuth.tsx
'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { SiweMessage } from 'siwe';
import { getAddress } from 'viem';
import { Wallet, Loader2, LogOut, Rocket, AlertCircle, CheckCircle, ExternalLink, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI, walletAPI } from '@/lib/api';

type DeployState = 'checking' | 'not_deployed' | 'deploying' | 'deployed' | 'error' | 'needs_funding';

export function useWallet() {
  const [eoa, setEoa] = useState<string | null>(null);
  const [dcwAddress, setDcwAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deployState, setDeployState] = useState<DeployState>('checking');
  const [balance, setBalance] = useState<string>('0');
  const [explorerUrl, setExplorerUrl] = useState<string>('');
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  const checkDeployment = useCallback(async (dcw: string) => {
    setDeployState('checking');
    try {
      const res = await walletAPI.getState(dcw);
      const data = res.data.data;
      const isDeployed = data?.isDeployed;
      const currentBalance = data?.balance || '0';
      const url = data?.explorerUrl || `https://testnet.arcscan.app/address/${dcw}`;
      
      setBalance(currentBalance);
      setExplorerUrl(url);
      
      if (isDeployed === true) {
        setDeployState('deployed');
      } else {
        const balanceNum = parseFloat(currentBalance);
        if (balanceNum < 0.001) {
          setDeployState('needs_funding');
        } else {
          setDeployState('not_deployed');
        }
      }
    } catch (err: any) {
      console.error('Check deployment error:', err);
      setDeployState('error');
    }
  }, []);

  const startPolling = useCallback((dcw: string) => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }
    
    let attempts = 0;
    const maxAttempts = 30;
    
    pollingInterval.current = setInterval(async () => {
      attempts++;
      
      try {
        const res = await walletAPI.getState(dcw);
        const data = res.data.data;
        const isDeployed = data?.isDeployed;
        const currentBalance = data?.balance || '0';
        const url = data?.explorerUrl || `https://testnet.arcscan.app/address/${dcw}`;
        
        setBalance(currentBalance);
        setExplorerUrl(url);
        
        if (isDeployed === true) {
          setDeployState('deployed');
          if (pollingInterval.current) {
            clearInterval(pollingInterval.current);
            pollingInterval.current = null;
          }
          toast.success('✅ Wallet deployed successfully!');
          return;
        }
        
        if (attempts >= maxAttempts) {
          if (pollingInterval.current) {
            clearInterval(pollingInterval.current);
            pollingInterval.current = null;
          }
          const balanceNum = parseFloat(currentBalance);
          if (balanceNum < 0.001) {
            setDeployState('needs_funding');
          } else {
            setDeployState('not_deployed');
          }
          toast.error('Deployment taking longer than expected. Please check status.');
        }
      } catch {
        // Ignore polling errors
      }
    }, 2000);
    
    setTimeout(() => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
      }
    }, 70000);
  }, []);

  useEffect(() => {
    const savedEoa = localStorage.getItem('arcstream_eoa');
    const savedDcw = localStorage.getItem('arcstream_dcw');
    if (savedEoa && savedDcw) { 
      setEoa(savedEoa); 
      setDcwAddress(savedDcw);
      checkDeployment(savedDcw);
    } else {
      setDeployState('checking');
    }
    
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [checkDeployment]);

  const connectAndLink = useCallback(async () => {
    setLoading(true);
    try {
      const provider = (window as any).ethereum;
      if (!provider) throw new Error('Install MetaMask');

      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      const mainEoa = getAddress(accounts[0]);

      const nonceRes = await authAPI.getNonce(mainEoa);
      const { nonce } = nonceRes.data.data;
      const siweMessage = new SiweMessage({
        domain: window.location.host,
        address: mainEoa,
        statement: 'Enable One-Click Viewing for Arc-Watch-Worthy',
        uri: window.location.origin,
        version: '1',
        chainId: 5042002,
        nonce: nonce,
      });

      const messageText = siweMessage.prepareMessage();
      const signature = await provider.request({ 
        method: 'personal_sign', 
        params: [messageText, mainEoa] 
      });

      const linkRes = await authAPI.linkWallet({ 
        address: mainEoa, signature, nonce, message: messageText 
      });

      const { dcwAddress: linkedDcw } = linkRes.data.data;
      setEoa(mainEoa);
      setDcwAddress(linkedDcw);
      
      localStorage.setItem('arcstream_eoa', mainEoa);
      localStorage.setItem('arcstream_dcw', linkedDcw);
      
      await checkDeployment(linkedDcw);
      toast.success('Wallet connected!');
    } catch (err: any) {
      toast.error(err.message || 'Auth failed');
    } finally {
      setLoading(false);
    }
  }, [checkDeployment]);

  const deployWallet = useCallback(async () => {
    if (!dcwAddress) return;
    setLoading(true);
    setDeployState('deploying');
    try {
      const res = await walletAPI.deploy(dcwAddress);
      const { onChainDeployed, txHash, explorerUrl: txExplorerUrl } = res.data.data || {};
      
      if (txExplorerUrl) {
        setExplorerUrl(txExplorerUrl);
      }
      
      if (onChainDeployed) {
        setDeployState('deployed');
        toast.success('✅ Wallet deployed successfully!');
      } else {
        toast.success('Deployment submitted. Waiting for confirmation...');
        startPolling(dcwAddress);
      }
    } catch (err: any) {
      const errorCode = err.response?.data?.error;
      const errorMessage = err.response?.data?.message || err.message;
      
      if (errorCode === 'INSUFFICIENT_FUNDS' || errorCode === 'NEEDS_FUNDING') {
        setDeployState('needs_funding');
        toast.error('Wallet needs funding before deployment');
      } else {
        setDeployState('not_deployed');
        toast.error(errorMessage || 'Deploy failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [dcwAddress, startPolling]);

  const refreshState = useCallback(() => {
    if (dcwAddress) {
      checkDeployment(dcwAddress);
    }
  }, [dcwAddress, checkDeployment]);

  const disconnect = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
    localStorage.removeItem('arcstream_eoa');
    localStorage.removeItem('arcstream_dcw');
    setEoa(null);
    setDcwAddress(null);
    setDeployState('checking');
    setBalance('0');
    setExplorerUrl('');
    window.location.reload();
  };

  return { 
    eoa, 
    dcwAddress, 
    loading, 
    deployState, 
    balance,
    explorerUrl,
    connectAndLink, 
    deployWallet, 
    refreshState,
    disconnect 
  };
}

export default function WalletAuth() {
  const { 
    eoa, 
    dcwAddress, 
    loading, 
    deployState, 
    balance,
    explorerUrl,
    connectAndLink, 
    deployWallet, 
    refreshState,
    disconnect 
  } = useWallet();

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {eoa ? (
          <div className="flex items-center gap-2 sm:gap-3 glass-card p-2 sm:px-4 rounded-xl shadow-lg">
            <div className="flex flex-col">
              <span className="text-[8px] sm:text-[10px] font-bold text-[#00C8B3] uppercase tracking-wider">
                Wallet Connected
              </span>
              <span className="text-xs sm:text-sm font-mono text-white">
                {dcwAddress?.slice(0, 6)}...{dcwAddress?.slice(-4)}
              </span>
            </div>
            <button 
              onClick={disconnect} 
              className="p-1.5 sm:p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Disconnect"
            >
              <LogOut size={isMobile ? 14 : 16} />
            </button>
          </div>
        ) : (
          <button 
            onClick={connectAndLink} 
            disabled={loading} 
            className="glow-button px-4 sm:px-6 py-2 sm:py-2.5 text-white rounded-xl flex items-center gap-2 transition-all disabled:opacity-50 text-sm sm:text-base"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={isMobile ? 16 : 18} />
            ) : (
              <Wallet size={isMobile ? 16 : 18} />
            )}
            Connect Wallet
          </button>
        )}
      </div>

      {/* Show deployment banner for various states */}
      {eoa && dcwAddress && deployState !== 'deployed' && deployState !== 'checking' && (
        <div className={`p-3 sm:p-4 rounded-xl border ${
          deployState === 'needs_funding' 
            ? 'bg-amber-500/10 border-amber-500/30' 
            : deployState === 'deploying'
            ? 'bg-blue-500/10 border-blue-500/30'
            : deployState === 'error'
            ? 'bg-red-500/10 border-red-500/30'
            : 'bg-amber-500/10 border-amber-500/30'
        }`}>
          <div className="flex items-start gap-2 sm:gap-3">
            {deployState === 'deploying' ? (
              <Loader2 className="text-blue-400 mt-0.5 animate-spin flex-shrink-0" size={isMobile ? 16 : 20} />
            ) : deployState === 'error' ? (
              <AlertCircle className="text-red-400 mt-0.5 flex-shrink-0" size={isMobile ? 16 : 20} />
            ) : (
              <AlertCircle className="text-amber-400 mt-0.5 flex-shrink-0" size={isMobile ? 16 : 20} />
            )}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-white text-xs sm:text-sm mb-1">
                {deployState === 'needs_funding' && '💰 Fund Your Wallet'}
                {deployState === 'not_deployed' && '🚀 Deploy Your Wallet'}
                {deployState === 'deploying' && '⏳ Deploying Wallet...'}
                {deployState === 'error' && '❌ Deployment Error'}
              </h4>
              
              <p className="text-[10px] sm:text-xs text-gray-300 mb-3">
                {deployState === 'needs_funding' && (
                  <>Your Circle wallet needs testnet USDC before it can be deployed. Current balance: {parseFloat(balance).toFixed(6)} USDC</>
                )}
                {deployState === 'not_deployed' && (
                  <>Your wallet has {parseFloat(balance).toFixed(6)} USDC and is ready to be deployed onchain.</>
                )}
                {deployState === 'deploying' && (
                  <>Deployment transaction in progress. This usually takes 30-60 seconds.</>
                )}
                {deployState === 'error' && (
                  <>Failed to check deployment status. Click refresh to retry.</>
                )}
              </p>
              
              <div className="bg-[#1F1A31] rounded-lg p-2 sm:p-3 mb-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] sm:text-xs text-gray-400">Your DCW Address:</p>
                  <button
                    onClick={refreshState}
                    className="p-1 hover:bg-[#3D3458] rounded transition-colors"
                    title="Refresh status"
                  >
                    <RefreshCw size={10} className="text-gray-400" />
                  </button>
                </div>
                <code className="text-[10px] sm:text-xs font-mono text-gray-200 break-all block mb-2">
                  {isMobile ? `${dcwAddress.slice(0, 10)}...${dcwAddress.slice(-6)}` : dcwAddress}
                </code>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs text-gray-400">Balance:</span>
                  <span className="text-[10px] sm:text-xs font-mono font-medium text-[#00C8B3]">
                    {parseFloat(balance).toFixed(6)} USDC
                  </span>
                </div>
                {explorerUrl && (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 text-[10px] sm:text-xs text-[#8656EF] hover:underline flex items-center gap-1"
                  >
                    View on ArcScan <ExternalLink size={10} />
                  </a>
                )}
              </div>

              <div className="flex flex-col xs:flex-row gap-2">
                {deployState === 'needs_funding' && (
                  <>
                    <a 
                      href="https://faucet.circle.com" 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-center px-3 py-2 bg-[#8656EF] hover:bg-[#7a4ee0] text-white rounded-lg text-xs font-medium transition flex items-center justify-center gap-1"
                    >
                      Get Testnet USDC
                      <ExternalLink size={10} />
                    </a>
                    <button
                      onClick={refreshState}
                      className="px-3 py-2 bg-[#2D2440] hover:bg-[#3D3458] text-white rounded-lg text-xs font-medium transition"
                    >
                      Check Balance
                    </button>
                  </>
                )}
                
                {deployState === 'not_deployed' && (
                  <button
                    onClick={deployWallet}
                    disabled={loading}
                    className="flex-1 px-3 py-2 bg-[#22C55E] hover:bg-[#1ea34d] text-white rounded-lg text-xs font-medium transition disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin" size={12} />
                        Deploying...
                      </>
                    ) : (
                      <>
                        <Rocket size={12} />
                        Deploy Wallet
                      </>
                    )}
                  </button>
                )}
                
                {deployState === 'deploying' && (
                  <div className="flex-1 text-center px-3 py-2 bg-blue-500/20 text-blue-300 rounded-lg text-xs font-medium">
                    Deployment in progress...
                  </div>
                )}
                
                {deployState === 'error' && (
                  <button
                    onClick={refreshState}
                    className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition flex items-center justify-center gap-1"
                  >
                    <RefreshCw size={12} />
                    Retry
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success state */}
      {eoa && deployState === 'deployed' && (
        <div className="flex flex-wrap items-center gap-2 text-[#22C55E] text-[10px] sm:text-xs bg-[#22C55E]/10 p-2 sm:p-3 rounded-lg border border-[#22C55E]/20">
          <CheckCircle size={isMobile ? 12 : 14} className="flex-shrink-0" />
          <span className="flex-1 text-white">Wallet deployed & ready for seamless payments</span>
          <span className="font-mono text-[#00C8B3]">{parseFloat(balance).toFixed(4)} USDC</span>
          {explorerUrl && !isMobile && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#8656EF] hover:underline flex items-center gap-1"
            >
              <ExternalLink size={10} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}