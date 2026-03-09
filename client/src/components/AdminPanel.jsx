import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const categoryLabels = {
  financing: '💰 融资', ipo: '📈 上市', valuation: '💎 估值',
  trend: '🔥 趋势', gossip: '💬 八卦', other: '📌 其他'
};

const roleLabels = { vc: 'VC', fa: 'FA', founder: '创业者', other: '其他' };

export function AdminPanel({ onClose }) {
  const [tab, setTab] = useState('topics');
  const [topics, setTopics] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settlingId, setSettlingId] = useState(null);
  const [settleResult, setSettleResult] = useState({});
  const [editCredits, setEditCredits] = useState({});

  useEffect(() => {
    fetchData();
  }, [tab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (tab === 'topics') {
        const res = await axios.get(`${API_URL}/admin/topics`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setTopics(res.data);
      } else {
        const res = await axios.get(`${API_URL}/admin/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(res.data);
      }
    } catch (err) {
      alert(err.response?.data?.error || '获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSettle = async (topicId) => {
    const result = settleResult[topicId];
    if (!result) return alert('请先选择结算结果');
    if (!window.confirm(`确认将此话题结算为「${result === 'yes' ? '看涨成立' : '看跌成立'}」？此操作不可撤销。`)) return;

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/topics/${topicId}/settle`,
        { result },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(`✅ ${res.data.message}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || '结算失败');
    }
  };

  const handleDeleteTopic = async (topicId, title) => {
    if (!window.confirm(`确认删除话题「${title}」？`)) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/admin/topics/${topicId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTopics(prev => prev.filter(t => t.id !== topicId));
    } catch (err) {
      alert(err.response?.data?.error || '删除失败');
    }
  };

  const handleUpdateCredits = async (userId) => {
    const credits = editCredits[userId];
    if (credits === undefined || credits === '') return;
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/admin/users/${userId}/credits`,
        { credits: Number(credits) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, credits: Number(credits) } : u));
      setEditCredits(prev => { const n = { ...prev }; delete n[userId]; return n; });
    } catch (err) {
      alert(err.response?.data?.error || '更新失败');
    }
  };

  const handleExport = async (type) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/export/${type}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('导出失败');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">⚙️ 管理后台</h2>
            <p className="text-sm text-gray-500 mt-0.5">话题结算 · 用户管理 · 数据导出</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition text-xl">×</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4">
          {[
            { key: 'topics', label: '📋 话题管理' },
            { key: 'users', label: '👥 用户管理' },
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
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => handleExport('topics')}
              className="px-3 py-2 text-xs bg-green-50 text-green-700 border border-green-200 rounded-xl hover:bg-green-100 transition font-medium"
            >
              ⬇ 导出话题
            </button>
            <button
              onClick={() => handleExport('users')}
              className="px-3 py-2 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-xl hover:bg-blue-100 transition font-medium"
            >
              ⬇ 导出用户
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6">
          {loading ? (
            <div className="text-center py-16 text-gray-400">加载中...</div>
          ) : tab === 'topics' ? (
            <div className="space-y-3">
              {topics.map(topic => (
                <div key={topic.id} className={`border rounded-xl p-4 ${
                  topic.status === 'settled' ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200 hover:border-blue-200'
                }`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800 truncate">{topic.title}</span>
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full shrink-0">
                          {categoryLabels[topic.category] || topic.category}
                        </span>
                        {topic.status === 'settled' && (
                          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-medium ${
                            topic.settlement_result === 'yes'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            已结算：{topic.settlement_result === 'yes' ? '看涨成立' : '看跌成立'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {topic.vote_count} 票 · 看涨 {topic.yes_votes} / 看跌 {topic.no_votes} · 创建者：{topic.creator_email}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {topic.status !== 'settled' && (
                        <>
                          <select
                            value={settleResult[topic.id] || ''}
                            onChange={(e) => setSettleResult(prev => ({ ...prev, [topic.id]: e.target.value }))}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-400"
                          >
                            <option value="">选择结果</option>
                            <option value="yes">看涨成立</option>
                            <option value="no">看跌成立</option>
                          </select>
                          <button
                            onClick={() => handleSettle(topic.id)}
                            className="px-3 py-1.5 bg-gradient-to-r from-green-500 to-green-600 text-white text-xs rounded-lg hover:shadow-md transition font-medium"
                          >
                            结算
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDeleteTopic(topic.id, topic.title)}
                        className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 text-xs rounded-lg hover:bg-red-100 transition"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {users.map(user => (
                <div key={user.id} className="border border-gray-200 rounded-xl p-4 bg-white hover:border-blue-200 transition">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800 text-sm truncate">{user.email}</span>
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full shrink-0">
                          {roleLabels[user.role] || user.role}
                        </span>
                        {user.is_admin ? (
                          <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full shrink-0 font-medium">管理员</span>
                        ) : null}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        投票 {user.total_votes} 次 · 注册于 {new Date(user.created_at).toLocaleDateString('zh-CN')}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="number"
                        placeholder={String(user.credits)}
                        value={editCredits[user.id] ?? ''}
                        onChange={(e) => setEditCredits(prev => ({ ...prev, [user.id]: e.target.value }))}
                        className="w-24 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-400 text-center"
                      />
                      <button
                        onClick={() => handleUpdateCredits(user.id)}
                        className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs rounded-lg hover:bg-blue-100 transition font-medium"
                      >
                        更新积分
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
