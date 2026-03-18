import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { TopicList } from './components/Topics';
import { TopicDetail } from './components/TopicDetail';
import { LoginModal } from './components/LoginModal';
import { CreateTopicModal } from './components/CreateTopicModal';
import { Leaderboard } from './components/Leaderboard';
import { NotificationCenter } from './components/NotificationCenter';
import { AdminPanel } from './components/AdminPanel';
import { UserProfile } from './components/UserProfile';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// ── 共享状态 Context ──────────────────────────────────────────────────────────
import { createContext, useContext } from 'react';
const AppContext = createContext(null);

// ── Header 组件 ───────────────────────────────────────────────────────────────
function Header() {
  const { user, unreadCount, setShowLogin, setShowCreateTopic, setShowLeaderboard,
          setShowNotifications, setShowAdmin, setShowProfile, handleLogout } = useContext(AppContext);
  const navigate = useNavigate();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 shrink-0 group"
        >
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md transition">
            <span className="text-white text-sm font-bold">预</span>
          </div>
          <div className="hidden sm:block">
            <span className="text-base font-bold text-gray-900">一级市场预测</span>
            <span className="text-xs text-gray-400 ml-1.5">VC圈的水晶球</span>
          </div>
        </button>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-1">
          <button
            onClick={() => { navigate('/'); setShowLeaderboard(true); }}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition font-medium"
          >
            🏆 排行榜
          </button>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm font-semibold">
                <span>💰</span>
                <span>{user.credits?.toLocaleString()}</span>
              </div>

              <button
                onClick={() => setShowNotifications(true)}
                className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition text-gray-600"
              >
                <span className="text-lg">🔔</span>
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {user.is_admin ? (
                <button
                  onClick={() => setShowAdmin(true)}
                  className="hidden sm:flex w-9 h-9 items-center justify-center rounded-lg hover:bg-gray-100 transition text-gray-600"
                  title="管理后台"
                >
                  <span className="text-lg">⚙️</span>
                </button>
              ) : null}

              <button
                onClick={() => setShowCreateTopic(true)}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-md transition font-medium text-sm"
              >
                <span className="hidden sm:inline">✨ 发起预测</span>
                <span className="sm:hidden">✨</span>
              </button>

              <button
                onClick={() => setShowProfile(user.id)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition"
              >
                <div className="w-7 h-7 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  {user.email?.[0]?.toUpperCase()}
                </div>
                <span className="hidden sm:block text-xs text-gray-600 max-w-20 truncate">{user.email?.split('@')[0]}</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { navigate('/'); setShowLeaderboard(true); }}
                className="md:hidden px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                🏆
              </button>
              <button
                onClick={() => setShowLogin(true)}
                className="px-4 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-md transition font-medium text-sm"
              >
                登录 / 注册
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

// ── 话题列表页 ─────────────────────────────────────────────────────────────────
function HomePage() {
  const { topics, selectedCategory, searchQuery, sortMode,
          handleCategoryChange, handleSearch, handleSortChange } = useContext(AppContext);
  const navigate = useNavigate();

  return (
    <TopicList
      topics={topics}
      onSelectTopic={(topic) => navigate(`/topic/${topic.id}`)}
      selectedCategory={selectedCategory}
      onCategoryChange={handleCategoryChange}
      searchQuery={searchQuery}
      onSearch={handleSearch}
      sortMode={sortMode}
      onSortChange={handleSortChange}
    />
  );
}

// ── 话题详情页 ─────────────────────────────────────────────────────────────────
function TopicPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, handleVoteDone, setShowProfile } = useContext(AppContext);
  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTopic = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/topics/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        setTopic(res.data);
      } catch {
        setError('话题不存在或已删除');
      } finally {
        setLoading(false);
      }
    };
    fetchTopic();
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center py-32 text-gray-400">
      <div className="text-center">
        <div className="text-4xl mb-3 animate-pulse">⏳</div>
        <p>加载中...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center py-32 text-gray-400">
      <div className="text-center">
        <div className="text-4xl mb-3">😕</div>
        <p>{error}</p>
        <button onClick={() => navigate('/')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
          返回首页
        </button>
      </div>
    </div>
  );

  return (
    <TopicDetail
      topic={topic}
      user={user}
      onBack={() => navigate('/')}
      onVote={() => {
        handleVoteDone();
        // 刷新话题数据
        const token = localStorage.getItem('token');
        axios.get(`${API_URL}/topics/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }).then(res => setTopic(res.data)).catch(() => {});
      }}
      onViewProfile={setShowProfile}
    />
  );
}

// ── 主应用（含全局状态）────────────────────────────────────────────────────────
function AppInner() {
  const [user, setUser] = useState(null);
  const [topics, setTopics] = useState([]);
  const [showLogin, setShowLogin] = useState(false);
  const [showCreateTopic, setShowCreateTopic] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showProfile, setShowProfile] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [sortMode, setSortMode] = useState('hot');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) fetchUser(token);
    fetchTopics();
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const fetchUser = async (token) => {
    try {
      const res = await axios.get(`${API_URL}/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(res.data);
    } catch {
      localStorage.removeItem('token');
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUnreadCount(res.data.count);
    } catch {}
  };

  const fetchTopics = useCallback(async (search = searchQuery, category = selectedCategory, sort = sortMode) => {
    try {
      const res = await axios.get(`${API_URL}/topics`, {
        params: {
          category: category !== 'all' ? category : undefined,
          search: search || undefined,
          sort
        }
      });
      setTopics(res.data);
    } catch {}
  }, [searchQuery, selectedCategory, sortMode]);

  const handleSearch = (value) => {
    setSearchQuery(value);
    fetchTopics(value, selectedCategory, sortMode);
  };

  const handleCategoryChange = (cat) => {
    setSelectedCategory(cat);
    fetchTopics(searchQuery, cat, sortMode);
  };

  const handleSortChange = (sort) => {
    setSortMode(sort);
    fetchTopics(searchQuery, selectedCategory, sort);
  };

  const handleLogin = async (email, password, isRegister, role) => {
    try {
      const endpoint = isRegister ? '/register' : '/login';
      const payload = isRegister ? { email, password, role } : { email, password };
      const res = await axios.post(`${API_URL}${endpoint}`, payload);
      localStorage.setItem('token', res.data.token);
      setUser({
        id: res.data.id,
        email: res.data.email,
        credits: res.data.credits,
        role: res.data.role,
        is_admin: res.data.is_admin || 0
      });
      setShowLogin(false);
    } catch (err) {
      throw new Error(err.response?.data?.error || '操作失败');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setUnreadCount(0);
  };

  const handleCreateTopic = async (title, description, category, settlement_date, topic_type = 'binary', options = []) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/topics`,
        { title, description, category, settlement_date, topic_type, options },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowCreateTopic(false);
      fetchTopics();
    } catch (err) {
      throw new Error(err.response?.data?.error || '创建失败');
    }
  };

  const handleVoteDone = () => {
    fetchTopics();
    const token = localStorage.getItem('token');
    if (token) fetchUser(token);
  };

  const handleGoToTopic = async (topicId) => {
    window.location.href = `/topic/${topicId}`;
  };

  const contextValue = {
    user, topics, selectedCategory, searchQuery, sortMode, unreadCount,
    setShowLogin, setShowCreateTopic, setShowLeaderboard, setShowNotifications,
    setShowAdmin, setShowProfile, handleLogout, handleCategoryChange,
    handleSearch, handleSortChange, handleVoteDone, setShowProfile
  };

  return (
    <AppContext.Provider value={contextValue}>
      <div className="min-h-screen bg-gray-50">
        <Header />

        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/topic/:id" element={<TopicPage />} />
          </Routes>
        </main>

        {/* ── Modals ── */}
        {showLogin && (
          <LoginModal onClose={() => setShowLogin(false)} onLogin={handleLogin} />
        )}
        {showCreateTopic && (
          <CreateTopicModal onClose={() => setShowCreateTopic(false)} onCreate={handleCreateTopic} />
        )}
        {showLeaderboard && (
          <Leaderboard
            onClose={() => setShowLeaderboard(false)}
            onViewProfile={(id) => { setShowLeaderboard(false); setShowProfile(id); }}
          />
        )}
        {showNotifications && (
          <NotificationCenter
            onClose={() => { setShowNotifications(false); setUnreadCount(0); }}
            onGoToTopic={handleGoToTopic}
          />
        )}
        {showAdmin && user?.is_admin ? (
          <AdminPanel onClose={() => setShowAdmin(false)} />
        ) : null}
        {showProfile && (
          <UserProfile
            userId={showProfile}
            currentUserId={user?.id}
            onClose={() => setShowProfile(null)}
          />
        )}
      </div>
    </AppContext.Provider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
