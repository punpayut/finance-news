import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, TrendingUp, Calendar, Sparkles, Loader2, List, Activity, Eye } from 'lucide-react'; 
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

// <<< MODIFIED #1: Get the backend URL from environment variables. >>>
// This is the most important change. Vite will replace this with the actual URL during build.
const BACKEND_URL = import.meta.env.VITE_API_BASE_URL;

interface StockData {
  symbol: string;
  price: number;
  change: number;
  percent_change: number;
}

interface NewsItem {
  id: string;
  title: string;
  link: string;
  source: string;
  published: string;
  content?: string;
  analysis?: {
    summary_en?: string;
    summary_th?: string;
    impact?: string;
    impact_score?: number;
    affected_symbols?: string[];
  };
}

interface DailyBrief {
  market_headline: string;
  market_overview: string;
  key_drivers_and_outlook: string[];
  movers_and_shakers: string[];
  period: 'AM' | 'PM';
  generated_at_utc: {
    _seconds: number;
    _nanoseconds: number;
  };
}

type SwipeDirection = 'center' | 'left' | 'right';

const Index = () => {
  const [currentNewsIndex, setCurrentNewsIndex] = useState(0);
  const [currentView, setCurrentView] = useState<SwipeDirection>('center');
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const [news, setNews] = useState<NewsItem[]>([]);
  const [stocks, setStocks] = useState<Record<string, StockData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [userQuestion, setUserQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [askingQuestion, setAskingQuestion] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);

  const [dailyBrief, setDailyBrief] = useState<DailyBrief | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllData = async () => {
      // <<< MODIFIED #2: Throw an error if the backend URL is not set. >>>
      if (!BACKEND_URL) {
        setError("Configuration error: The backend API URL is not set.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setBriefError(null);

        // <<< MODIFIED #3: Use the full URL for the main_feed endpoint. >>>
        console.log(`Fetching main feed from: ${BACKEND_URL}/api/main_feed`);
        const mainFeedResponse = await fetch(`${BACKEND_URL}/api/main_feed`);

        if (!mainFeedResponse.ok) {
          throw new Error(`HTTP error! status: ${mainFeedResponse.status}`);
        }
        const mainFeedResult = await mainFeedResponse.json();
        if (mainFeedResult.status === 'success') {
          setNews(mainFeedResult.data.news);
          setStocks(mainFeedResult.data.stocks);
        } else {
          setError(mainFeedResult.message || 'Failed to fetch data.');
        }

        try {
          // <<< MODIFIED #4: Use the full URL for the daily_brief endpoint. >>>
          console.log(`Fetching daily brief from: ${BACKEND_URL}/api/daily_brief`);
          const briefResponse = await fetch(`${BACKEND_URL}/api/daily_brief`);

          if (briefResponse.ok) {
            const briefResult = await briefResponse.json();
            if (briefResult.status === 'success') {
              setDailyBrief(briefResult.data);
            } else {
              setBriefError(briefResult.message);
            }
          } else {
            setBriefError(`Brief not available (HTTP ${briefResponse.status})`);
          }
        } catch (briefFetchError) {
          console.error("Could not fetch daily brief:", briefFetchError);
          setBriefError("Could not connect to the briefing service.");
        }

      } catch (e: any) {
        setError(e.message || 'An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  const handleAskQuestion = async () => {
    if (!userQuestion.trim()) return;

    // <<< MODIFIED #5: Add check for backend URL before making the API call. >>>
    if (!BACKEND_URL) {
      setQaError("Configuration error: Backend API URL is missing.");
      return;
    }

    try {
      setAskingQuestion(true);
      setQaError(null);
      setAiAnswer('');

      // <<< MODIFIED #6: Use the full URL for the ask endpoint. >>>
      console.log(`Asking question to: ${BACKEND_URL}/api/ask`);
      const response = await fetch(`${BACKEND_URL}/api/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: userQuestion }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.status === 'success') {
        setAiAnswer(result.answer);
      } else {
        setQaError(result.message || 'Failed to get AI answer.');
      }
    } catch (e: any) {
      setQaError(e.message || 'An unexpected error occurred during Q&A.');
    } finally {
      setAskingQuestion(false);
    }
  };

  // ... (No other changes needed below this line) ...
  // ... (The rest of your component's logic and JSX remains the same) ...

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setStartY(e.touches[0].clientY);
    setIsDragging(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDragging) return;

    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;

    const diffX = startX - endX;
    const diffY = startY - endY;

    if (Math.abs(diffX) > Math.abs(diffY)) {
        if (Math.abs(diffX) > 50) {
            const isSwipeLeft = diffX > 0;
            const isSwipeRight = diffX < 0;

            if (isSwipeLeft) {
                if (currentView === 'right') setCurrentView('center');
                else if (currentView === 'center') setCurrentView('left');
            } else if (isSwipeRight) {
                if (currentView === 'left') setCurrentView('center');
                else if (currentView === 'center') setCurrentView('right');
            }
        }
    } else {
        if (currentView === 'center' && Math.abs(diffY) > 50) {
            if (diffY > 0) {
                nextNews();
            } else {
                prevNews();
            }
        }
    }
    setIsDragging(false);
};

  const handleMouseDown = (e: React.MouseEvent) => {
    setStartX(e.clientX);
    setIsDragging(true);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const endX = e.clientX;
    const diffX = startX - endX;
    
    if (Math.abs(diffX) > 50) {
      const isSwipeLeft = diffX > 0;
      const isSwipeRight = diffX < 0;

      if (isSwipeLeft) {
        if (currentView === 'right') {
          setCurrentView('center');
        } else if (currentView === 'center') {
          setCurrentView('left');
        }
      } else if (isSwipeRight) {
        if (currentView === 'left') {
          setCurrentView('center');
        } else if (currentView === 'center') {
          setCurrentView('right');
        }
      }
    }
    setIsDragging(false);
};

  const nextNews = () => {
    setCurrentNewsIndex((prev) => (prev + 1) % news.length);
  };

  const prevNews = () => {
    setCurrentNewsIndex((prev) => (prev - 1 + news.length) % news.length);
  };

  const currentNewsItem = news[currentNewsIndex];

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-black text-white">
        <Loader2 className="h-8 w-8 animate-spin mr-2" /> Loading financial news...
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-black text-red-500">
        Error: {error}
      </div>
    );
  }

  if (news.length === 0) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-black text-gray-400">
        No news available.
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const parts = dateString.match(/(\d{1,2}) (\S{3})\.? (\d{4}), (\d{2}):(\d{2})/);
    if (parts) {
      const day = parts[1];
      const thaiMonthAbbr = parts[2];
      const year = parts[3];
      const time = `${parts[4]}:${parts[5]}`;

      const thaiMonthMap: { [key: string]: string } = {
        "ม.ค.": "Jan", "ก.พ.": "Feb", "มี.ค.": "Mar", "เม.ย.": "Apr", "พ.ค.": "May", "มิ.ย.": "Jun",
        "ก.ค.": "Jul", "ส.ค.": "Aug", "ก.ย.": "Sep", "ต.ค.": "Oct", "พ.ย.": "Nov", "ธ.ค.": "Dec"
      };
      const englishMonth = thaiMonthMap[thaiMonthAbbr];

      if (englishMonth) {
        const date = new Date(`${englishMonth} ${day}, ${year} ${time}`);
        if (!isNaN(date.getTime())) {
          return `${day} ${thaiMonthAbbr} ${year}, ${time}`;
        }
      }
    }
    return dateString;
  };

  const formatBriefTimestamp = (timestamp: { _seconds: number }) => {
    if (!timestamp?._seconds) return 'N/A';
    const date = new Date(timestamp._seconds * 1000);
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  };

  return (
    <div className="h-screen w-full overflow-hidden bg-black text-white relative">
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex space-x-2 z-20">
        <div className={`w-2 h-2 rounded-full ${currentView === 'right' ? 'bg-blue-500' : 'bg-gray-600'}`} />
        <div className={`w-2 h-2 rounded-full ${currentView === 'center' ? 'bg-white' : 'bg-gray-600'}`} />
        <div className={`w-2 h-2 rounded-full ${currentView === 'left' ? 'bg-green-500' : 'bg-gray-600'}`} />
      </div>

      <div 
        className={`flex w-[300%] h-full transition-transform duration-300 ease-out ${
          currentView === 'center' ? '-translate-x-[33.333%]' : 
          currentView === 'left' ? '-translate-x-[66.666%]' : 
          '-translate-x-0'
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        <div className="w-1/3 h-full flex flex-col bg-gradient-to-br from-gray-900 to-black p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <div className="flex items-center">
                <Calendar className="w-6 h-6 mr-3 text-blue-400" />
                <h1 className="text-2xl font-bold">Market Briefing</h1>
            </div>
            {dailyBrief?.period && (
                <span className="text-xs font-semibold px-2 py-1 bg-gray-700 text-gray-200 rounded-full">
                    {dailyBrief.period === 'AM' ? 'Morning Report' : 'Mid-day Update'}
                </span>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800/50">
            {dailyBrief ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-white mb-2 leading-tight">{dailyBrief.market_headline}</h2>
                  <p className="text-gray-400 text-sm">
                    Last updated: {formatBriefTimestamp(dailyBrief.generated_at_utc)}
                  </p>
                </div>

                <Card className="bg-gray-800/50 p-4 border-none">
                    <h3 className="font-semibold text-lg mb-2 flex items-center text-blue-400">
                        <List className="w-5 h-5 mr-2" /> Market Overview
                    </h3>
                    <p className="text-gray-200">{dailyBrief.market_overview}</p>
                </Card>
                
                <Card className="bg-gray-800/50 p-4 border-none">
                    <h3 className="font-semibold text-lg mb-3 flex items-center text-blue-400">
                        <Activity className="w-5 h-5 mr-2" /> Key Drivers & Outlook
                    </h3>
                    <ul className="space-y-3">
                        {dailyBrief.key_drivers_and_outlook.map((point, index) => (
                            <li key={index} className="flex items-start">
                                <div className="flex-shrink-0 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center mr-3">
                                    <span className="text-sm font-semibold text-gray-900">{index + 1}</span>
                                </div>
                                <span className="text-gray-200">{point}</span>
                            </li>
                        ))}
                    </ul>
                </Card>
                
                <Card className="bg-gray-800/50 p-4 border-none">
                    <h3 className="font-semibold text-lg mb-3 flex items-center text-blue-400">
                        <Eye className="w-5 h-5 mr-2" /> Stocks in Focus
                    </h3>
                    {dailyBrief.movers_and_shakers?.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                            {dailyBrief.movers_and_shakers.map(symbol => {
                                const stock = stocks[symbol];
                                if (!stock) return <div key={symbol} className="text-gray-500 text-sm p-2 bg-gray-800 rounded-md">{symbol} (No data)</div>;
                                return (
                                    <div key={stock.symbol} className="flex justify-between items-center bg-gray-800 p-2 rounded-md text-sm">
                                        <span className="font-bold">{stock.symbol}</span>
                                        <span className={stock.change >= 0 ? 'text-green-400' : 'text-red-400'}>${stock.price}</span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : ( <p className="text-gray-400">No specific stocks highlighted.</p> )}
                </Card>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-center text-gray-400">
                <p>{briefError || "Loading today's briefing..."}</p>
              </div>
            )}
          </div>

          <div className="text-center mt-4 flex-shrink-0">
            <Button variant="ghost" onClick={() => setCurrentView('center')} className="text-gray-400 hover:text-white">
              <ChevronRight className="w-4 h-4 mr-1" /> Swipe to News Feed
            </Button>
          </div>
        </div>
        
        <div className="w-1/3 h-full relative">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&h=400&fit=crop)` }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
          </div>

          <div className="relative z-10 h-full flex flex-col justify-end p-6">
            <div className="mb-4">
              <div className="flex items-center mb-2">
                <span className="text-gray-300 text-sm">{currentNewsItem.source}</span>
              </div>
              <p className="text-gray-300 text-sm mb-2">
                {formatDate(currentNewsItem.published)}
              </p>
              
              <h2 className="text-2xl font-bold mb-3 leading-tight">
                {currentNewsItem.title}
              </h2>
              
              <p className="text-gray-200 text-lg leading-relaxed">
                {currentNewsItem.analysis?.summary_th || currentNewsItem.analysis?.summary_en || currentNewsItem.content?.substring(0, 150) + '...' || 'No summary available.'}
              </p>

              {currentNewsItem.analysis?.affected_symbols && currentNewsItem.analysis.affected_symbols.length > 0 && (
                <div className="mt-2 text-gray-400 text-sm">
                  Symbols: {currentNewsItem.analysis.affected_symbols.join(', ')}
                </div>
              )}

              <div className="flex items-center mt-4">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  currentNewsItem.analysis?.impact === 'Bullish' ? 'bg-green-500' : 
                  currentNewsItem.analysis?.impact === 'Bearish' ? 'bg-red-500' : 'bg-yellow-500'
                }`}>
                  {currentNewsItem.analysis?.impact === 'Bullish' ? 'Positive' :
                   currentNewsItem.analysis?.impact === 'Bearish' ? 'Negative' :
                   currentNewsItem.analysis?.impact === 'Mixed' ? 'Neutral' : 'N/A'}
                </span>
                {currentNewsItem.analysis?.impact_score && (
                  <span className="text-gray-300 text-sm ml-2">
                    Impact: {currentNewsItem.analysis.impact_score}/10
                  </span>
                )}
              </div>

              {currentNewsItem.link && (
                <a 
                  href={currentNewsItem.link} 
                  className="text-blue-400 hover:text-blue-300 underline text-sm mt-2 block"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Read Source →
                </a>
              )}
            </div>

            <div className="flex justify-between items-center">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setCurrentView('right')}
                className="text-white/80 hover:text-white"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Daily Brief
              </Button>

              <div className="flex flex-col items-center space-y-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={prevNews}
                  className="text-white/80 hover:text-white"
                  disabled={news.length === 0}
                >
                  <ChevronDown className="w-4 h-4 rotate-180" />
                </Button>
                <span className="text-xs text-gray-400">
                  {currentNewsIndex + 1} / {news.length}
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={nextNews}
                  className="text-white/80 hover:text-white"
                  disabled={news.length === 0}
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </div>

              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setCurrentView('left')}
                className="text-white/80 hover:text-white"
              >
                AI Summary
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>

        <div className="w-1/3 h-full bg-gradient-to-br from-gray-900 to-black p-6 overflow-y-auto">
          <div className="flex items-center mb-6">
            <Sparkles className="w-6 h-6 mr-2 text-green-400" />
            <h1 className="text-2xl font-bold">AI Analysis & Q&A</h1>
          </div>

          <div className="space-y-6">
            <div>
              <img src={`https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&h=400&fit=crop`}
                    alt={currentNewsItem.title}
                    className="w-full h-48 object-cover rounded-lg mb-4"
              />
              <h2 className="text-xl font-bold mb-4 leading-tight">
                {currentNewsItem.title}
              </h2>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3 text-blue-400">Full Article</h3>
              <p className="text-gray-300 leading-relaxed mb-4">
                {currentNewsItem.content || 'No full article content available.'}
              </p>
            </div>

            <div className="bg-gray-800/50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-3 text-green-400 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                Impact Analysis
              </h3>
              <p className="text-gray-200 leading-relaxed">
                {currentNewsItem.analysis?.summary_en || 'No AI analysis available.'}
              </p>
            </div>

            {currentNewsItem.link && (
              <div className="bg-gray-800/30 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-2 text-purple-400">Source</h3>
                <a 
                  href={currentNewsItem.link} 
                  className="text-blue-400 hover:text-blue-300 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Read original article on {currentNewsItem.source}
                </a>
              </div>
            )}

            <Card className="bg-gray-800/50 p-4 rounded-lg border-none">
              <h3 className="text-lg font-semibold mb-3 text-yellow-400 flex items-center">
                <Sparkles className="w-5 h-5 mr-2" />
                Ask AI a Question
              </h3>
              <Textarea
                placeholder="Type your question about the news..."
                value={userQuestion}
                onChange={(e) => setUserQuestion(e.target.value)}
                className="mb-3 bg-gray-700 text-white border-gray-600 focus:border-blue-500"
              />
              <Button 
                onClick={handleAskQuestion} 
                disabled={askingQuestion || !userQuestion.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {askingQuestion ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Asking...
                  </>
                ) : (
                  'Ask Question'
                )}
              </Button>
              {qaError && <p className="text-red-400 text-sm mt-2">{qaError}</p>}
              {aiAnswer && (
                <div className="mt-4 p-3 bg-gray-700 rounded-md">
                  <h4 className="font-semibold text-gray-300">AI Answer:</h4>
                  <p className="text-gray-200">{aiAnswer}</p>
                </div>
              )}
            </Card>
          </div>

          <div className="text-center mt-6">
            <Button 
              variant="ghost" 
              onClick={() => setCurrentView('center')}
              className="text-gray-400 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back to News Feed
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;