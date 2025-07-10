import React, { useState, useRef, useEffect } from 'react';
import { Shield, Lock, Zap, Terminal, Eye, EyeOff, CheckCircle, XCircle, Clock, Play, Pause, RotateCcw, Filter, CreditCard } from 'lucide-react';

interface CardResult {
  card: string;
  gateway: string;
  response: string;
  timestamp: string;
  status: 'approved' | 'declined' | 'processing';
  tabId: number;
  charged?: boolean;
}

interface ProcessingStats {
  total: number;
  approved: number;
  declined: number;
  processing: number;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [ccInput, setCcInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [results, setResults] = useState<CardResult[]>([]);
  const [filteredResults, setFilteredResults] = useState<CardResult[]>([]);
  const [stats, setStats] = useState<ProcessingStats>({ total: 0, approved: 0, declined: 0, processing: 0 });
  const [currentStep, setCurrentStep] = useState<'auth' | 'input' | 'processing' | 'results'>('auth');
  const [processingSpeed, setProcessingSpeed] = useState(2000);
  const [maxTabs, setMaxTabs] = useState(5);
  const [currentTabCount, setCurrentTabCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'approved' | 'declined'>('all');
  const [chargedCards, setChargedCards] = useState<Set<number>>(new Set());
  const processingRef = useRef<boolean>(false);
  const pausedRef = useRef<boolean>(false);

  // Only these responses count as approved
  const approvedResponses = [
    'Order is confirmed -> $19',
    'Order confirmed -> $19',
    'Order Confirmed -> $19'
  ];

  const declinedResponses = [
    'INSUFFICIENT_FUNDS',
    'CARD_DECLINED',
    'EXPIRED_CARD',
    'CVV_FAILURE',
    'INVALID_CARD',
    'DECLINED',
    'TRANSACTION_DECLINED',
    'PAYMENT_FAILED',
    'CARD_NOT_SUPPORTED',
    'LIMIT_EXCEEDED',
    'SECURITY_VIOLATION',
    'BLOCKED_CARD',
    'INVALID_EXPIRY',
    'PROCESSING_ERROR',
    'NETWORK_ERROR',
    'TIMEOUT_ERROR',
    'FRAUD_DETECTED',
    'ACCOUNT_CLOSED',
    'DAILY_LIMIT_EXCEEDED',
    'MERCHANT_BLOCKED'
  ];

  const gateways = [
    'Stripe + Shopify €122',
    'PayPal Gateway Pro',
    'Square Payment Plus',
    'Authorize.Net Elite',
    'Braintree Advanced',
    'Adyen Premium'
  ];

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'config_mere_papa') {
      setIsAuthenticated(true);
      setCurrentStep('input');
    } else {
      alert('Access Denied - Invalid Password');
    }
  };

  const updateStats = (newResults: CardResult[]) => {
    const approved = newResults.filter(r => r.status === 'approved').length;
    const declined = newResults.filter(r => r.status === 'declined').length;
    const processing = newResults.filter(r => r.status === 'processing').length;
    
    setStats({
      total: newResults.length,
      approved,
      declined,
      processing
    });
  };

  const applyFilter = (results: CardResult[], filterType: 'all' | 'approved' | 'declined') => {
    switch (filterType) {
      case 'approved':
        return results.filter(r => r.status === 'approved');
      case 'declined':
        return results.filter(r => r.status === 'declined');
      default:
        return results;
    }
  };

  useEffect(() => {
    setFilteredResults(applyFilter(results, filter));
  }, [results, filter]);

  const handleCharge = (tabId: number) => {
    setChargedCards(prev => new Set([...prev, tabId]));
    setResults(prev => prev.map(result => 
      result.tabId === tabId ? { ...result, charged: true } : result
    ));
  };

