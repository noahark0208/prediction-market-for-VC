import { useState } from 'react';

export function LoginModal({ onClose, onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('vc');

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(email, password, isRegister, role);
  };

  const roles = [
    { value: 'vc', label: '💼 VC投资人', color: 'blue' },
    { value: 'fa', label: '🤝 FA', color: 'purple' },
    { value: 'founder', label: '🚀 创业者', color: 'green' },
    { value: 'other', label: '👤 其他', color: 'gray' }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
        <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          {isRegister ? '加入我们' : '欢迎回来'}
        </h2>
        <p className="text-gray-500 mb-6">
          {isRegister ? '注册即送1000积分' : '继续你的预测之旅'}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition"
              placeholder="your@email.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition"
              placeholder="••••••••"
              required
            />
          </div>
          
          {isRegister && (
            <div>
              <label className="block text-sm font-medium mb-3 text-gray-700">选择身份</label>
              <div className="grid grid-cols-2 gap-3">
                {roles.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    className={`p-3 rounded-xl border-2 transition ${
                      role === r.value 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-lg mb-1">{r.label}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all font-semibold text-lg"
          >
            {isRegister ? '立即注册' : '登录'}
          </button>
        </form>
        <div className="mt-6 text-center">
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
          </button>
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 text-gray-500 hover:text-gray-700 transition"
        >
          取消
        </button>
      </div>
    </div>
  );
}
