import { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export function CommentInput({ onSubmit, placeholder = '说说你的看法... 输入 @ 可以提及用户' }) {
  const [content, setContent] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);
  const textareaRef = useRef(null);
  const debounceRef = useRef(null);

  const handleChange = (e) => {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    setContent(val);
    setCursorPos(pos);

    // 检测 @ 触发
    const textBefore = val.slice(0, pos);
    const atMatch = textBefore.match(/@([^\s@]*)$/);
    if (atMatch) {
      const query = atMatch[1];
      setMentionQuery(query);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchSuggestions(query), 200);
    } else {
      setShowSuggestions(false);
      setMentionSuggestions([]);
    }
  };

  const fetchSuggestions = async (query) => {
    if (query.length < 1) { setShowSuggestions(false); return; }
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/users/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMentionSuggestions(res.data);
      setShowSuggestions(res.data.length > 0);
    } catch {
      setShowSuggestions(false);
    }
  };

  const insertMention = (email) => {
    const textBefore = content.slice(0, cursorPos);
    const textAfter = content.slice(cursorPos);
    const atIndex = textBefore.lastIndexOf('@');
    const newContent = textBefore.slice(0, atIndex) + `@${email} ` + textAfter;
    setContent(newContent);
    setShowSuggestions(false);
    setMentionSuggestions([]);
    textareaRef.current?.focus();
  };

  const handleSubmit = () => {
    if (!content.trim()) return;
    onSubmit(content);
    setContent('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // 渲染评论内容，高亮 @提及
  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full p-4 border-2 border-gray-200 rounded-xl resize-none focus:outline-none focus:border-blue-400 transition text-sm leading-relaxed"
        rows="3"
      />

      {/* @ 提及建议列表 */}
      {showSuggestions && (
        <div className="absolute bottom-full left-0 mb-1 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-10 overflow-hidden">
          {mentionSuggestions.map(user => (
            <button
              key={user.id}
              onMouseDown={(e) => { e.preventDefault(); insertMention(user.email); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 transition text-left"
            >
              <div className="w-7 h-7 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                {user.email[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{user.email}</div>
                <div className="text-xs text-gray-500">{user.role}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-400">Ctrl+Enter 快速发送 · 输入 @ 提及用户</span>
        <button
          onClick={handleSubmit}
          disabled={!content.trim()}
          className="px-5 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          发表评论
        </button>
      </div>
    </div>
  );
}

// 渲染评论文本，高亮 @提及
export function CommentText({ content }) {
  const parts = content.split(/(@[^\s@]+@[^\s@]+)/g);
  return (
    <p className="text-gray-700 leading-relaxed text-sm">
      {parts.map((part, i) =>
        part.match(/^@[^\s@]+@[^\s@]+$/) ? (
          <span key={i} className="text-blue-600 font-medium hover:underline cursor-pointer">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}
