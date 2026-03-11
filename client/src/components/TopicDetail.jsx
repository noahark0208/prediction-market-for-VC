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
  other: { label: '📌', emoji: '📌' }
};

// ─── 二元话题投票区 ───────────────────────────────────────────────────────────

function BinaryVotePanel({ topicData, user, position, onVote, onClose }) {
  const [betCredits, setBetCredits] = useState(10);
  const [voting, setVoting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [activeTab, setActiveTab] = useState('trade'); // trade | position

  const total = topicData.yes_votes + topicData.no_votes;
  const yesPercent = total > 0 ? Math.round((topicData.yes_votes / total) * 100) : 50;
  const noPercent = 100 - yesPercent;
  const isSettled = topicData.status === 'settled';

  const yesPos = position?.positions?.find(p => p.vote === 'yes');
  const noPos = position?.positions?.find(p => p.vote === 'no');
  const hasPosition = yesPos || noPos;

  const handleVote = async (vote) => {
    if (!user) return alert('请先登录后再投票');
    if (isSettled) return alert('该话题已结算，无法投票');
    if (voting) return;
    if (betCredits < 10) return alert('最少投入 10 积分');
    setVoting(true);
    try {
      await onVote({ vote, credits: betCredits });
    } finally {
      setVoting(false);
    }
  };

  const handleClose = async (vote) => {
    if (!user || closing) return;
    if (!window.confirm(`确认平仓「${vote === 'yes' ? '看涨' : '看跌'}」仓位？将按当前市场价格结算。`)) return;
    setClosing(true);
    try {
      await onClose({ vote });
    } finally {
      setClosing(false);
    }
  };

  return (
    <div>
      {/* 价格条 */}
      <div className="flex items-end justify-between mb-3">
        <div className="flex items-center gap-6">
          <div>
            <div className="text-3xl font-bold text-green-600">{yesPercent}%</div>
            <div className="text-xs text-gray-500 mt-0.5">看涨 · {topicData.yes_votes.toFixed ? Math.round(topicData.yes_votes) : topicData.yes_votes} 份</div>
          </div>
          <div className="w-px h-10 bg-gray-200"></div>
          <div>
            <div className="text-3xl font-bold text-red-500">{noPercent}%</div>
            <div className="text-xs text-gray-500 mt-0.5">看跌 · {topicData.no_votes.toFixed ? Math.round(topicData.no_votes) : topicData.no_votes} 份</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-700">{topicData.total_participants}</div>
          <div className="text-xs text-gray-400">参与人数</div>
        </div>
      </div>

      <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-5">
        <div className="h-full flex">
          <div className="bg-green-500 transition-all duration-700" style={{ width: `${yesPercent}%` }} />
          <div className="bg-red-400 transition-all duration-700" style={{ width: `${noPercent}%` }} />
        </div>
      </div>

      {isSettled ? (
        <div className="p-4 bg-gray-50 rounded-xl text-center text-sm text-gray-500 border border-gray-200">
          此话题已结算 · 结果：<span className="font-bold">{topicData.settlement_result === 'yes' ? '📈 看涨成立' : '📉 看跌成立'}</span>
        </div>
      ) : user ? (
        <div>
          {/* Tab 切换 */}
          {hasPosition && (
            <div className="flex border border-gray-200 rounded-xl overflow-hidden mb-4">
              <button
                onClick={() => setActiveTab('trade')}
                className={`flex-1 py-2 text-sm font-medium transition ${activeTab === 'trade' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                交易
              </button>
              <button
                onClick={() => setActiveTab('position')}
                className={`flex-1 py-2 text-sm font-medium transition ${activeTab === 'position' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                我的持仓
              </button>
            </div>
          )}

          {activeTab === 'trade' && (
            <div>
              {/* 积分输入 */}
              <div className="mb-4">
                <label className="text-xs text-gray-500 mb-1.5 block">投入积分</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="10"
                    step="10"
                    value={betCredits}
                    onChange={e => setBetCredits(Math.max(10, parseInt(e.target.value) || 10))}
                    className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {[10, 50, 100, 200].map(v => (
                    <button
                      key={v}
                      onClick={() => setBetCredits(v)}
                      className={`px-3 py-2 text-xs rounded-lg border transition ${betCredits === v ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-400'}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleVote('yes')}
                  disabled={voting}
                  className="py-3.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold transition hover:shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span className="text-lg">📈</span>
                  <div>
                    <div className="text-sm font-bold">看涨</div>
                    <div className="text-xs opacity-80">{betCredits} 积分</div>
                  </div>
                </button>
                <button
                  onClick={() => handleVote('no')}
                  disabled={voting}
                  className="py-3.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition hover:shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span className="text-lg">📉</span>
                  <div>
                    <div className="text-sm font-bold">看跌</div>
                    <div className="text-xs opacity-80">{betCredits} 积分</div>
                  </div>
                </button>
              </div>
              <p className="text-xs text-gray-400 text-center mt-2">
                当前价格：看涨 {yesPercent}¢ · 看跌 {noPercent}¢（每份 10 积分）
              </p>
            </div>
          )}

          {activeTab === 'position' && hasPosition && (
            <div className="space-y-3">
              {[yesPos, noPos].filter(Boolean).map(pos => (
                <div key={pos.vote} className={`p-4 rounded-xl border ${pos.vote === 'yes' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">{pos.vote === 'yes' ? '📈 看涨仓位' : '📉 看跌仓位'}</span>
                    <button
                      onClick={() => handleClose(pos.vote)}
                      disabled={closing}
                      className="text-xs px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 transition"
                    >
                      平仓
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-gray-500">投入</div>
                      <div className="font-bold">{pos.total_credits} 积分</div>
                    </div>
                    <div>
                      <div className="text-gray-500">当前市值</div>
                      <div className="font-bold">{pos.current_value} 积分</div>
                    </div>
                    <div>
                      <div className="text-gray-500">盈亏</div>
                      <div className={`font-bold ${pos.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {pos.pnl >= 0 ? '+' : ''}{pos.pnl}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 bg-gray-50 rounded-xl text-center text-sm text-gray-500 border border-gray-200">
          登录后才能参与投票
        </div>
      )}
    </div>
  );
}

// ─── 多选项话题投票区 ─────────────────────────────────────────────────────────

function MultiVotePanel({ topicData, user, position, onVote, onClose }) {
  const [selectedOption, setSelectedOption] = useState(null);
  const [betCredits, setBetCredits] = useState(10);
  const [voting, setVoting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [activeTab, setActiveTab] = useState('trade');

  const isSettled = topicData.status === 'settled';
  const options = topicData.options || [];
  const totalVotes = options.reduce((s, o) => s + (o.vote_count || 0), 0);

  const myPositions = position?.positions || [];

  const handleVote = async () => {
    if (!user) return alert('请先登录后再投票');
    if (!selectedOption) return alert('请选择一个选项');
    if (isSettled) return alert('该话题已结算，无法投票');
    if (voting) return;
    if (betCredits < 10) return alert('最少投入 10 积分');
    setVoting(true);
    try {
      await onVote({ option_id: selectedOption, credits: betCredits });
    } finally {
      setVoting(false);
    }
  };

  const handleClose = async (optionId, optionLabel) => {
    if (!user || closing) return;
    if (!window.confirm(`确认平仓「${optionLabel}」仓位？将按当前市场价格结算。`)) return;
    setClosing(true);
    try {
      await onClose({ option_id: optionId });
    } finally {
      setClosing(false);
    }
  };

  return (
    <div>
      {/* 选项列表 */}
      <div className="space-y-2 mb-5">
        {options.map(opt => {
          const pct = totalVotes > 0 ? Math.round((opt.vote_count / totalVotes) * 100) : Math.round(100 / options.length);
          const isWinner = isSettled && topicData.settlement_result === opt.label;
          return (
            <div
              key={opt.id}
              onClick={() => !isSettled && setSelectedOption(opt.id)}
              className={`relative overflow-hidden rounded-xl border-2 cursor-pointer transition ${
                isSettled
                  ? isWinner ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-gray-50 opacity-60'
                  : selectedOption === opt.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-blue-300'
              }`}
            >
              {/* 背景进度条 */}
              <div
                className={`absolute inset-0 opacity-20 transition-all duration-700 ${isWinner ? 'bg-green-400' : 'bg-blue-400'}`}
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  {!isSettled && (
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selectedOption === opt.id ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                    }`}>
                      {selectedOption === opt.id && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  )}
                  {isWinner && <span className="text-green-600">✓</span>}
                  <span className="text-sm font-medium text-gray-800">{opt.label}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-700">{pct}%</div>
                  <div className="text-xs text-gray-400">{Math.round(opt.vote_count)} 份</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isSettled ? (
        <div className="p-4 bg-gray-50 rounded-xl text-center text-sm text-gray-500 border border-gray-200">
          此话题已结算 · 获胜选项：<span className="font-bold text-green-600">{topicData.settlement_result}</span>
        </div>
      ) : user ? (
        <div>
          {myPositions.length > 0 && (
            <div className="flex border border-gray-200 rounded-xl overflow-hidden mb-4">
              <button
                onClick={() => setActiveTab('trade')}
                className={`flex-1 py-2 text-sm font-medium transition ${activeTab === 'trade' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                交易
              </button>
              <button
                onClick={() => setActiveTab('position')}
                className={`flex-1 py-2 text-sm font-medium transition ${activeTab === 'position' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                我的持仓
              </button>
            </div>
          )}

          {activeTab === 'trade' && (
            <div>
              <div className="mb-4">
                <label className="text-xs text-gray-500 mb-1.5 block">投入积分</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="10"
                    step="10"
                    value={betCredits}
                    onChange={e => setBetCredits(Math.max(10, parseInt(e.target.value) || 10))}
                    className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {[10, 50, 100, 200].map(v => (
                    <button
                      key={v}
                      onClick={() => setBetCredits(v)}
                      className={`px-3 py-2 text-xs rounded-lg border transition ${betCredits === v ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-400'}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleVote}
                disabled={!selectedOption || voting}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {selectedOption
                  ? `押注「${options.find(o => o.id === selectedOption)?.label}」· ${betCredits} 积分`
                  : '请先选择选项'}
              </button>
            </div>
          )}

          {activeTab === 'position' && myPositions.length > 0 && (
            <div className="space-y-3">
              {myPositions.map(pos => (
                <div key={pos.option_id} className="p-4 rounded-xl border bg-blue-50 border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">📌 {pos.option_label || pos.vote}</span>
                    <button
                      onClick={() => handleClose(pos.option_id, pos.option_label)}
                      disabled={closing}
                      className="text-xs px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 transition"
                    >
                      平仓
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-gray-500">投入</div>
                      <div className="font-bold">{pos.total_credits} 积分</div>
                    </div>
                    <div>
                      <div className="text-gray-500">当前市值</div>
                      <div className="font-bold">{pos.current_value} 积分</div>
                    </div>
                    <div>
                      <div className="text-gray-500">盈亏</div>
                      <div className={`font-bold ${pos.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {pos.pnl >= 0 ? '+' : ''}{pos.pnl}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 bg-gray-50 rounded-xl text-center text-sm text-gray-500 border border-gray-200">
          登录后才能参与投票
        </div>
      )}
    </div>
  );
}

// ─── 交易历史 ─────────────────────────────────────────────────────────────────

function TradeHistory({ topicId }) {
  const [trades, setTrades] = useState([]);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (show) {
      axios.get(`${API_URL}/topics/${topicId}/trades`).then(r => setTrades(r.data)).catch(() => {});
    }
  }, [show, topicId]);

  const actionLabel = { open: '建仓', add: '追加', close: '平仓' };
  const actionColor = { open: 'text-blue-600', add: 'text-green-600', close: 'text-orange-500' };

  return (
    <div className="mt-4">
      <button
        onClick={() => setShow(v => !v)}
        className="text-xs text-gray-400 hover:text-blue-600 transition flex items-center gap-1"
      >
        {show ? '▲ 收起' : '▼ 查看交易记录'}
      </button>
      {show && (
        <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto">
          {trades.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-4">暂无交易记录</div>
          ) : trades.map(t => (
            <div key={t.id} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2">
                <span className={`font-medium ${actionColor[t.action] || 'text-gray-600'}`}>{actionLabel[t.action] || t.action}</span>
                <span className="text-gray-600">{t.user_email?.split('@')[0]}</span>
                <span className="text-gray-400">{t.vote}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-500">
                <span>{t.credits} 积分</span>
                <span>{(t.price * 100).toFixed(0)}¢</span>
                <span>{new Date(t.created_at).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

export function TopicDetail({ topic, user, onBack, onVote }) {
  const [comments, setComments] = useState([]);
  const [topicData, setTopicData] = useState(topic);
  const [position, setPosition] = useState(null);
  const [showProfile, setShowProfile] = useState(null);

  useEffect(() => {
    fetchComments();
    fetchTopicData();
    if (user) fetchPosition();
  }, [topic.id]);

  const fetchTopicData = async () => {
    try {
      const res = await axios.get(`${API_URL}/topics/${topic.id}`);
      setTopicData(res.data);
    } catch {}
  };

  const fetchPosition = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/topics/${topic.id}/position`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPosition(res.data);
    } catch {}
  };

  const fetchComments = async () => {
    try {
      const res = await axios.get(`${API_URL}/topics/${topic.id}/comments`);
      setComments(res.data);
    } catch {}
  };

  const handleVote = async (payload) => {
    if (!user) return alert('请先登录后再投票');
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/topics/${topic.id}/vote`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchTopicData();
      await fetchPosition();
      onVote();
    } catch (err) {
      alert(err.response?.data?.error || '投票失败');
    }
  };

  const handleClose = async (payload) => {
    if (!user) return;
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${API_URL}/topics/${topic.id}/close-position`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(res.data.message || '平仓成功');
      await fetchTopicData();
      await fetchPosition();
      onVote();
    } catch (err) {
      alert(err.response?.data?.error || '平仓失败');
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

  const isSettled = topicData.status === 'settled';
  const catInfo = categoryLabels[topicData.category] || categoryLabels.other;
  const creatorRole = roleLabels[topicData.creator_role] || roleLabels.other;
  const isMulti = topicData.topic_type === 'multi';

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition font-medium"
      >
        ← 返回列表
      </button>

      {/* Main Card */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-5 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-sm">{catInfo.emoji}</span>
            <span className="text-xs text-gray-500">{catInfo.label}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${creatorRole.bg} ${creatorRole.text}`}>
              {creatorRole.label}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isMulti ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
              {isMulti ? '多选项' : '二元'}
            </span>
            {isSettled && (
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-green-100 text-green-700">
                ✓ 已结算
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-gray-900 leading-snug mb-2">{topicData.title}</h1>
          {topicData.description && (
            <p className="text-sm text-gray-600 leading-relaxed">{topicData.description}</p>
          )}
          <div className="flex items-center gap-3 mt-3 text-xs text-gray-400 flex-wrap">
            <span>发布于 {new Date(topicData.created_at).toLocaleDateString('zh-CN')}</span>
            {topicData.settlement_date && <span>· 结算日 {topicData.settlement_date}</span>}
            <span>· {topicData.total_participants} 人参与</span>
            {topicData.total_pool > 0 && <span>· 积分池 {topicData.total_pool}</span>}
          </div>
        </div>

        {/* Vote Panel */}
        <div className="p-6">
          {isMulti ? (
            <MultiVotePanel
              topicData={topicData}
              user={user}
              position={position}
              onVote={handleVote}
              onClose={handleClose}
            />
          ) : (
            <BinaryVotePanel
              topicData={topicData}
              user={user}
              position={position}
              onVote={handleVote}
              onClose={handleClose}
            />
          )}

          {/* 交易历史 */}
          <TradeHistory topicId={topic.id} />
        </div>
      </div>

      {/* Trend Chart（仅二元话题） */}
      {!isMulti && <VoteTrend topicId={topic.id} />}

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
