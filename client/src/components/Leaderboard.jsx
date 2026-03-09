import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const roleLabels = {
  vc: { label: 'VC', color: 'blue' },
  fa: { label: 'FA', color: 'purple' },
  founder: { label: '创业者', color: 'green' },
  other: { label: '其他', color: 'gray' }
};

const rankMedals = ['🥇', '🥈', '🥉'];

export function Leaderboard({ onClose, onViewProfile }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('credits'); // credits | accuracy

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const res = await axios.get(`${API_URL}/leaderboard`);
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const sortedUsers = [...users].sort((a, b) => {
    if (tab === 'credits') return b.credits - a.credits;
    // 准确率：已结算话题中猜对的比例
    const aRate = a.settled_votes > 0 ? a.correct_count / a.settled_votes : 0;
    const bRate = b.settled_votes > 0 ? b.correct_count / b.settled_votes : 0;
    return bRate - aRate;
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">🏆 排行榜</h2>
            <p className="text-sm text-gray-500 mt-0.5">看看谁是最准的预言家</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition text-xl">×</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-4 pb-0">
          {[
            { key: 'credits', label: '💰 积分榜' },
            { key: 'accuracy', label: '🎯 准确率榜' }
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                tab === t.key
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {loading ? (
            <div className="text-center py-16 text-gray-400">加载中...</div>
          ) : sortedUsers.length === 0 ? (
            <div className="text-center py-16 text-gray-400">暂无数据</div>
          ) : (
            sortedUsers.map((user, idx) => {
              const roleInfo = roleLabels[user.role] || roleLabels.other;
              const accuracyRate = user.settled_votes > 0
                ? Math.round((user.correct_count / user.settled_votes) * 100)
                : null;

              return (
                <div
                  key={user.id}
                  onClick={() => onViewProfile && onViewProfile(user.id)}
                  className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition ${
                    idx === 0 ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 hover:border-amber-300' :
                    idx === 1 ? 'bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 hover:border-gray-300' :
                    idx === 2 ? 'bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 hover:border-orange-300' :
                    'bg-gray-50 hover:bg-gray-100 border border-transparent'
                  }`}
                >
                  {/* Rank */}
                  <div className="w-8 text-center shrink-0">
                    {idx < 3 ? (
                      <span className="text-2xl">{rankMedals[idx]}</span>
                    ) : (
                      <span className="text-sm font-bold text-gray-400">#{idx + 1}</span>
                    )}
                  </div>

                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0 ${
                    idx === 0 ? 'bg-gradient-to-br from-amber-400 to-yellow-500' :
                    idx === 1 ? 'bg-gradient-to-br from-gray-400 to-slate-500' :
                    idx === 2 ? 'bg-gradient-to-br from-orange-400 to-amber-500' :
                    'bg-gradient-to-br from-blue-400 to-purple-500'
                  }`}>
                    {user.email[0].toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800 truncate text-sm">{user.email}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-${roleInfo.color}-100 text-${roleInfo.color}-700 shrink-0`}>
                        {roleInfo.label}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      共投票 {user.total_votes} 次
                      {accuracyRate !== null && ` · 已结算准确率 ${accuracyRate}%`}
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-right shrink-0">
                    {tab === 'credits' ? (
                      <div className="text-lg font-bold text-amber-600">{user.credits.toLocaleString()}</div>
                    ) : (
                      <div className="text-lg font-bold text-blue-600">
                        {accuracyRate !== null ? `${accuracyRate}%` : '—'}
                      </div>
                    )}
                    <div className="text-xs text-gray-400">{tab === 'credits' ? '积分' : '准确率'}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
