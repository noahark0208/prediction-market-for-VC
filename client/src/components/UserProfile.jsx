import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const roleLabels = {
  vc: { label: 'VC 投资人', emoji: '💼', bg: 'bg-blue-100', text: 'text-blue-700' },
  fa: { label: 'FA', emoji: '🤝', bg: 'bg-purple-100', text: 'text-purple-700' },
  founder: { label: '创业者', emoji: '🚀', bg: 'bg-green-100', text: 'text-green-700' },
  other: { label: '其他', emoji: '👤', bg: 'bg-gray-100', text: 'text-gray-600' }
};

export function UserProfile({ userId, onClose, currentUserId }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    try {
      const res = await axios.get(`${API_URL}/users/${userId}`);
      setProfile(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!currentUserId) return alert('请先登录');
    if (followLoading) return;
    setFollowLoading(true);
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
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 text-center text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!profile) return null;

  const roleInfo = roleLabels[profile.role] || roleLabels.other;
  const yesRate = profile.stats.total_votes > 0
    ? Math.round((profile.stats.yes_count / profile.stats.total_votes) * 100)
    : 0;
  const isSelf = currentUserId && currentUserId == userId;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Profile Header */}
        <div className="bg-gradient-to-br from-blue-500 to-purple-600 px-6 py-8 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition text-white text-xl"
          >×</button>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl border-2 border-white/30">
              {roleInfo.emoji}
            </div>
            <div>
              <div className="font-bold text-lg leading-tight">{profile.email}</div>
              <div className="mt-1">
                <span className="inline-block px-2.5 py-0.5 bg-white/20 rounded-full text-xs font-medium">
                  {roleInfo.label}
                </span>
              </div>
            </div>
          </div>

          {profile.bio && (
            <p className="mt-4 text-sm text-white/80 leading-relaxed">{profile.bio}</p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
          <div className="py-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{profile.stats.total_votes}</div>
            <div className="text-xs text-gray-500 mt-0.5">总投票</div>
          </div>
          <div className="py-4 text-center">
            <div className="text-2xl font-bold text-green-600">{yesRate}%</div>
            <div className="text-xs text-gray-500 mt-0.5">看涨比例</div>
          </div>
          <div className="py-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{profile.credits?.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-0.5">积分</div>
          </div>
        </div>

        {/* Actions */}
        {!isSelf && currentUserId && (
          <div className="p-4">
            <button
              onClick={handleFollow}
              disabled={followLoading}
              className={`w-full py-2.5 rounded-xl font-semibold text-sm transition ${
                isFollowing
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-lg'
              } disabled:opacity-60`}
            >
              {followLoading ? '处理中...' : isFollowing ? '✓ 已关注' : '+ 关注'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
