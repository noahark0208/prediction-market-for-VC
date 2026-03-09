import { useState, useEffect, useCallback } from 'react';
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

function App() {
  const [user, setUser] = useState(null);
  const [topics, setTopics] = useState([]);
  const [showLogin, setShowLogin] = useState(false);
  const [showCreateTopic, setShowCreateTopic] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showProfile, setShowProfile] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
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

  const handleCreateTopic = async (title, description, category, settlement_date) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/topics`,
        { title, description, category, settlement_date },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowCreateTopic(false);
      fetchTopics();
    } catch (err) {
      throw new Error(err.response?.data?.error || '创建失败');
    }
  };

  const handleGoToTopic = async (topicId) => {
    try {
      const res = await axios.get(`${API_URL}/topics/${topicId}`);
      setSelectedTopic(res.data);
    } catch {}
  };

  const handleVoteDone = () => {
    fetchTopics();
    // 刷新用户积分
    const token = localStorage.getItem('token');
    if (token) fetchUser(token);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <button
            onClick={() => setSelectedTopic(null)}
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
              onClick={() => { setSelectedTopic(null); setShowLeaderboard(true); }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition font-medium"
            >
              🏆 排行榜
            </button>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                {/* Credits Badge */}
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm font-semibold">
                  <span>💰</span>
                  <span>{user.credits?.toLocaleString()}</span>
                </div>

                {/* Notification Bell */}
                <button
                  onClick={() => { setShowNotifications(true); }}
                  className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition text-gray-600"
                >
                  <span className="text-lg">🔔</span>
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center leading-none">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Admin */}
                {user.is_admin ? (
                  <button
                    onClick={() => setShowAdmin(true)}
                    className="hidden sm:flex w-9 h-9 items-center justify-center rounded-lg hover:bg-gray-100 transition text-gray-600"
                    title="管理后台"
                  >
                    <span className="text-lg">⚙️</span>
                  </button>
                ) : null}

                {/* Create Topic */}
                <button
                  onClick={() => setShowCreateTopic(true)}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-md transition font-medium text-sm"
                >
                  <span className="hidden sm:inline">✨ 发起预测</span>
                  <span className="sm:hidden">✨</span>
                </button>

                {/* User Menu */}
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
                  onClick={() => { setSelectedTopic(null); setShowLeaderboard(true); }}
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

      {/* ── Main ── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {selectedTopic ? (
          <TopicDetail
            topic={selectedTopic}
            user={user}
            onBack={() => setSelectedTopic(null)}
            onVote={handleVoteDone}
          />
        ) : (
          <TopicList
            topics={topics}
            onSelectTopic={setSelectedTopic}
            selectedCategory={selectedCategory}
            onCategoryChange={handleCategoryChange}
            searchQuery={searchQuery}
            onSearch={handleSearch}
            sortMode={sortMode}
            onSortChange={handleSortChange}
          />
        )}
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
  );
}

export default App;
