import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const roleLabels = {
  vc: { label: 'VC投资人', emoji: '💼', color: 'blue' },
  fa: { label: 'FA', emoji: '🤝', color: 'purple' },
  founder: { label: '创业者', emoji: '🚀', color: 'green' },
  other: { label: '其他', emoji: '👤', color: 'gray' }
};

export function UserProfile({ userId, onClose, currentUserId }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    try {
      const res = await axios.get(`${API_URL}/users/${userId}`);
      setProfile(res.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!currentUserId) {
      alert('请先登录');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      if (isFollowing) {
        await axios.delete(`${API_URL}/users/${userId}/follow`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setIsFollowing(false);
      } else {
        await axios.post(`${API_URL}/users/${userId}/follow`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setIsFollowing(true);
      }
    } catch (err) {
      alert(err.response?.data?.error || '操作失败');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8">
          <div className="text-center">加载中...</div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const roleInfo = roleLabels[profile.role] || roleLabels.other;
  const yesRate = profile.stats.total_votes > 0 
    ? Math.round((profile.stats.yes_count / profile.stats.total_votes) * 100) 
    : 0;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-3xl">
              {roleInfo.emoji}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{profile.email}</h2>
              <span className={`inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium bg-${roleInfo.color}-100 text-${roleInfo.color}-700`}>
                {roleInfo.label}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {profile.bio && (
          <div className="mb-6 p-4 bg-gray-50 rounded-xl">
            <p className="text-gray-700">{profile.bio}</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{profile.stats.total_votes}</div>
            <div className="text-sm text-gray-600 mt-1">总投票</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{yesRate}%</div>
            <div className="text-sm text-gray-600 mt-1">看涨比例</div>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-amber-600">{profile.credits}</div>
            <div className="text-sm text-gray-600 mt-1">剩余积分</div>
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={handleFollow}
            className={`flex-1 py-3 rounded-xl hover:shadow-lg transition font-medium ${
              isFollowing 
                ? 'bg-gray-200 text-gray-700' 
                : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
            }`}
          >
            {isFollowing ? '已关注' : '关注'}
          </button>
        </div>
      </div>
    </div>
  );
}
