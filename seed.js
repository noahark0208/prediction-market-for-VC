const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('./prediction.db');

const seedTopics = [
  {
    title: "2026年底之前会有多少家估值超过100亿人民币的机器人创业公司？",
    description: "考虑人形机器人、工业机器人、服务机器人等赛道，目前优必选、达闼等已接近或超过这个估值。",
    yes_votes: 45,
    no_votes: 35
  },
  {
    title: "燧原科技能否在2026年成功上市？",
    description: "燧原科技是国产AI芯片独角兽，已完成多轮融资。考虑当前市场环境和公司发展阶段。",
    yes_votes: 38,
    no_votes: 42
  },
  {
    title: "2026年会出现新的AI独角兽（估值>10亿美元）吗？",
    description: "在大模型、AI应用、AI基础设施等领域，是否还有新玩家能快速崛起？",
    yes_votes: 67,
    no_votes: 23
  },
  {
    title: "小鹏汽车2026年能实现全年盈利吗？",
    description: "小鹏在智能驾驶领域投入巨大，但持续亏损。2026年能否扭亏为盈？",
    yes_votes: 28,
    no_votes: 52
  },
  {
    title: "理想汽车会在2026年推出20万以下的车型吗？",
    description: "理想目前主打30-50万价格区间，是否会下探到更大众的市场？",
    yes_votes: 55,
    no_votes: 25
  },
  {
    title: "2026年会有中国AI公司被海外巨头收购吗？",
    description: "考虑地缘政治、技术封锁等因素，中国AI创业公司是否还有可能被Google、Meta等收购？",
    yes_votes: 15,
    no_votes: 65
  },
  {
    title: "Moonshot AI（月之暗面）2026年估值能超过50亿美元吗？",
    description: "Kimi已经成为现象级产品，月之暗面的估值增长空间有多大？",
    yes_votes: 72,
    no_votes: 18
  },
  {
    title: "2026年会有新的万亿市值中国科技公司诞生吗？",
    description: "目前腾讯、阿里、字节等已达万亿级别，新势力中谁最有可能？",
    yes_votes: 22,
    no_votes: 58
  },
  {
    title: "蔚来汽车能在2026年底前实现单月交付5万辆吗？",
    description: "蔚来目前月交付2万辆左右，能否在2026年实现突破？",
    yes_votes: 48,
    no_votes: 32
  },
  {
    title: "2026年VC市场会比2025年更活跃吗？",
    description: "考虑宏观经济、退出环境、募资情况等因素，一级市场是否会回暖？",
    yes_votes: 41,
    no_votes: 39
  }
];

async function initSeedData() {
  // 创建系统用户（用于做市）
  const systemPassword = await bcrypt.hash('system123', 10);
  
  db.serialize(() => {
    // 插入系统用户
    db.run(`INSERT OR IGNORE INTO users (id, email, password, credits) VALUES (1, 'system@market.com', ?, 999999)`, 
      [systemPassword], 
      function(err) {
        if (err) {
          console.log('系统用户已存在');
        } else {
          console.log('✅ 创建系统用户');
        }
      }
    );

    // 插入种子话题
    seedTopics.forEach((topic, index) => {
      db.run(
        `INSERT INTO topics (title, description, creator_id, yes_votes, no_votes, total_participants) 
         VALUES (?, ?, 1, ?, ?, ?)`,
        [topic.title, topic.description, topic.yes_votes, topic.no_votes, topic.yes_votes + topic.no_votes],
        function(err) {
          if (err) {
            console.log(`话题 ${index + 1} 插入失败:`, err.message);
          } else {
            console.log(`✅ 创建话题 ${index + 1}: ${topic.title.substring(0, 30)}...`);
          }
        }
      );
    });

    console.log('\n🎉 种子数据初始化完成！');
    console.log('📊 已创建 10 个预设话题');
    console.log('🤖 已创建做市系统用户\n');
    
    setTimeout(() => {
      db.close();
      process.exit(0);
    }, 1000);
  });
}

initSeedData();
