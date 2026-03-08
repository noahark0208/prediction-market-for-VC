import { useState, useEffect } from 'react';
import axios from 'axios';
import { UserProfile } from './UserProfile';
import { VoteTrend } from './VoteTrend';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export function TopicDetail({ topic, user, onBack, onVote }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [topicData, setTopicData] = useState(topic);
  const [showProfile, setShowProfile] = useState(null);

  useEffect(() => {
    fetchComments();
    fetchTopicData();
  }, [topic.id]);

  const fetchTopicData = async () => {
    const res = await axios.get(`${API_URL}/topics/${topic.id}`);
    setTopicData(res.data);
  };

  const fetchComments = async () => {
    const res = await axios.get(`${API_URL}/topics/${topic.id}/comments`);
    setComments(res.data);
  };

  const handleVote = async (vote) => {
    if (!user) {
      alert('请先登录');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/topics/${topic.id}/vote`,
        { vote },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      alert('投票成功！消耗10积分');
      fetchTopicData();
      onVote();
    } catch (err) {
      alert(err.response?.data?.error || '投票失败');
    }
  };

  const handleComment = async () => {
    if (!user) {
      alert('请先登录');
      return;
    }
    if (!newComment.trim()) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/topics/${topic.id}/comments`,
        { content: newComment },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setNewComment('');
      fetchComments();
    } catch (err) {
      alert(err.response?.data?.error || '评论失败');
    }
  };

  const total = topicData.yes_votes + topicData.no_votes;
  const yesPercent = total > 0 ? Math.round((topicData.yes_votes / total) * 100) : 50;
  const noPercent = 100 - yesPercent;

  return (
    <div className="max-w-4xl mx-auto">
      <button 
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-gray-600 hover:text-blue-600 transition font-medium"
      >
        <span>←</span> 返回列表
      </button>

      <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-lg mb-6">
        <h1 className="text-3xl font-bold mb-4 text-gray-800">{topicData.title}</h1>
        {topicData.description && (
          <p className="text-gray-600 mb-8 text-lg leading-relaxed">{topicData.description}</p>
        )}

        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-green-600">{yesPercent}%</div>
                <div className="text-sm text-gray-600 mt-1">看涨</div>
              </div>
              <div className="w-px h-12 bg-gray-300"></div>
              <div className="text-center">
                <div className="text-4xl font-bold text-red-600">{noPercent}%</div>
                <div className="text-sm text-gray-600 mt-1">看跌</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-700">{topicData.total_participants}</div>
              <div className="text-sm text-gray-500">人参与</div>
            </div>
          </div>
          
          <div className="h-4 bg-white rounded-full overflow-hidden shadow-inner">
            <div className="h-full flex">
              <div className="bg-gradient-to-r from-green-400 to-green-500 transition-all duration-500" style={{ width: `${yesPercent}%` }} />
              <div className="bg-gradient-to-r from-red-400 to-red-500 transition-all duration-500" style={{ width: `${noPercent}%` }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => handleVote('yes')}
            className="py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:shadow-lg transition-all font-bold text-lg"
          >
            📈 看涨 (10积分)
          </button>
          <button
            onClick={() => handleVote('no')}
            className="py-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:shadow-lg transition-all font-bold text-lg"
          >
            📉 看跌 (10积分)
          </button>
        </div>
      </div>

      <VoteTrend topicId={topic.id} />

      <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-lg">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">💬 讨论区 ({comments.length})</h2>
        
        {user && (
          <div className="mb-8">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="说说你的看法..."
              className="w-full p-4 border-2 border-gray-200 rounded-xl resize-none focus:outline-none focus:border-blue-400 transition"
              rows="3"
            />
            <button
              onClick={handleComment}
              className="mt-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all font-medium"
            >
              发表评论
            </button>
          </div>
        )}

        <div className="space-y-4">
          {comments.map(comment => {
            const roleInfo = {
              vc: { label: 'VC', color: 'blue' },
              fa: { label: 'FA', color: 'purple' },
              founder: { label: '创业者', color: 'green' },
              other: { label: '其他', color: 'gray' }
            }[comment.user_role] || { label: '其他', color: 'gray' };
            
            return (
              <div key={comment.id} className="bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span 
                      onClick={() => setShowProfile(comment.user_id)}
                      className="font-semibold text-gray-800 hover:text-blue-600 cursor-pointer"
                    >
                      {comment.user_email}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-${roleInfo.color}-100 text-${roleInfo.color}-700`}>
                      {roleInfo.label}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(comment.created_at).toLocaleString('zh-CN')}
                  </span>
                </div>
                <p className="text-gray-700 leading-relaxed">{comment.content}</p>
              </div>
            );
          })}
          {comments.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              还没有评论，来抢沙发吧！
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
