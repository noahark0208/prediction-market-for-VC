import { useState, useEffect } from 'react';
import axios from 'axios';
import { UserProfile } from './UserProfile';
import { VoteTrend } from './VoteTrend';
import { CommentInput, CommentText } from './CommentInput';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const roleLabels = {
  vc: { label: 'VC', bg: 'bg-blue-100', text: 'text-blue-700' },
  fa: { label: 'FA', bg: 'bg-purple-100', text: 'text-purple-700' },
  founder: { label: '创业者', bg: 'bg-green-100', text: 'text-green-700' },
  other: { label: '其他', bg: 'bg-gray-100', text: 'text-gray-600' }
};

const categoryLabels = {
  financing: { label: '融资', emoji: '💰' },
  ipo: { label: '上市', emoji: '📈' },
  valuation: { label: '估值', emoji: '💎' },
  trend: { label: '趋势', emoji: '🔥' },
  gossip: { label: '八卦', emoji: '💬' },
  other: { label: '其他', emoji: '📌' }
};

export function TopicDetail({ topic, user, onBack, onVote }) {
  const [comments, setComments] = useState([]);
  const [topicData, setTopicData] = useState(topic);
  const [showProfile, setShowProfile] = useState(null);
  const [voting, setVoting] = useState(false);
  const [userVote, setUserVote] = useState(null); // 当前用户的投票

  useEffect(() => {
    fetchComments();
    fetchTopicData();
    if (user) fetchUserVote();
  }, [topic.id]);

  const fetchTopicData = async () => {
    try {
      const res = await axios.get(`${API_URL}/topics/${topic.id}`);
      setTopicData(res.data);
    } catch {}
  };

  const fetchComments = async () => {
    try {
      const res = await axios.get(`${API_URL}/topics/${topic.id}/comments`);
      setComments(res.data);
    } catch {}
  };

  const fetchUserVote = async () => {
    // 通过本地状态推断（后端暂无单独接口，投票后记录）
  };

  const handleVote = async (vote) => {
    if (!user) return alert('请先登录后再投票');
    if (topicData.status === 'settled') return alert('该话题已结算，无法投票');
    if (userVote) return alert('你已经投过票了');
    if (voting) return;

    setVoting(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/topics/${topic.id}/vote`,
        { vote },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUserVote(vote);
      await fetchTopicData();
      onVote();
    } catch (err) {
      const msg = err.response?.data?.error || '投票失败';
      if (msg === '已经投过票了') setUserVote('voted');
      else alert(msg);
    } finally {
      setVoting(false);
    }
  };

  const handleComment = async (content) => {
    if (!user) return alert('请先登录后再评论');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${API_URL}/topics/${topic.id}/comments`,
        { content },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setComments(prev => [...prev, res.data]);
    } catch (err) {
      alert(err.response?.data?.error || '评论失败');
    }
  };

  const total = topicData.yes_votes + topicData.no_votes;
  const yesPercent = total > 0 ? Math.round((topicData.yes_votes / total) * 100) : 50;
  const noPercent = 100 - yesPercent;
  const isSettled = topicData.status === 'settled';
  const catInfo = categoryLabels[topicData.category] || categoryLabels.other;
  const creatorRole = roleLabels[topicData.creator_role] || roleLabels.other;
  const canVote = user && !isSettled && !userVote;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition font-medium"
      >
        ← 返回列表
      </button>

      {/* Main Card */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {/* Topic Header */}
        <div className="p-6 pb-5 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-sm">{catInfo.emoji}</span>
            <span className="text-xs text-gray-500">{catInfo.label}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${creatorRole.bg} ${creatorRole.text}`}>
              {creatorRole.label}
            </span>
            {isSettled && (
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                topicData.settlement_result === 'yes'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                ✓ 已结算：{topicData.settlement_result === 'yes' ? '看涨成立' : '看跌成立'}
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-gray-900 leading-snug mb-2">{topicData.title}</h1>
          {topicData.description && (
            <p className="text-sm text-gray-600 leading-relaxed">{topicData.description}</p>
          )}
          <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
            <span>
              发布于 {new Date(topicData.created_at).toLocaleDateString('zh-CN')}
            </span>
            {topicData.settlement_date && (
              <span>· 结算日 {topicData.settlement_date}</span>
            )}
            <span>· {topicData.total_participants} 人参与</span>
          </div>
        </div>

        {/* Vote Stats */}
        <div className="p-6">
          <div className="flex items-end justify-between mb-3">
            <div className="flex items-center gap-6">
              <div>
                <div className="text-3xl font-bold text-green-600">{yesPercent}%</div>
                <div className="text-xs text-gray-500 mt-0.5">看涨 · {topicData.yes_votes} 票</div>
              </div>
              <div className="w-px h-10 bg-gray-200"></div>
              <div>
                <div className="text-3xl font-bold text-red-500">{noPercent}%</div>
                <div className="text-xs text-gray-500 mt-0.5">看跌 · {topicData.no_votes} 票</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-700">{topicData.total_participants}</div>
              <div className="text-xs text-gray-400">参与人数</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-5">
            <div className="h-full flex">
              <div className="bg-green-500 transition-all duration-700" style={{ width: `${yesPercent}%` }} />
              <div className="bg-red-400 transition-all duration-700" style={{ width: `${noPercent}%` }} />
            </div>
          </div>

          {/* Vote Buttons */}
          {isSettled ? (
            <div className="p-4 bg-gray-50 rounded-xl text-center text-sm text-gray-500 border border-gray-200">
              此话题已结算，感谢参与 🎯
            </div>
          ) : userVote ? (
            <div className={`p-4 rounded-xl text-center text-sm font-medium border ${
              userVote === 'yes'
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              你已投票：{userVote === 'yes' ? '📈 看涨' : '📉 看跌'} · 等待结算
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleVote('yes')}
                disabled={!canVote || voting}
                className="py-3.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold transition hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span className="text-lg">📈</span>
                <div>
                  <div className="text-sm font-bold">看涨</div>
                  <div className="text-xs opacity-80">消耗 10 积分</div>
                </div>
              </button>
              <button
                onClick={() => handleVote('no')}
                disabled={!canVote || voting}
                className="py-3.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span className="text-lg">📉</span>
                <div>
                  <div className="text-sm font-bold">看跌</div>
                  <div className="text-xs opacity-80">消耗 10 积分</div>
                </div>
              </button>
              {!user && (
                <p className="col-span-2 text-center text-xs text-gray-400">登录后才能参与投票</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Trend Chart */}
      <VoteTrend topicId={topic.id} />

      {/* Comments */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-base font-bold text-gray-900 mb-5">
          💬 讨论区
          <span className="ml-2 text-sm font-normal text-gray-400">{comments.length} 条</span>
        </h2>

        {user ? (
          <div className="mb-6">
            <CommentInput onSubmit={handleComment} />
          </div>
        ) : (
          <div className="mb-6 p-4 bg-gray-50 rounded-xl text-center text-sm text-gray-500 border border-gray-200">
            登录后参与讨论
          </div>
        )}

        <div className="space-y-3">
          {comments.map(comment => {
            const roleInfo = roleLabels[comment.user_role] || roleLabels.other;
            return (
              <div key={comment.id} className="flex gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                  {comment.user_email?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <button
                      onClick={() => setShowProfile(comment.user_id)}
                      className="text-sm font-semibold text-gray-800 hover:text-blue-600 transition truncate"
                    >
                      {comment.user_email}
                    </button>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${roleInfo.bg} ${roleInfo.text} shrink-0`}>
                      {roleInfo.label}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0">
                      {new Date(comment.created_at).toLocaleString('zh-CN', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                    <CommentText content={comment.content} />
                  </div>
                </div>
              </div>
            );
          })}
          {comments.length === 0 && (
            <div className="text-center py-10 text-gray-400">
              <div className="text-3xl mb-2">💭</div>
              <div className="text-sm">还没有评论，来抢沙发吧！</div>
            </div>
          )}
        </div>
      </div>

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