  const processCardBatch = async (cards: string[], startIndex: number = 0) => {
    if (!processingRef.current) return;

    const remainingCards = cards.slice(startIndex);
    const batchSize = Math.min(maxTabs, remainingCards.length);
    
    if (batchSize === 0) {
      setIsProcessing(false);
      setCurrentStep('results');
      setCurrentTabCount(0);
      return;
    }

    const currentBatch = remainingCards.slice(0, batchSize);
    setCurrentTabCount(currentBatch.length);

    // Process batch in parallel (simulating multiple tabs)
    const batchPromises = currentBatch.map(async (card, index) => {
      const tabId = startIndex + index + 1;
      
      // Add processing result immediately
      const processingResult: CardResult = {
        card: card.trim(),
        gateway: gateways[Math.floor(Math.random() * gateways.length)],
        response: 'Processing...',
        timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
        status: 'processing',
        tabId
      };

      setResults(prev => {
        const updated = [...prev, processingResult];
        updateStats(updated);
        return updated;
      });

      // Wait for processing delay
      await new Promise(resolve => setTimeout(resolve, processingSpeed + Math.random() * 1000));

      // Check if still processing and not paused
      if (!processingRef.current) return null;

      // Wait if paused
      while (pausedRef.current && processingRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (!processingRef.current) return null;

      // Determine result - Much lower approval rate (5-10%)
      const isApproved = Math.random() < 0.08; // Only 8% approval rate
      const response = isApproved 
        ? approvedResponses[Math.floor(Math.random() * approvedResponses.length)]
        : declinedResponses[Math.floor(Math.random() * declinedResponses.length)];

      const finalResult: CardResult = {
        ...processingResult,
        response,
        status: isApproved ? 'approved' : 'declined',
        timestamp: new Date().toISOString().slice(0, 19).replace('T', ' ')
      };

      // Update the result
      setResults(prev => {
        const updated = prev.map(r => 
          r.tabId === tabId ? finalResult : r
        );
        updateStats(updated);
        return updated;
      });

      return finalResult;
    });

    await Promise.all(batchPromises);

    // Process next batch
    if (processingRef.current && startIndex + batchSize < cards.length) {
      await processCardBatch(cards, startIndex + batchSize);
    } else {
      setIsProcessing(false);
      setCurrentStep('results');
      setCurrentTabCount(0);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cards = ccInput.split('\n').filter(card => card.trim() !== '');
    
    if (cards.length === 0) {
      alert('Please enter card details');
      return;
    }

    setIsProcessing(true);
    setCurrentStep('processing');
    setResults([]);
    setStats({ total: 0, approved: 0, declined: 0, processing: 0 });
    setFilter('all');
    setChargedCards(new Set());
    processingRef.current = true;
    pausedRef.current = false;
    setIsPaused(false);

    processCardBatch(cards);
  };

  const togglePause = () => {
    pausedRef.current = !pausedRef.current;
    setIsPaused(pausedRef.current);
  };

  const stopProcessing = () => {
    processingRef.current = false;
    setIsProcessing(false);
    setIsPaused(false);
    pausedRef.current = false;
    setCurrentTabCount(0);
    if (results.length > 0) {
      setCurrentStep('results');
    }
  };

  const resetApp = () => {
    processingRef.current = false;
    setCurrentStep('input');
    setCcInput('');
    setResults([]);
    setStats({ total: 0, approved: 0, declined: 0, processing: 0 });
    setIsProcessing(false);
    setIsPaused(false);
    setCurrentTabCount(0);
    setFilter('all');
    setChargedCards(new Set());
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'declined':
        return <XCircle className="h-4 w-4 text-red-400" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-yellow-400 animate-spin" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'text-green-400 border-green-500/30 bg-green-500/10';
      case 'declined':
        return 'text-red-400 border-red-500/30 bg-red-500/10';
      case 'processing':
        return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
      default:
        return 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10';
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black text-cyan-400 font-mono flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-cyan-900/20"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/10 via-transparent to-cyan-900/10"></div>
        
        <div className="relative z-10 bg-black/80 backdrop-blur-sm border border-cyan-500/50 rounded-lg p-8 shadow-2xl max-w-md w-full mx-4">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <Shield className="h-12 w-12 text-cyan-400 mr-3" />
              <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
                CYPHER ACCESS
              </h1>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-cyan-500 to-transparent"></div>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            <div className="relative">
              <label className="block text-cyan-300 text-sm font-medium mb-2">
                ACCESS CODE
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/50 border border-cyan-500/50 rounded px-4 py-3 text-cyan-100 placeholder-cyan-500/50 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition-all duration-200"
                  placeholder="Enter access code..."
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 text-black font-bold py-3 px-6 rounded transition-all duration-200 hover:from-cyan-400 hover:to-purple-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transform hover:scale-105"
            >
              <Lock className="inline-block h-5 w-5 mr-2" />
              AUTHENTICATE
            </button>
          </form>

          <div className="mt-6 text-center text-cyan-500/70 text-sm">
            <p>Ultra High-Speed Multi-Tab Processing</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-cyan-400 font-mono">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-cyan-900/20"></div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/10 via-transparent to-cyan-900/10"></div>
      
      <div className="relative z-10 container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Terminal className="h-8 w-8 text-cyan-400 mr-3" />
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
              CYPHER TERMINAL
            </h1>
            <Zap className="h-8 w-8 text-purple-400 ml-3" />
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-cyan-500 to-transparent"></div>
          <p className="text-cyan-300 mt-4">ULTRA HIGH-SPEED MULTI-TAB PROCESSOR • UNLIMITED CAPACITY</p>
        </header>

        {/* Stats Dashboard */}
        {(currentStep === 'processing' || currentStep === 'results') && (
          <div className="mb-8 grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-black/80 backdrop-blur-sm border border-cyan-500/50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-cyan-400">{stats.total}</div>
              <div className="text-sm text-cyan-300">Total</div>
            </div>
            <div className="bg-black/80 backdrop-blur-sm border border-green-500/50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{stats.approved}</div>
              <div className="text-sm text-green-300">Approved</div>
            </div>
            <div className="bg-black/80 backdrop-blur-sm border border-red-500/50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-red-400">{stats.declined}</div>
              <div className="text-sm text-red-300">Declined</div>
            </div>
            <div className="bg-black/80 backdrop-blur-sm border border-yellow-500/50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-yellow-400">{stats.processing}</div>
              <div className="text-sm text-yellow-300">Processing</div>
            </div>
            <div className="bg-black/80 backdrop-blur-sm border border-purple-500/50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-purple-400">{currentTabCount}</div>
              <div className="text-sm text-purple-300">Active Tabs</div>
            </div>
          </div>
        )}

        {currentStep === 'input' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-black/80 backdrop-blur-sm border border-cyan-500/50 rounded-lg p-6 shadow-2xl">
              <h2 className="text-2xl font-bold mb-6 text-center text-cyan-300">
                ULTRA HIGH-SPEED PROCESSOR
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-cyan-300 text-sm font-medium mb-2">
                    Processing Speed (ms)
                  </label>
                  <input
                    type="range"
                    min="500"
                    max="5000"
                    value={processingSpeed}
                    onChange={(e) => setProcessingSpeed(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="text-center text-cyan-400 text-sm mt-1">{processingSpeed}ms</div>
                </div>
                <div>
                  <label className="block text-cyan-300 text-sm font-medium mb-2">
                    Max Concurrent Tabs
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={maxTabs}
                    onChange={(e) => setMaxTabs(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="text-center text-cyan-400 text-sm mt-1">{maxTabs} tabs</div>
                </div>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-cyan-300 text-sm font-medium mb-2">
                    CARD DATA (Unlimited entries, one per line)
                  </label>
                  <textarea
                    value={ccInput}
                    onChange={(e) => setCcInput(e.target.value)}
                    rows={12}
                    className="w-full bg-black/50 border border-cyan-500/50 rounded px-4 py-3 text-cyan-100 placeholder-cyan-500/50 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition-all duration-200 resize-none font-mono text-sm"
                    placeholder="4111111111111111|12|2025|123&#10;5555555555554444|06|2024|456&#10;4000000000000002|03|2026|789&#10;..."
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 text-black font-bold py-3 px-6 rounded transition-all duration-200 hover:from-cyan-400 hover:to-purple-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transform hover:scale-105"
                >
                  <Zap className="inline-block h-5 w-5 mr-2" />
                  INITIALIZE ULTRA-SPEED PROCESSING
                </button>
              </form>
            </div>
          </div>
        )}

        {currentStep === 'processing' && (
          <div className="max-w-6xl mx-auto">
            <div className="bg-black/80 backdrop-blur-sm border border-cyan-500/50 rounded-lg p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-cyan-300">
                  MULTI-TAB PROCESSING...
                </h2>
                <div className="flex space-x-2">
                  <button
                    onClick={togglePause}
                    className="bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 px-4 py-2 rounded hover:bg-yellow-500/30 transition-colors"
                  >
                    {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={stopProcessing}
                    className="bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-2 rounded hover:bg-red-500/30 transition-colors"
                  >
                    Stop
                  </button>
                </div>
              </div>
              
              <div className="text-center mb-6">
                <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-400"></div>
                <p className="text-cyan-300 mt-2">
                  {isPaused ? 'PAUSED' : `Processing with ${currentTabCount} active tabs...`}
                </p>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {results.map((result, index) => (
                  <div key={index} className={`border rounded p-3 ${getStatusColor(result.status)}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(result.status)}
                        <span className="text-sm font-mono">Tab #{result.tabId}</span>
                      </div>
                      <span className="text-xs">{result.timestamp}</span>
                    </div>
                    <pre className="text-xs mt-2 whitespace-pre-wrap">
{`𝘾𝘼𝙍𝘿 ↯ ${result.card}
𝙂𝘼𝙏𝙀𝙒𝘼𝙔 ↯ ${result.gateway}
𝙍𝙀𝙎𝙋𝙊𝙉𝙎𝙀 ↯ ${result.response}
𝙎𝙏𝘼𝙏𝙐𝙎 ↯ ${result.status.toUpperCase()}
└─────────────────────┘`}
                    </pre>
                    {result.status === 'approved' && (
                      <div className="mt-3 flex justify-end">
                        {result.charged ? (
                          <span className="bg-purple-500/30 border border-purple-500/50 text-purple-300 px-3 py-1 rounded text-sm font-medium">
                            <CreditCard className="inline-block h-4 w-4 mr-1" />
                            Charged
                          </span>
                        ) : (
                          <button
                            onClick={() => handleCharge(result.tabId)}
                            className="bg-green-500/20 border border-green-500/50 text-green-300 px-3 py-1 rounded text-sm font-medium hover:bg-green-500/30 transition-colors"
                          >
                            <CreditCard className="inline-block h-4 w-4 mr-1" />
                            Charge
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentStep === 'results' && (
          <div className="max-w-6xl mx-auto">
            <div className="bg-black/80 backdrop-blur-sm border border-cyan-500/50 rounded-lg p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-cyan-300">
                  PROCESSING COMPLETE
                </h2>
                
                {/* Filter Buttons */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                      filter === 'all' 
                        ? 'bg-cyan-500/30 border border-cyan-500/50 text-cyan-300' 
                        : 'bg-black/50 border border-gray-500/50 text-gray-400 hover:text-cyan-300'
                    }`}
                  >
                    <Filter className="inline-block h-4 w-4 mr-1" />
                    All ({stats.total})
                  </button>
                  <button
                    onClick={() => setFilter('approved')}
                    className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                      filter === 'approved' 
                        ? 'bg-green-500/30 border border-green-500/50 text-green-300' 
                        : 'bg-black/50 border border-gray-500/50 text-gray-400 hover:text-green-300'
                    }`}
                  >
                    <CheckCircle className="inline-block h-4 w-4 mr-1" />
                    Approved ({stats.approved})
                  </button>
                  <button
                    onClick={() => setFilter('declined')}
                    className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                      filter === 'declined' 
                        ? 'bg-red-500/30 border border-red-500/50 text-red-300' 
                        : 'bg-black/50 border border-gray-500/50 text-gray-400 hover:text-red-300'
                    }`}
                  >
                    <XCircle className="inline-block h-4 w-4 mr-1" />
                    Declined ({stats.declined})
                  </button>
                </div>
              </div>
              
              <div className="space-y-2 mb-6 max-h-96 overflow-y-auto">
                {filteredResults.map((result, index) => (
                  <div key={index} className={`border rounded p-3 ${getStatusColor(result.status)}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(result.status)}
                        <span className="text-sm font-mono">Tab #{result.tabId}</span>
                      </div>
                      <span className="text-xs">{result.timestamp}</span>
                    </div>
                    <pre className="text-xs mt-2 whitespace-pre-wrap">
{`𝘾𝘼𝙍𝘿 ↯ ${result.card}
𝙂𝘼𝙏𝙀𝙒𝘼𝙔 ↯ ${result.gateway}
𝙍𝙀𝙎𝙋𝙊𝙉𝙎𝙀 ↯ ${result.response}
𝙎𝙏𝘼𝙏𝙐𝙎 ↯ ${result.status.toUpperCase()}
└─────────────────────┘`}
                    </pre>
                    {result.status === 'approved' && (
                      <div className="mt-3 flex justify-end">
                        {result.charged ? (
                          <span className="bg-purple-500/30 border border-purple-500/50 text-purple-300 px-3 py-1 rounded text-sm font-medium">
                            <CreditCard className="inline-block h-4 w-4 mr-1" />
                            Charged
                          </span>
                        ) : (
                          <button
                            onClick={() => handleCharge(result.tabId)}
                            className="bg-green-500/20 border border-green-500/50 text-green-300 px-3 py-1 rounded text-sm font-medium hover:bg-green-500/30 transition-colors"
                          >
                            <CreditCard className="inline-block h-4 w-4 mr-1" />
                            Charge
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="text-center">
                <button
                  onClick={resetApp}
                  className="bg-gradient-to-r from-purple-500 to-cyan-500 text-black font-bold py-3 px-8 rounded transition-all duration-200 hover:from-purple-400 hover:to-cyan-400 focus:outline-none focus:ring-2 focus:ring-purple-400/50 transform hover:scale-105"
                >
                  <RotateCcw className="inline-block h-5 w-5 mr-2" />
                  NEW PROCESSING SESSION
                </button>
              </div>
            </div>
          </div>
        )}

        <footer className="text-center mt-12 text-cyan-500/70 text-sm">
          <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent mb-4"></div>
          <p>⚡ ULTRA HIGH-SPEED MULTI-TAB PROCESSOR ⚡</p>
          <p className="mt-2">Educational Testing Environment - Unlimited Capacity</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
