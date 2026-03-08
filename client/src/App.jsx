import { useState, useEffect } from 'react';
import axios from 'axios';
import { TopicList } from './components/Topics';
import { TopicDetail } from './components/TopicDetail';
import { LoginModal } from './components/LoginModal';
import { CreateTopicModal } from './components/CreateTopicModal';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function App() {
  const [user, setUser] = useState(null);
  const [topics, setTopics] = useState([]);
  const [showLogin, setShowLogin] = useState(false);
  const [showCreateTopic, setShowCreateTopic] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchUser(token);
    }
    fetchTopics();
  }, []);

  const fetchUser = async (token) => {
    try {
      const res = await axios.get(`${API_URL}/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(res.data);
    } catch (err) {
      localStorage.removeItem('token');
    }
  };

  const fetchTopics = async () => {
    const res = await axios.get(`${API_URL}/topics`, {
      params: { category: selectedCategory }
    });
    setTopics(res.data);
  };

  const handleLogin = async (email, password, isRegister, role) => {
    try {
      const endpoint = isRegister ? '/register' : '/login';
      const payload = isRegister ? { email, password, role } : { email, password };
      const res = await axios.post(`${API_URL}${endpoint}`, payload);
      localStorage.setItem('token', res.data.token);
      setUser({ email: res.data.email, credits: res.data.credits, role: res.data.role });
      setShowLogin(false);
    } catch (err) {
      alert(err.response?.data?.error || '操作失败');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const handleCreateTopic = async (title, description, category) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/topics`, 
        { title, description, category },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setShowCreateTopic(false);
      fetchTopics();
    } catch (err) {
      alert(err.response?.data?.error || '创建失败');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-3 cursor-pointer" onClick={() => setSelectedTopic(null)}>
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-lg sm:text-xl font-bold">预</span>
            </div>
            <div>
              <h1 className="text-base sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                一级市场预测
              </h1>
              <p className="text-xs text-gray-500 hidden sm:block">VC圈的水晶球</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {user ? (
              <>
                <div className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-full text-xs sm:text-sm font-semibold shadow-md">
                  💰 {user.credits}
                </div>
                <button 
                  onClick={() => setShowCreateTopic(true)}
                  className="px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full hover:shadow-lg transition-all font-medium text-xs sm:text-base"
                >
                  <span className="hidden sm:inline">✨ 发起预测</span>
                  <span className="sm:hidden">✨</span>
                </button>
                <button onClick={handleLogout} className="text-xs sm:text-sm text-gray-600 hover:text-gray-900">
                  退出
                </button>
              </>
            ) : (
              <button 
                onClick={() => setShowLogin(true)}
                className="px-4 sm:px-6 py-2 sm:py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full hover:shadow-lg transition-all font-medium text-xs sm:text-base"
              >
                登录/注册
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {selectedTopic ? (
          <TopicDetail 
            topic={selectedTopic} 
            user={user}
            onBack={() => setSelectedTopic(null)}
            onVote={fetchTopics}
          />
        ) : (
          <TopicList 
            topics={topics} 
            onSelectTopic={setSelectedTopic}
            selectedCategory={selectedCategory}
            onCategoryChange={(cat) => {
              setSelectedCategory(cat);
              fetchTopics();
            }}
          />
        )}
      </main>

      {/* Login Modal */}
      {showLogin && (
        <LoginModal 
          onClose={() => setShowLogin(false)}
          onLogin={handleLogin}
        />
      )}

      {/* Create Topic Modal */}
      {showCreateTopic && (
        <CreateTopicModal 
          onClose={() => setShowCreateTopic(false)}
          onCreate={handleCreateTopic}
        />
      )}
    </div>
  );
}

export default App;
